"use client";

import React, { use, useEffect, useState } from "react";
import { apiUrl, authHeaders, getErrorMessage } from "@/lib/api";

type LectureDetail = {
  id: number;
  title: string;
  source_type: string;
  source_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  transcript?: {
    raw_text: string;
    cleaned_text?: string | null;
  } | null;
  notes?: {
    structured_content: string;
    summary?: string | null;
    key_points?: string[] | null;
  } | null;
  job?: {
    status: string;
    stage: string;
    progress_percent: number;
    error_message?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  } | null;
  media_asset?: {
    file_path: string;
    media_type?: string | null;
    duration_seconds?: number | null;
  } | null;
};

type LectureLog = {
  id: number;
  level: string;
  message: string;
  created_at: string;
};

const tabs = ["overview", "transcript", "somali-notes", "processing-log"] as const;

function formatDate(dateValue?: string | null): string {
  if (!dateValue) {
    return "Not available yet";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString();
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) {
    return "Not available yet";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function getAccentColor(status?: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
    case "success":
      return "var(--success-color)";
    case "processing":
    case "running":
      return "var(--warning-color)";
    case "failed":
    case "error":
      return "var(--danger-color)";
    default:
      return "var(--primary-color)";
  }
}

export default function LectureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]>("overview");
  const [lecture, setLecture] = useState<LectureDetail | null>(null);
  const [logs, setLogs] = useState<LectureLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadLecture = async (showInitialLoading = false) => {
      if (showInitialLoading) {
        setLoading(true);
      }

      try {
        const [lectureRes, logsRes] = await Promise.all([
          fetch(apiUrl(`/api/v1/lectures/${id}`), {
            headers: authHeaders(),
          }),
          fetch(apiUrl(`/api/v1/lectures/${id}/logs`), {
            headers: authHeaders(),
          }),
        ]);

        if (!lectureRes.ok) {
          throw new Error(
            await getErrorMessage(lectureRes, "Failed to load lecture details."),
          );
        }

        const detail = (await lectureRes.json()) as LectureDetail;
        const lectureLogs = logsRes.ok
          ? ((await logsRes.json()) as LectureLog[])
          : [];

        if (!isActive) {
          return;
        }

        setLecture(detail);
        setLogs(lectureLogs);
        setError(null);
      } catch (err: unknown) {
        if (!isActive) {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load lecture details.",
        );
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadLecture(true);

    const interval = window.setInterval(() => {
      void loadLecture(false);
    }, 3000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [id]);

  if (loading) {
    return <p>Loading lecture details...</p>;
  }

  if (error) {
    return <div className="alert alert-error">{error}</div>;
  }

  if (!lecture) {
    return (
      <div className="alert alert-info">
        Lecture details are not available yet.
      </div>
    );
  }

  const transcriptText =
    lecture.transcript?.cleaned_text || lecture.transcript?.raw_text || "";
  const noteSummary =
    lecture.notes?.summary || "Somali notes are not ready yet.";
  const keyPoints = lecture.notes?.key_points || [];
  const structuredNotes =
    lecture.notes?.structured_content || "No generated notes available yet.";

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await fetch(apiUrl(`/api/v1/lectures/${id}/retry`), {
        method: "POST",
        headers: authHeaders(),
      });

      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Failed to reprocess lecture."),
        );
      }

      setError(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to reprocess lecture.",
      );
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <h1>{lecture.title}</h1>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginTop: "0.5rem",
            opacity: 0.8,
            flexWrap: "wrap",
          }}
        >
          <span>
            Status:{" "}
            <strong style={{ color: getAccentColor(lecture.status) }}>
              {lecture.status}
            </strong>
          </span>
          <span>|</span>
          <span>Lecture ID: {lecture.id}</span>
          <span>|</span>
          <span>Submitted: {formatDate(lecture.created_at)}</span>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <button
            type="button"
            className="btn-outline"
            onClick={handleRetry}
            disabled={retrying}
          >
            {retrying ? "Reprocessing..." : "Reprocess Lecture"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "1rem",
          borderBottom: "1px solid var(--border-color)",
          marginBottom: "2rem",
          flexWrap: "wrap",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: "none",
              border: "none",
              padding: "1rem 0",
              cursor: "pointer",
              color: activeTab === tab ? "var(--primary-color)" : "inherit",
              fontWeight: activeTab === tab ? "bold" : "normal",
              borderBottom:
                activeTab === tab
                  ? "2px solid var(--primary-color)"
                  : "2px solid transparent",
              textTransform: "capitalize",
            }}
          >
            {tab.replace("-", " ")}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === "overview" && (
          <div>
            <h2>Lecture Overview</h2>
            <p style={{ marginTop: "0.5rem" }}>
              This page now reflects the real lecture record from your backend.
            </p>
            <ul style={{ marginTop: "1rem", paddingLeft: "1.5rem", lineHeight: "2" }}>
              <li>
                <strong>Source Type:</strong> {lecture.source_type}
              </li>
              <li>
                <strong>Source:</strong> {lecture.source_url || "No source saved"}
              </li>
              <li>
                <strong>Duration:</strong>{" "}
                {formatDuration(lecture.media_asset?.duration_seconds)}
              </li>
              <li>
                <strong>Processing Stage:</strong>{" "}
                {lecture.job?.stage || "Not available yet"}
              </li>
              <li>
                <strong>Progress:</strong>{" "}
                {lecture.job?.progress_percent ?? 0}%
              </li>
            </ul>

            {lecture.job && (
              <div
                style={{
                  marginTop: "1rem",
                  background: "var(--border-color)",
                  height: "10px",
                  borderRadius: "999px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${lecture.job.progress_percent}%`,
                    height: "100%",
                    background: getAccentColor(lecture.status),
                  }}
                />
              </div>
            )}

            {lecture.job?.error_message && (
              <div className="alert alert-error" style={{ marginTop: "1rem" }}>
                {lecture.job.error_message}
              </div>
            )}
          </div>
        )}

        {activeTab === "transcript" && (
          <div>
            <h2>English Transcript</h2>
            <div
              style={{
                padding: "1rem",
                backgroundColor: "var(--bg-color)",
                borderRadius: "8px",
                marginTop: "1rem",
                maxHeight: "400px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {transcriptText || "Transcript is not ready yet."}
            </div>
          </div>
        )}

        {activeTab === "somali-notes" && (
          <div>
            <h2>Somali Study Notes</h2>
            <div
              style={{
                padding: "1.5rem",
                backgroundColor: "var(--bg-color)",
                borderRadius: "8px",
                borderLeft: "4px solid var(--primary-color)",
                marginTop: "1rem",
              }}
            >
              <h3>Fahamka Guud ahaan (Summary)</h3>
              <p>{noteSummary}</p>

              <h3 style={{ marginTop: "1.5rem" }}>
                Qodobbada Muhiimka ah (Key Points)
              </h3>
              {keyPoints.length > 0 ? (
                <ul style={{ paddingLeft: "1.5rem", marginTop: "0.75rem" }}>
                  {keyPoints.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ marginTop: "0.75rem" }}>
                  Key points are not available yet.
                </p>
              )}

              <h3 style={{ marginTop: "1.5rem" }}>Detailed Notes</h3>
              <div style={{ marginTop: "0.75rem", whiteSpace: "pre-wrap" }}>
                {structuredNotes}
              </div>
            </div>
          </div>
        )}

        {activeTab === "processing-log" && (
          <div>
            <h2>Processing Timeline</h2>
            <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
              {logs.length > 0 ? logs.map((logEntry) => (
                <li
                  key={logEntry.id}
                  style={{
                    padding: "0.75rem 0",
                    borderBottom: "1px solid var(--border-color)",
                    display: "flex",
                    gap: "1rem",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ display: "flex", gap: "1rem" }}>
                    <span style={{ color: getAccentColor(logEntry.level) }}>
                      {logEntry.level}
                    </span>
                    <span style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                      {logEntry.message}
                    </span>
                  </div>
                  <span style={{ opacity: 0.7, whiteSpace: "nowrap" }}>
                    {formatDate(logEntry.created_at)}
                  </span>
                </li>
              )) : (
                <li style={{ padding: "0.75rem 0" }}>
                  No processing logs yet.
                </li>
              )}
            </ul>

            <div style={{ marginTop: "1rem", opacity: 0.8 }}>
              <p>Started: {formatDate(lecture.job?.started_at)}</p>
              <p>Completed: {formatDate(lecture.job?.completed_at)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
