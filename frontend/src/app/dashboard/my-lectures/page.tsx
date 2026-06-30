"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MdAdd,
  MdArrowForward,
  MdFilterList,
  MdOutlineInsertDriveFile,
  MdOutlineOndemandVideo,
  MdSearch,
} from "react-icons/md";
import {
  CONNECTION_QUALITY_META,
  type ConnectionQualitySnapshot,
  useConnectionQuality,
} from "@/hooks/useConnectionQuality";
import { apiUrl, authHeaders } from "@/lib/api";
import "./my-lectures.css";

type LectureItem = {
  id: number;
  title: string;
  source_type: string;
  status: string;
  job?: {
    stage: string;
    progress_percent: number;
  } | null;
};

function isProcessingStatus(status?: string | null): boolean {
  return status?.toLowerCase() === "processing";
}

function isSlowConnectionLevel(
  level: ConnectionQualitySnapshot["level"],
): boolean {
  return level === "slow" || level === "poor";
}

function ConnectionQualityIndicator({
  quality,
}: {
  quality: ConnectionQualitySnapshot;
}) {
  const meta = quality.level
    ? CONNECTION_QUALITY_META[quality.level]
    : {
        label: "Checking",
        color: "#64748b",
        dotClassName: "bg-slate-400",
        barClassName: "bg-slate-400",
        textClassName: "text-slate-500",
      };
  const latencyLabel =
    typeof quality.latencyMs === "number"
      ? `${Math.round(quality.latencyMs)}ms`
      : "Measuring";

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-semibold shadow-sm"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.45rem",
        border: "1px solid var(--border-color)",
        borderRadius: "999px",
        background: "var(--bg-color)",
        padding: "0.25rem 0.6rem",
        fontSize: "0.75rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${meta.dotClassName}`}
        style={{
          width: "0.5rem",
          height: "0.5rem",
          borderRadius: "999px",
          backgroundColor: meta.color,
          flexShrink: 0,
        }}
      />
      <span style={{ opacity: 0.72 }}>Connection</span>
      <span className={meta.textClassName} style={{ color: meta.color }}>
        {meta.label}
      </span>
      <span
        aria-hidden="true"
        className={`h-1 w-7 rounded-full ${meta.barClassName}`}
        style={{
          width: "1.75rem",
          height: "0.25rem",
          borderRadius: "999px",
          backgroundColor: meta.color,
          opacity: quality.level ? 1 : 0.5,
        }}
      />
      <span style={{ opacity: 0.55 }}>{latencyLabel}</span>
    </div>
  );
}

