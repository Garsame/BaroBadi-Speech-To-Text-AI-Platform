"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CONNECTION_QUALITY_META,
  type ConnectionQualitySnapshot,
  useConnectionQuality,
} from "@/hooks/useConnectionQuality";
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
      
      const isProcessing = lecture.status.toLowerCase() === "processing" || lecture.status.toLowerCase() === "submitted";
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "processing" && isProcessing) ||
        (statusFilter !== "processing" && lecture.status.toLowerCase() === statusFilter.toLowerCase());
      
      return matchesSearch && matchesStatus;
    });
  }, [lectures, searchQuery, statusFilter]);

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

  const getStatusColor = (status: string) => {
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
        return "#3b82f6";
      default:
        return "gray";
    }
  };

  return (
    <div>
      <style>{`
        .my-lectures-controls {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .search-input-wrapper {
          position: relative;
          flex: 1;
          min-width: 250px;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          background: var(--bg-color);
          color: var(--text-color);
          font-size: 0.95rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .search-input:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
          outline: none;
        }

        .filter-tabs {
          display: flex;
          background: var(--secondary-bg);
          padding: 0.25rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          gap: 0.25rem;
        }

        .filter-tab {
          padding: 0.6rem 1.2rem;
          border: none;
          background: transparent;
          color: var(--text-color);
          font-weight: 600;
          font-size: 0.9rem;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-transform: capitalize;
        }

        .filter-tab:hover {
          background: rgba(99, 102, 241, 0.05);
        }

        .filter-tab.active {
          background: var(--bg-color);
          color: var(--primary-color);
          box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        }

        .lecture-card-custom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-radius: 16px;
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          box-shadow: var(--card-shadow);
          gap: 1.5rem;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .lecture-card-custom:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px rgba(0,0,0,0.05);
        }

        .lecture-card-details {
          min-width: 0;
          flex: 1;
        }

        .lecture-card-details h3 {
          margin: 0 0 0.5rem 0;
          font-weight: 700;
          font-size: 1.15rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .lecture-card-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.5rem;
        }

        /* Responsive Mobile Layout */
        @media (max-width: 768px) {
          .my-lectures-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .search-input-wrapper {
            width: 100%;
          }

          .filter-tabs {
            width: 100%;
            overflow-x: auto;
          }

          .filter-tab {
            flex: 1;
            text-align: center;
            padding: 0.5rem 0.8rem;
            font-size: 0.85rem;
          }

          .lecture-card-custom {
            flex-direction: column;
            align-items: stretch;
            gap: 1.25rem;
            padding: 1.25rem 1rem;
          }

          .lecture-card-details h3 {
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
            font-size: 1.05rem;
          }

          .lecture-card-meta {
            align-items: stretch;
            flex-direction: row;
            justify-content: space-between;
            border-top: 1px solid var(--border-color);
            padding-top: 1rem;
            gap: 0.5rem;
          }

          .lecture-card-meta .btn-outline {
            flex: 1;
            text-align: center;
            padding: 0.5rem 1rem;
          }
        }
      `}</style>

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
        <h1 style={{ margin: 0 }}>My Lectures</h1>
        <Link href="/dashboard/new-lecture" className="btn" style={{ textDecoration: "none" }}>
          Add New
        </Link>
      </div>

      <div className="my-lectures-controls">
        <div className="search-input-wrapper">
          <input
            type="text"
            className="search-input"
            placeholder="Search lectures by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-tabs">
          {["all", "processing", "completed", "failed"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`filter-tab ${statusFilter === tab ? "active" : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {success && <div className="alert alert-success">{success}</div>}
        {loading && lectures.length === 0 ? (
          <p>Loading your lectures...</p>
        ) : lectures.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem", borderRadius: "16px" }}>
            <p>You haven&apos;t submitted any lectures yet.</p>
            <Link
              href="/dashboard/new-lecture"
              className="btn mt-4"
              style={{ display: "inline-block", marginTop: "1rem", textDecoration: "none" }}
            >
              Start Processing
            </Link>
          </div>
        ) : filteredLectures.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "3rem", borderRadius: "16px" }}>
            <p style={{ opacity: 0.7, margin: 0 }}>No lectures match your filters.</p>
          </div>
        ) : (
          filteredLectures.map((lecture) => (
            <div key={lecture.id} className="lecture-card-custom">
              <div className="lecture-card-details">
                <h3>{lecture.title}</h3>
                <p style={{ opacity: 0.7, fontSize: "0.9rem", margin: "0 0 4px 0" }}>
                  Source: {lecture.source_type}
                </p>
                {lecture.job && (
                  <p style={{ opacity: 0.7, fontSize: "0.88rem", margin: 0, color: "var(--text-muted)" }}>
                    Stage: {lecture.job.stage} • Progress: {lecture.job.progress_percent}%
                  </p>
                )}
              </div>
              <div className="lecture-card-meta">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: "0.4rem",
                  }}
                >
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
                  {isProcessingStatus(lecture.status) && (
                    <ConnectionQualityIndicator quality={connectionQuality} />
                  )}
                </div>
                <Link 
                  href={`/dashboard/lecture/${lecture.id}`} 
                  className="btn-outline"
                  style={{ textDecoration: "none" }}
                >
                  View Details
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
      {slowConnectionToast && (
        <SlowConnectionToast onClose={() => setSlowConnectionToast(null)} />
      )}
    </div>
  );
}
