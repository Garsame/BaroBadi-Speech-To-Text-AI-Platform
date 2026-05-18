"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiUrl, authHeaders } from "@/lib/api";

interface ChartDatum {
  label: string;
  value: number;
  color: string;
}

interface WeeklyTrend {
  date: string;
  submitted: number;
  completed: number;
  failed: number;
}

interface StageDatum {
  label: string;
  value: number;
}

interface AdminStats {
  total_users: number;
  active_users: number;
  admin_users: number;
  learner_users: number;
  new_users_7d: number;
  total_lectures: number;
  lectures_7d: number;
  total_notes: number;
  completed_processing: number;
  failed_processing: number;
  processing_lectures: number;
  submitted_lectures: number;
  canceled_lectures: number;
  youtube_lectures: number;
  uploaded_lectures: number;
  automation_success_rate: number;
  note_conversion_rate: number;
  total_jobs: number;
  pending_jobs: number;
  running_jobs: number;
  successful_jobs: number;
  errored_jobs: number;
  canceled_jobs: number;
  completed_jobs_7d: number;
  average_job_seconds: number;
  job_status_breakdown: ChartDatum[];
  lecture_source_breakdown: ChartDatum[];
  active_stage_breakdown: StageDatum[];
  weekly_trend: WeeklyTrend[];
}

interface AdminRecentLecture {
  id: number;
  title?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  source_type?: string | null;
  status: string;
  created_at: string;
}