function SlowConnectionToast({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-orange-200 bg-white p-4 text-sm shadow-lg"
      style={{
        position: "fixed",
        right: "1.25rem",
        bottom: "1.25rem",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        maxWidth: "24rem",
        border: "1px solid #fed7aa",
        borderRadius: "0.75rem",
        background: "var(--bg-color)",
        color: "var(--text-color)",
        padding: "1rem",
        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.22)",
      }}
    >
      <span
        aria-hidden="true"
        className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-500"
        style={{
          width: "0.65rem",
          height: "0.65rem",
          marginTop: "0.25rem",
          borderRadius: "999px",
          backgroundColor: "#f97316",
          flexShrink: 0,
        }}
      />
      <p style={{ margin: 0, lineHeight: 1.45 }}>
        Your internet connection is slow. This may affect how long your lecture
        takes to process. The app is still working.
      </p>
      <button
        type="button"
        aria-label="Dismiss slow connection alert"
        className="ml-1 rounded p-1 text-slate-500 hover:bg-slate-100"
        onClick={onClose}
        style={{
          marginLeft: "0.25rem",
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        X
      </button>
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case "completed":
      return "var(--success-color)";
    case "processing":
      return "var(--warning-color)";
    case "failed":
      return "var(--danger-color)";
    case "canceled":
      return "#6b7280";
    case "submitted":
      return "#009ffd";
    default:
      return "var(--text-muted)";
  }
}

export default function MyLecturesPage() {
  const router = useRouter();
  const [lectures, setLectures] = useState<LectureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [slowConnectionToast, setSlowConnectionToast] = useState<{
    lectureId: number;
    shownAt: number;
  } | null>(null);
  const [notifiedSlowLectureIds, setNotifiedSlowLectureIds] = useState<
    Set<number>
  >(() => new Set());
  const processingLectureIds = useMemo(
    () =>
      lectures
        .filter((lecture) => isProcessingStatus(lecture.status))
        .map((lecture) => lecture.id),
    [lectures],
  );
  const processingLectureIdKey = processingLectureIds.join(",");
  const hasProcessingLectures = processingLectureIds.length > 0;
  const connectionQuality = useConnectionQuality({
    enabled: hasProcessingLectures,
  });

  const filteredLectures = useMemo(() => {
    return lectures.filter((lecture) => {
      const matchesSearch = lecture.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const status = lecture.status.toLowerCase();
      const isProcessing = status === "processing" || status === "submitted";
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "processing" && isProcessing) ||
        (statusFilter !== "processing" && status === statusFilter);

      return matchesSearch && matchesStatus;
    });
  }, [lectures, searchQuery, statusFilter]);

  const statusCounts = useMemo(() => {
    const processing = lectures.filter((lecture) => {
      const status = lecture.status.toLowerCase();
      return status === "processing" || status === "submitted";
    }).length;

    return {
      all: lectures.length,
      processing,
      completed: lectures.filter(
        (lecture) => lecture.status.toLowerCase() === "completed",
      ).length,
      failed: lectures.filter(
        (lecture) => lecture.status.toLowerCase() === "failed",
      ).length,
    };
  }, [lectures]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("login") === "success") {
      setSuccess("Signed in successfully.");
      router.replace("/dashboard/my-lectures");
    }
  }, [router]);

  const fetchLectures = async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/lectures/"), {
        headers: authHeaders(),
      });

      if (res.ok) {
        const data = (await res.json()) as LectureItem[];
        setLectures(data);
      }
    } catch (err) {
      console.error("Failed to fetch lectures", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLectures();

    const interval = window.setInterval(fetchLectures, 5000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const activeProcessingIds = new Set(processingLectureIds);

    setNotifiedSlowLectureIds((currentIds) => {
      const nextIds = new Set<number>();

      currentIds.forEach((lectureId) => {
        if (activeProcessingIds.has(lectureId)) {
          nextIds.add(lectureId);
        }
      });

      return nextIds.size === currentIds.size ? currentIds : nextIds;
    });

    if (!hasProcessingLectures) {
      setSlowConnectionToast(null);
    }
  }, [hasProcessingLectures, processingLectureIdKey, processingLectureIds]);

  useEffect(() => {
    if (
      slowConnectionToast ||
      !isSlowConnectionLevel(connectionQuality.level)
    ) {
      return;
    }

    const lectureIdToNotify = processingLectureIds.find(
      (lectureId) => !notifiedSlowLectureIds.has(lectureId),
    );

    if (lectureIdToNotify === undefined) {
      return;
    }

    setNotifiedSlowLectureIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(lectureIdToNotify);
      return nextIds;
    });
    setSlowConnectionToast({
      lectureId: lectureIdToNotify,
      shownAt: Date.now(),
    });
  }, [
    connectionQuality.level,
    notifiedSlowLectureIds,
    processingLectureIds,
    slowConnectionToast,
  ]);

  useEffect(() => {
    if (!slowConnectionToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSlowConnectionToast(null);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [slowConnectionToast]);

  return (
    <div className="lectures-page">
      <header className="lectures-hero">
        <div>
          <span className="lectures-eyebrow">Learning Library</span>
          <h1>My Lectures</h1>
          <p>
            Track every uploaded lecture, review AI progress, and open the full
            study workspace from one clean list.
          </p>
        </div>
        <Link href="/dashboard/new-lecture" className="lectures-primary-action">
          <MdAdd size={20} />
          Add Lecture
        </Link>
      </header>

      <section className="lectures-toolbar">
        <label className="lectures-search">
          <MdSearch size={21} />
          <input
            type="text"
            placeholder="Search lectures by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>
        <div className="lectures-filters" aria-label="Filter lectures">
          <span className="lectures-filter-label">
            <MdFilterList size={18} />
            Filter
          </span>
          {["all", "processing", "completed", "failed"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={`lectures-filter-tab ${statusFilter === tab ? "is-active" : ""}`}
            >
              <span>{tab}</span>
              <strong>{statusCounts[tab as keyof typeof statusCounts]}</strong>
            </button>
          ))}
        </div>
      </section>

      <section className="lectures-list">
        {success && <div className="alert alert-success">{success}</div>}
        {loading && lectures.length === 0 ? (
          <div className="lectures-empty-card">Loading your lectures...</div>
        ) : lectures.length === 0 ? (
          <div className="lectures-empty-card">
            <h2>No lectures yet</h2>
            <p>
              Start with a YouTube link or an audio file and Baro Platform will
              build notes, transcripts, and quizzes for you.
            </p>
            <Link href="/dashboard/new-lecture" className="lectures-primary-action">
              <MdAdd size={20} />
              Start Processing
            </Link>
          </div>
        ) : filteredLectures.length === 0 ? (
          <div className="lectures-empty-card">
            <h2>No matches found</h2>
            <p>No lectures match your current search and filters.</p>
          </div>
        ) : (
          filteredLectures.map((lecture) => {
            const sourceType = lecture.source_type.toLowerCase();
            const progress =
              lecture.job?.progress_percent ??
              (lecture.status.toLowerCase() === "completed" ? 100 : 0);

            return (
              <article key={lecture.id} className="lecture-row-card">
                <div
                  className={`lecture-source-mark ${sourceType === "youtube" ? "is-video" : ""}`}
                >
                  {sourceType === "youtube" ? (
                    <MdOutlineOndemandVideo size={24} />
                  ) : (
                    <MdOutlineInsertDriveFile size={24} />
                  )}
                </div>

                <div className="lecture-row-body">
                  <div className="lecture-row-title">
                    <h2>{lecture.title}</h2>
                    <span
                      className="lecture-status-badge"
                      style={{
                        backgroundColor: `${getStatusColor(lecture.status)}1f`,
                        color: getStatusColor(lecture.status),
                      }}
                    >
                      {lecture.status}
                    </span>
                  </div>
                  <div className="lecture-row-meta">
                    <span>Source: {lecture.source_type}</span>
                    {lecture.job && <span>Stage: {lecture.job.stage}</span>}
                  </div>
                  <div
                    className="lecture-progress-track"
                    aria-label={`Progress ${progress}%`}
                  >
                    <span
                      style={{
                        width: `${Math.min(Math.max(progress, 0), 100)}%`,
                        backgroundColor: getStatusColor(lecture.status),
                      }}
                    />
                  </div>
                </div>

                <div className="lecture-row-actions">
                  {lecture.job && (
                    <span className="lecture-progress-text">
                      {lecture.job.progress_percent}% complete
                    </span>
                  )}
                  {isProcessingStatus(lecture.status) && (
                    <ConnectionQualityIndicator quality={connectionQuality} />
                  )}
                  <Link
                    href={`/dashboard/lecture/${lecture.id}`}
                    className="lecture-view-link"
                  >
                    View Details
                    <MdArrowForward size={18} />
                  </Link>
                </div>
              </article>
            );
          })
        )}
      </section>
      {slowConnectionToast && (
        <SlowConnectionToast onClose={() => setSlowConnectionToast(null)} />
      )}
    </div>
  );
}
