"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  FaChevronDown,
  FaChevronUp,
  FaExternalLinkAlt,
  FaFileAudio,
  FaYoutube,
} from "react-icons/fa";
import { apiUrl, authHeaders } from "@/lib/api";

interface AdminLecture {
  id: number;
  title?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  source_type?: string | null;
  source_url?: string | null;
  source_link?: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  duration_seconds?: number | null;
  file_size_bytes?: number | null;
  job_progress_percent?: number | null;
  job_completed_at?: string | null;
  valuation_score?: number | null;
  valuation_label?: string | null;
  valuation_summary?: string | null;
  genre_label?: string | null;
  genre_explanation?: string | null;
}

const headerCellStyle: React.CSSProperties = {
  padding: "0.8rem 0.95rem",
  color: "var(--text-muted)",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
};

const bodyCellStyle: React.CSSProperties = {
  padding: "0.82rem 0.95rem",
  color: "var(--text)",
  fontSize: "0.82rem",
  verticalAlign: "middle",
  borderTop: "1px solid var(--border)",
};

const truncateStyle: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function formatDate(value?: string | null): string {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleString();
}

function formatScore(score?: number | null): string {
  return typeof score === "number" ? `${Math.round(score)}%` : "Pending";
}

function formatStatus(status: string): string {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compactGenre(label?: string | null): string {
  const cleanLabel = (label || "").trim();
  if (!cleanLabel) return "Pending";
  return cleanLabel
    .split(/\s-\s|:|\./)[0]
    .trim() || cleanLabel;
}

function sourceLabel(sourceType?: string | null): "YouTube" | "Uploaded" {
  return sourceType === "youtube" ? "YouTube" : "Uploaded";
}

function sourceTone(sourceType?: string | null): {
  icon: React.ReactNode;
  background: string;
  color: string;
} {
  if (sourceType === "youtube") {
    return {
      icon: <FaYoutube size={15} />,
      background: "var(--primary-hover-translucent)",
      color: "var(--primary-hover)",
    };
  }

  return {
    icon: <FaFileAudio size={14} />,
    background: "var(--primary-translucent)",
    color: "var(--primary-color)",
  };
}

function statusTone(status: string): { background: string; color: string; border: string } {
  const normalized = status.toLowerCase();
  if (normalized === "completed") {
    return {
      background: "var(--primary-translucent)",
      color: "var(--primary-color)",
      border: "color-mix(in srgb, var(--primary-color) 24%, var(--border))",
    };
  }
  if (normalized.includes("fail") || normalized.includes("error")) {
    return {
      background: "var(--primary-hover-translucent)",
      color: "var(--primary-hover)",
      border: "color-mix(in srgb, var(--primary-hover) 24%, var(--border))",
    };
  }
  if (normalized.includes("cancel")) {
    return {
      background: "var(--admin-surface-soft)",
      color: "var(--text-muted)",
      border: "var(--border)",
    };
  }
  return {
    background: "var(--primary-hover-translucent)",
    color: "var(--primary-hover)",
    border: "color-mix(in srgb, var(--primary-hover) 24%, var(--border))",
  };
}

function scoreTone(score?: number | null): string {
  if (typeof score !== "number") return "var(--text-muted)";
  if (score >= 85) return "var(--primary-color)";
  if (score >= 65) return "var(--primary-hover)";
  return "var(--text-muted)";
}

function buildSourceHref(lecture: AdminLecture): string | null {
  if (lecture.source_type !== "youtube" || !lecture.source_link) return null;
  if (/^https?:\/\//i.test(lecture.source_link)) return lecture.source_link;
  return apiUrl(lecture.source_link);
}

export default function LecturesPage() {
  const [lectures, setLectures] = useState<AdminLecture[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchLectures = async () => {
      try {
        const res = await fetch(apiUrl("/api/v1/admin/recent-lectures?limit=100"), {
          headers: authHeaders(),
          cache: "no-store",
        });
        if (res.ok) setLectures((await res.json()) as AdminLecture[]);
      } catch {
        console.error("Failed to load lecture oversight data");
      } finally {
        setLoading(false);
      }
    };
    fetchLectures();
  }, []);

  const summary = useMemo(() => {
    const completed = lectures.filter((lecture) => lecture.status === "completed").length;
    const youtube = lectures.filter((lecture) => lecture.source_type === "youtube").length;
    const averageScoreValues = lectures
      .map((lecture) => lecture.valuation_score)
      .filter((score): score is number => typeof score === "number");
    const averageScore = averageScoreValues.length
      ? averageScoreValues.reduce((sum, score) => sum + score, 0) / averageScoreValues.length
      : null;

    return { completed, youtube, averageScore };
  }, [lectures]);

  const toggleRow = (lectureId: number) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(lectureId)) {
        next.delete(lectureId);
      } else {
        next.add(lectureId);
      }
      return next;
    });
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "1rem",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Lecture Oversight</h1>
          <p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)" }}>
            Compact lecture rows with source, owner, genre, status, correctness, link, and date.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "0.75rem",
          marginBottom: "1rem",
        }}
      >
        <div className="admin-card card-lift" style={{ padding: "0.8rem 1rem", borderRadius: "8px" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>Total</div>
          <div style={{ marginTop: "0.25rem", fontSize: "1.3rem", fontWeight: 700, color: "var(--primary-color)" }}>{lectures.length}</div>
        </div>
        <div className="admin-card card-lift" style={{ padding: "0.8rem 1rem", borderRadius: "8px" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>Completed</div>
          <div style={{ marginTop: "0.25rem", fontSize: "1.3rem", fontWeight: 700, color: "var(--primary-color)" }}>{summary.completed}</div>
        </div>
        <div className="admin-card card-lift" style={{ padding: "0.8rem 1rem", borderRadius: "8px" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>YouTube</div>
          <div style={{ marginTop: "0.25rem", fontSize: "1.3rem", fontWeight: 700, color: "var(--primary-hover)" }}>{summary.youtube}</div>
        </div>
        <div className="admin-card card-lift" style={{ padding: "0.8rem 1rem", borderRadius: "8px" }}>
          <div style={{ color: "var(--text-muted)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase" }}>Avg Correctness</div>
          <div style={{ marginTop: "0.25rem", fontSize: "1.3rem", fontWeight: 700, color: scoreTone(summary.averageScore) }}>{formatScore(summary.averageScore)}</div>
        </div>
      </div>

      <section className="admin-card" style={{ overflow: "hidden", borderRadius: "8px" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.9rem 1rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Showing {lectures.length} of {lectures.length} lectures
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "1.5rem", color: "var(--text-muted)" }}>Loading lectures...</div>
        ) : lectures.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>No lectures have been submitted yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: "820px",
                borderCollapse: "collapse",
                tableLayout: "fixed",
                textAlign: "left",
              }}
            >
              <colgroup>
                <col style={{ width: "6%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "27%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "11%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={headerCellStyle} aria-label="More details" />
                  <th style={headerCellStyle}>Source</th>
                  <th style={headerCellStyle}>Lecture Title</th>
                  <th style={headerCellStyle}>Owner Name</th>
                  <th style={headerCellStyle}>Genre</th>
                  <th style={headerCellStyle}>Status</th>
                  <th style={headerCellStyle}>Correctness</th>
                </tr>
              </thead>
              <tbody>
                {lectures.map((lecture) => {
                  const source = sourceTone(lecture.source_type);
                  const status = statusTone(lecture.status);
                  const sourceHref = buildSourceHref(lecture);
                  const date = lecture.job_completed_at || lecture.updated_at || lecture.created_at;
                  const isExpanded = expandedRows.has(lecture.id);

                  return (
                    <React.Fragment key={lecture.id}>
                      <tr>
                        <td style={{ ...bodyCellStyle, paddingRight: 0 }}>
                          <button
                            type="button"
                            onClick={() => toggleRow(lecture.id)}
                            aria-label={isExpanded ? "Hide source link and date" : "Show source link and date"}
                            style={{
                              width: "30px",
                              height: "30px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              border: "1px solid var(--border)",
                              borderRadius: "8px",
                              background: "transparent",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                            }}
                          >
                            {isExpanded ? <FaChevronUp size={12} /> : <FaChevronDown size={12} />}
                          </button>
                        </td>
                        <td style={bodyCellStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.45rem",
                              maxWidth: "100%",
                              padding: "0.38rem 0.55rem",
                              borderRadius: "999px",
                              background: source.background,
                              color: source.color,
                              fontSize: "0.8rem",
                              fontWeight: 900,
                            }}
                          >
                            {source.icon}
                            {sourceLabel(lecture.source_type)}
                          </span>
                        </td>
                        <td style={{ ...bodyCellStyle, fontWeight: 600 }}>
                          <div title={lecture.title || "Untitled lecture"} style={truncateStyle}>
                            {lecture.title || "Untitled lecture"}
                          </div>
                        </td>
                        <td style={bodyCellStyle}>
                          <div title={lecture.owner_name || "Unknown"} style={{ ...truncateStyle, fontWeight: 500 }}>
                            {lecture.owner_name || "Unknown"}
                          </div>
                        </td>
                        <td style={bodyCellStyle}>
                          <div title={compactGenre(lecture.genre_label)} style={truncateStyle}>
                            {compactGenre(lecture.genre_label)}
                          </div>
                        </td>
                        <td style={bodyCellStyle}>
                          <span
                            style={{
                              display: "inline-flex",
                              padding: "0.35rem 0.55rem",
                              borderRadius: "999px",
                              border: `1px solid ${status.border}`,
                              background: status.background,
                              color: status.color,
                              fontSize: "0.74rem",
                              fontWeight: 700,
                              textTransform: "uppercase",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatStatus(lecture.status)}
                          </span>
                        </td>
                        <td style={{ ...bodyCellStyle, color: scoreTone(lecture.valuation_score), fontWeight: 700 }}>
                          {formatScore(lecture.valuation_score)}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={7}
                            style={{
                              padding: "0.85rem 1rem 1rem 3.7rem",
                              borderTop: "1px solid var(--border)",
                              background: "rgba(148, 163, 184, 0.08)",
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                gap: "0.8rem",
                                color: "var(--text)",
                                fontSize: "0.9rem",
                              }}
                            >
                              <div>
                                <div style={{ color: "var(--text-muted)", fontSize: "0.74rem", fontWeight: 900, textTransform: "uppercase" }}>Source Link</div>
                                <div style={{ marginTop: "0.25rem", overflowWrap: "anywhere" }}>
                                  {sourceHref ? (
                                    <a
                                      href={sourceHref}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: "var(--primary-color)", fontWeight: 900 }}
                                    >
                                      Link <FaExternalLinkAlt size={11} />
                                    </a>
                                  ) : (
                                    <span style={{ color: "var(--text-muted)", fontWeight: 800 }}>Uploaded</span>
                                  )}
                                </div>
                              </div>
                              <div>
                                <div style={{ color: "var(--text-muted)", fontSize: "0.74rem", fontWeight: 900, textTransform: "uppercase" }}>Date</div>
                                <div style={{ marginTop: "0.25rem", color: "var(--text-muted)" }}>{formatDate(date)}</div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