interface MetricCard {
  label: string;
  value: string;
  accent: string;
  context: string;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number): string {
  return `${value}%`;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "0m";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${remainingSeconds}s`;
}

function statusStyle(status: string): { background: string; color: string } {
  const normalized = status.toLowerCase();
  if (normalized === "completed") {
    return { background: "rgba(16, 185, 129, 0.16)", color: "#059669" };
  }
  if (normalized.includes("fail") || normalized.includes("error")) {
    return { background: "rgba(239, 68, 68, 0.16)", color: "#dc2626" };
  }
  if (normalized.includes("cancel")) {
    return { background: "rgba(100, 116, 139, 0.16)", color: "#475569" };
  }
  return { background: "rgba(245, 158, 11, 0.18)", color: "#b45309" };
}

function labelFromStage(label: string): string {
  return label.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function HorizontalBarChart({ data }: { data: ChartDatum[] }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {data.map((item) => {
        const width = `${Math.max(4, (item.value / maxValue) * 100)}%`;
        const share = total > 0 ? Math.round((item.value / total) * 100) : 0;

        return (
          <div key={item.label}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "0.45rem" }}>
              <span style={{ color: "var(--text)", fontWeight: 700 }}>{item.label}</span>
              <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {formatNumber(item.value)} · {share}%
              </span>
            </div>
            <div style={{ height: "10px", borderRadius: "999px", background: "rgba(148, 163, 184, 0.18)", overflow: "hidden" }}>
              <div style={{ width, height: "100%", background: item.color, borderRadius: "999px" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeeklyTrendChart({ data }: { data: WeeklyTrend[] }) {
  const width = 720;
  const height = 260;
  const padding = { top: 24, right: 28, bottom: 42, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [item.submitted, item.completed, item.failed]),
  );

  const xFor = (index: number) =>
    padding.left + (data.length <= 1 ? chartWidth / 2 : (index / (data.length - 1)) * chartWidth);
  const yFor = (value: number) => padding.top + chartHeight - (value / maxValue) * chartHeight;
  const pointsFor = (key: keyof Pick<WeeklyTrend, "submitted" | "completed" | "failed">) =>
    data.map((item, index) => `${xFor(index)},${yFor(item[key])}`).join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Seven day lecture and job trend" style={{ minWidth: "620px", width: "100%" }}>
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + chartHeight - ratio * chartHeight;
          return (
            <g key={ratio}>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(148, 163, 184, 0.24)" />
              <text x={10} y={y + 4} fill="var(--text-muted)" fontSize="12">
                {Math.round(maxValue * ratio)}
              </text>
            </g>
          );
        })}
        <polyline fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={pointsFor("submitted")} />
        <polyline fill="none" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={pointsFor("completed")} />
        <polyline fill="none" stroke="#ef4444" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" points={pointsFor("failed")} />
        {data.map((item, index) => (
          <g key={item.date}>
            <circle cx={xFor(index)} cy={yFor(item.submitted)} r="4" fill="#38bdf8" />
            <circle cx={xFor(index)} cy={yFor(item.completed)} r="4" fill="#10b981" />
            <circle cx={xFor(index)} cy={yFor(item.failed)} r="4" fill="#ef4444" />
            <text x={xFor(index)} y={height - 14} fill="var(--text-muted)" fontSize="12" textAnchor="middle">
              {new Date(`${item.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginTop: "0.75rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
        <span><strong style={{ color: "#38bdf8" }}>●</strong> Submitted</span>
        <span><strong style={{ color: "#10b981" }}>●</strong> Completed</span>
        <span><strong style={{ color: "#ef4444" }}>●</strong> Failed</span>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [lectures, setLectures] = useState<AdminRecentLecture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [statsRes, lecturesRes] = await Promise.all([
          fetch(apiUrl("/api/v1/admin/stats"), { headers: authHeaders(), cache: "no-store" }),
          fetch(apiUrl("/api/v1/admin/recent-lectures?limit=10"), { headers: authHeaders(), cache: "no-store" }),
        ]);

        if (statsRes.ok) {
          setStats((await statsRes.json()) as AdminStats);
        }
        if (lecturesRes.ok) {
          setLectures((await lecturesRes.json()) as AdminRecentLecture[]);
        }
      } catch {
        console.error("Failed to load admin dashboard data");
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, []);

  const metrics = useMemo<MetricCard[]>(() => {
    if (!stats) return [];

    return [
      { label: "Total Users", value: formatNumber(stats.total_users), accent: "#2563eb", context: `${formatNumber(stats.active_users)} active accounts` },
      { label: "Learners", value: formatNumber(stats.learner_users), accent: "#38bdf8", context: `${formatNumber(stats.new_users_7d)} joined in 7 days` },
      { label: "Administrators", value: formatNumber(stats.admin_users), accent: "#7c3aed", context: "Portal operators" },
      { label: "Total Lectures", value: formatNumber(stats.total_lectures), accent: "#0891b2", context: `${formatNumber(stats.lectures_7d)} submitted in 7 days` },
      { label: "Completed Lectures", value: formatNumber(stats.completed_processing), accent: "#10b981", context: "Ready for users" },
      { label: "Currently Processing", value: formatNumber(stats.processing_lectures), accent: "#f59e0b", context: `${formatNumber(stats.running_jobs)} active jobs` },
      { label: "Pending Lectures", value: formatNumber(stats.submitted_lectures), accent: "#f97316", context: `${formatNumber(stats.pending_jobs)} jobs waiting` },
      { label: "Failed Lectures", value: formatNumber(stats.failed_processing), accent: "#ef4444", context: "Need admin review" },
      { label: "Notes Generated", value: formatNumber(stats.total_notes), accent: "#a855f7", context: `${formatPercent(stats.note_conversion_rate)} note conversion` },
      { label: "Pipeline Success", value: formatPercent(stats.automation_success_rate), accent: stats.automation_success_rate >= 90 ? "#10b981" : "#f59e0b", context: `${formatNumber(stats.completed_jobs_7d)} jobs completed in 7 days` },
      { label: "Average Job Time", value: formatDuration(stats.average_job_seconds), accent: "#0ea5e9", context: "Completed job average" },
      { label: "Source Mix", value: `${formatNumber(stats.youtube_lectures)} / ${formatNumber(stats.uploaded_lectures)}`, accent: "#db2777", context: "YouTube / uploads" },
    ];
  }, [stats]);

  if (loading || !stats) {
    return <div style={{ opacity: 0.5 }}>Loading system intelligence...</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "1rem", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "2rem" }}>System Overview</h1>
          <p style={{ margin: "0.5rem 0 0", color: "var(--text-muted)" }}>
            Operational health, workload, users, lecture generation, and job performance.
          </p>
        </div>
        <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", whiteSpace: "nowrap" }}>
          Updated {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        {metrics.map((metric) => (
          <div key={metric.label} className="admin-card" style={{ padding: "1.15rem", minHeight: "130px" }}>
            <div style={{ color: "var(--text-muted)", fontSize: "0.78rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>{metric.label}</div>
            <div style={{ fontSize: "2rem", fontWeight: 900, color: metric.accent, lineHeight: 1 }}>{metric.value}</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.86rem", marginTop: "0.75rem" }}>{metric.context}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <section className="admin-card" style={{ padding: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.25rem" }}>7-Day Workload Trend</h2>
              <p style={{ margin: "0.35rem 0 0", color: "var(--text-muted)" }}>Submitted lectures versus completed and failed jobs.</p>
            </div>
          </div>
          <WeeklyTrendChart data={stats.weekly_trend} />
        </section>

        <section className="admin-card" style={{ padding: "1.5rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Job Outcome Distribution</h2>
          <p style={{ margin: "0.35rem 0 1.25rem", color: "var(--text-muted)" }}>Shows whether the platform is clearing work or accumulating risk.</p>
          <HorizontalBarChart data={stats.job_status_breakdown} />
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        <section className="admin-card" style={{ padding: "1.5rem" }}>
          <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Processing Signals</h2>
          <div style={{ display: "grid", gap: "1rem", marginTop: "1.25rem" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.45rem", color: "var(--text)" }}>
                <strong>YouTube lectures</strong>
                <span>{formatNumber(stats.youtube_lectures)}</span>
              </div>
              <div style={{ height: "10px", borderRadius: "999px", background: "rgba(148, 163, 184, 0.18)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${stats.total_lectures ? (stats.youtube_lectures / stats.total_lectures) * 100 : 0}%`, background: "#ef4444" }} />
              </div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.45rem", color: "var(--text)" }}>
                <strong>Uploaded lectures</strong>
                <span>{formatNumber(stats.uploaded_lectures)}</span>
              </div>
              <div style={{ height: "10px", borderRadius: "999px", background: "rgba(148, 163, 184, 0.18)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${stats.total_lectures ? (stats.uploaded_lectures / stats.total_lectures) * 100 : 0}%`, background: "#38bdf8" }} />
              </div>
            </div>
            <div style={{ paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
              <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", fontWeight: 800, textTransform: "uppercase", marginBottom: "0.75rem" }}>Active Job Stages</div>
              {stats.active_stage_breakdown.length === 0 ? (
                <div style={{ color: "var(--text-muted)" }}>No jobs are running right now.</div>
              ) : (
                stats.active_stage_breakdown.map((stage) => (
                  <div key={stage.label} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", padding: "0.5rem 0", color: "var(--text)" }}>
                    <span>{labelFromStage(stage.label)}</span>
                    <strong>{formatNumber(stage.value)}</strong>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="admin-card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "1.5rem 1.5rem 0" }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem" }}>Lecture Overview</h2>
            <p style={{ margin: "0.35rem 0 1rem", color: "var(--text-muted)" }}>Latest generated and submitted lectures with owner and status.</p>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "1rem 1.5rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>Lecture</th>
                  <th style={{ padding: "1rem 1.5rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>Owner</th>
                  <th style={{ padding: "1rem 1.5rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>Source</th>
                  <th style={{ padding: "1rem 1.5rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>Status</th>
                  <th style={{ padding: "1rem 1.5rem", color: "var(--text-muted)", fontSize: "0.85rem" }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {lectures.map((lecture) => {
                  const tone = statusStyle(lecture.status);
                  return (
                    <tr key={lecture.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "1rem 1.5rem", fontWeight: 700, color: "var(--text)", minWidth: "220px" }}>{lecture.title || "Untitled"}</td>
                      <td style={{ padding: "1rem 1.5rem", minWidth: "190px" }}>
                        <div style={{ color: "var(--text)", fontWeight: 700 }}>{lecture.owner_name || "Unknown"}</div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{lecture.owner_email || "Unknown"}</div>
                      </td>
                      <td style={{ padding: "1rem 1.5rem", color: "var(--text)" }}>{lecture.source_type || "Unknown"}</td>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <span style={{ padding: "4px 10px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", background: tone.background, color: tone.color }}>
                          {lecture.status}
                        </span>
                      </td>
                      <td style={{ padding: "1rem 1.5rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{new Date(lecture.created_at).toLocaleString()}</td>
                    </tr>
                  );
                })}
                {lectures.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>No lectures have been submitted yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
