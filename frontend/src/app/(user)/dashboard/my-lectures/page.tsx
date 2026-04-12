"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl, authHeaders } from "@/lib/api";

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

export default function MyLecturesPage() {
  const router = useRouter();
  const [lectures, setLectures] = useState<LectureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);

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

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "var(--success-color)";
      case "processing":
        return "var(--warning-color)";
      case "failed":
        return "var(--danger-color)";
      case "submitted":
        return "#3b82f6";
      default:
        return "gray";
    }
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h1>My Lectures</h1>
        <Link href="/dashboard/new-lecture" className="btn">
          Add New
        </Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {success && <div className="alert alert-success">{success}</div>}
        {loading && lectures.length === 0 ? (
          <p>Loading your lectures...</p>
        ) : lectures.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
            <p>You haven&apos;t submitted any lectures yet.</p>
            <Link
              href="/dashboard/new-lecture"
              className="btn mt-4"
              style={{ display: "inline-block", marginTop: "1rem" }}
            >
              Start Processing
            </Link>
          </div>
        ) : (
          lectures.map((lecture) => (
            <div
              key={lecture.id}
              className="card"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <div>
                <h3 style={{ marginBottom: "0.5rem" }}>{lecture.title}</h3>
                <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
                  Source: {lecture.source_type}
                </p>
                {lecture.job && (
                  <p style={{ opacity: 0.7, fontSize: "0.9rem", marginTop: "0.35rem" }}>
                    Stage: {lecture.job.stage} • Progress: {lecture.job.progress_percent}%
                  </p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <span
                  style={{
                    padding: "0.25rem 0.75rem",
                    borderRadius: "999px",
                    backgroundColor: `${getStatusColor(lecture.status)}20`,
                    color: getStatusColor(lecture.status),
                    fontWeight: "bold",
                    textTransform: "capitalize",
                    fontSize: "0.875rem",
                  }}
                >
                  {lecture.status}
                </span>
                <Link href={`/dashboard/lecture/${lecture.id}`} className="btn-outline">
                  View Details
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
