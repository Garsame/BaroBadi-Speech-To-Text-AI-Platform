"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiUrl, authHeaders } from "@/lib/api";
import { 
  MdPeople, 
  MdSchool, 
  MdAdminPanelSettings, 
  MdOutlineOndemandVideo, 
  MdCheckCircle, 
  MdHourglassEmpty, 
  MdQueue, 
  MdErrorOutline, 
  MdLibraryBooks, 
  MdTimer,
  MdCloudUpload
} from 'react-icons/md';
import { FaRocket } from 'react-icons/fa';

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
  translucentBg: string;
  icon: React.ReactNode;
  context: string;
  link: string;
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
    return { background: "var(--primary-translucent)", color: "var(--primary-color)" };
  }
  if (normalized.includes("fail") || normalized.includes("error")) {
    return { background: "var(--primary-hover-translucent)", color: "var(--primary-hover)" };
  }
  if (normalized.includes("cancel")) {
    return { background: "var(--admin-surface-soft)", color: "var(--text-color)" };
  }
  return { background: "var(--primary-hover-translucent)", color: "var(--primary-hover)" };
}

function labelFromStage(label: string): string {
  return label.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sourceLabel(sourceType?: string | null): string {
  if (!sourceType) return "Unknown";
  return sourceType.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function HorizontalBarChart({ data }: { data: ChartDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  const getStatusColor = (label: string) => {
    const norm = label.toLowerCase();
    if (norm.includes("success")) return "#10b981"; // Emerald green
    if (norm.includes("running")) return "#0ea5e9"; // Sky blue
    if (norm.includes("pending")) return "#f59e0b"; // Amber yellow
    if (norm.includes("error") || norm.includes("fail")) return "#ef4444"; // Red
    return "#64748b"; // Slate gray
  };

  const radius = 36;
  const circumference = 2 * Math.PI * radius; // ~226.19
  const strokeWidth = 8;
  const size = 100;
  const center = size / 2;

  let currentOffset = 0;
  const segments = data.map((item) => {
    const percentage = total > 0 ? item.value / total : 0;
    const strokeDasharray = `${percentage * circumference} ${circumference}`;
    const strokeDashoffset = -currentOffset;
    currentOffset += percentage * circumference;
    return {
      ...item,
      strokeDasharray,
      strokeDashoffset,
      percentage: Math.round(percentage * 100),
      color: getStatusColor(item.label),
    };
  });

  return (
    <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap", padding: "0.5rem 0" }}>
      <div style={{ position: "relative", width: "120px", height: "120px", flexShrink: 0 }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          {segments.map((segment) => (
            <circle
              key={segment.label}
              cx={center}
              cy={center}
              r={radius}
              fill="transparent"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={segment.strokeDasharray}
              strokeDashoffset={segment.strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          ))}
        </svg>
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
          <span style={{ fontSize: "1.2rem", fontWeight: "500", color: "var(--text-color)" }}>
            {formatNumber(total)}
          </span>
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {total === 1 ? "Job" : "Jobs"}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: "180px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {segments.map((item) => (
          <div key={item.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-color)" }}>
              <i style={{
                display: "inline-block",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: item.color,
              }} />
              {item.label}
            </span>
            <span style={{ fontWeight: "500", color: "var(--text-color)" }}>
              {formatNumber(item.value)} <span style={{ fontWeight: "normal", color: "var(--text-muted)", fontSize: "0.78rem" }}>({item.percentage}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyTrendChart({ data }: { data: WeeklyTrend[] }) {
  const series: Array<{
    key: keyof Pick<WeeklyTrend, "submitted" | "completed" | "failed">;
    label: string;
    color: string;
  }> = [
    { key: "submitted", label: "Submitted", color: "#0ea5e9" },
    { key: "completed", label: "Completed", color: "#10b981" },
    { key: "failed", label: "Failed", color: "#ef4444" },
  ];

  const maxValue = Math.max(
    1,
    ...data.flatMap((item) => [item.submitted, item.completed, item.failed]),
  );

  const totals = series.map((item) => ({
    ...item,
    value: data.reduce((sum, day) => sum + day[item.key], 0),
  }));

  const width = 500;
  const height = 200;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 15;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;
  const gridTicks = 4;

  const gridLines = React.useMemo(() => {
    if (maxValue <= 4) {
      return Array.from({ length: maxValue + 1 }).map((_, i) => {
        const value = i;
        const ratio = value / maxValue;
        const y = paddingTop + chartHeight * (1 - ratio);
        return { y, value };
      });
    } else {
      return Array.from({ length: gridTicks + 1 }).map((_, i) => {
        const ratio = i / gridTicks;
        const y = paddingTop + chartHeight * (1 - ratio);
        const value = Math.round(ratio * maxValue);
        return { y, value };
      });
    }
  }, [maxValue, chartHeight, paddingTop]);

  const groupWidthRatio = 0.7;
  const dayWidth = chartWidth / data.length;
  const barWidth = (dayWidth * groupWidthRatio) / series.length;

  return (
    <div>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
        {totals.map((item) => (
          <div key={item.key} style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.85rem" }}>
            <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: item.color }} />
            <span style={{ color: "var(--text-muted)" }}>{item.label}:</span>
            <strong style={{ color: "var(--text-color)", fontWeight: "500" }}>{formatNumber(item.value)}</strong>
          </div>
        ))}
      </div>

      <div style={{ position: "relative", width: "100%", height: `${height}px` }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          {gridLines.map((line, i) => (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={line.y}
                x2={width - paddingRight}
                y2={line.y}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.6}
              />
              <text
                x={paddingLeft - 8}
                y={line.y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-muted)"
              >
                {line.value}
              </text>
            </g>
          ))}

          {data.map((day, dayIndex) => {
            const dayX = paddingLeft + dayIndex * dayWidth;
            const groupX = dayX + (dayWidth * (1 - groupWidthRatio)) / 2;

            return (
              <g key={day.date}>
                {series.map((serie, serieIndex) => {
                  const value = day[serie.key];
                  const barHeight = (value / maxValue) * chartHeight;
                  const x = groupX + serieIndex * barWidth;
                  const y = paddingTop + chartHeight - barHeight;

                  return (
                    <rect
                      key={serie.key}
                      x={x}
                      y={y}
                      width={barWidth - 2}
                      height={Math.max(barHeight, 1)}
                      fill={serie.color}
                      rx={2}
                      ry={2}
                    >
                      <title>{`${day.date}: ${serie.label} = ${value}`}</title>
                    </rect>
                  );
                })}

                <text
                  x={dayX + dayWidth / 2}
                  y={height - 10}
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="var(--text-muted)"
                >
                  {new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </text>
              </g>
            );
          })}
        </svg>
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
      { label: "Total Users", value: formatNumber(stats.total_users), accent: "var(--primary-color)", translucentBg: "var(--primary-translucent)", icon: <MdPeople size={22} />, context: `${formatNumber(stats.active_users)} active accounts`, link: "/admin/users" },
      { label: "Learners", value: formatNumber(stats.learner_users), accent: "var(--primary-hover)", translucentBg: "var(--primary-hover-translucent)", icon: <MdSchool size={22} />, context: `${formatNumber(stats.new_users_7d)} joined in 7 days`, link: "/admin/users" },
      { label: "Administrators", value: formatNumber(stats.admin_users), accent: "var(--primary-color)", translucentBg: "var(--primary-translucent)", icon: <MdAdminPanelSettings size={22} />, context: "Portal operators", link: "/admin/users" },
      { label: "Total Lectures", value: formatNumber(stats.total_lectures), accent: "var(--primary-hover)", translucentBg: "var(--primary-hover-translucent)", icon: <MdOutlineOndemandVideo size={22} />, context: `${formatNumber(stats.lectures_7d)} submitted in 7 days`, link: "/admin/lectures" },
      { label: "Completed Lectures", value: formatNumber(stats.completed_processing), accent: "var(--primary-color)", translucentBg: "var(--primary-translucent)", icon: <MdCheckCircle size={22} />, context: "Ready for users", link: "/admin/lectures" },
      { label: "Currently Processing", value: formatNumber(stats.processing_lectures), accent: "var(--primary-hover)", translucentBg: "var(--primary-hover-translucent)", icon: <MdHourglassEmpty size={22} />, context: `${formatNumber(stats.running_jobs)} active jobs`, link: "/admin/lectures" },
      { label: "Pending Lectures", value: formatNumber(stats.submitted_lectures), accent: "var(--primary-hover)", translucentBg: "var(--primary-hover-translucent)", icon: <MdQueue size={22} />, context: `${formatNumber(stats.pending_jobs)} jobs waiting`, link: "/admin/lectures" },
      { label: "Failed Lectures", value: formatNumber(stats.failed_processing), accent: "var(--primary-color)", translucentBg: "var(--primary-translucent)", icon: <MdErrorOutline size={22} />, context: "Need admin review", link: "/admin/lectures" },
      { label: "Notes Generated", value: formatNumber(stats.total_notes), accent: "var(--primary-color)", translucentBg: "var(--primary-translucent)", icon: <MdLibraryBooks size={22} />, context: `${formatPercent(stats.note_conversion_rate)} note conversion`, link: "/admin/lectures" },
      { label: "Pipeline Success", value: formatPercent(stats.automation_success_rate), accent: "var(--primary-hover)", translucentBg: "var(--primary-hover-translucent)", icon: <FaRocket size={20} />, context: `${formatNumber(stats.completed_jobs_7d)} jobs completed in 7 days`, link: "/admin/jobs" },
      { label: "Average Job Time", value: formatDuration(stats.average_job_seconds), accent: "var(--primary-hover)", translucentBg: "var(--primary-hover-translucent)", icon: <MdTimer size={22} />, context: "Completed job average", link: "/admin/jobs" },
      { label: "Source Mix", value: `${formatNumber(stats.youtube_lectures)} / ${formatNumber(stats.uploaded_lectures)}`, accent: "var(--primary-color)", translucentBg: "var(--primary-translucent)", icon: <MdCloudUpload size={22} />, context: "YouTube / uploads", link: "/admin/lectures" },
    ];
  }, [stats]);

  if (loading || !stats) {
    return <div style={{ opacity: 0.5 }}>Loading system intelligence...</div>;
  }

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <span className="admin-page-kicker">Admin intelligence</span>
          <h1 className="admin-page-title">System Overview</h1>
          <p className="admin-page-lede">
            Operational health, workload, users, lecture generation, and job performance.
          </p>
        </div>
        <div className="admin-chart-pill">
          Updated {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.95rem", marginBottom: "1.35rem" }}>
        {metrics.map((metric) => (
          <Link
            key={metric.label}
            href={metric.link}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            <div 
              className="admin-card admin-stat-card card-lift"
              style={{
                "--stat-accent": metric.accent,
                "--stat-bg": metric.translucentBg,
                cursor: "pointer",
              } as React.CSSProperties}
            >
              <div className="admin-stat-main">
                <div>
                  <div className="admin-stat-value">{metric.value}</div>
                  <div className="admin-stat-title">{metric.label}</div>
                </div>
                <div className="admin-stat-icon">
                  {metric.icon}
                </div>
              </div>

              <div className="admin-stat-divider" />

              <div className="admin-stat-footer">
                <span>{metric.context}</span>
                <span className="admin-stat-action" style={{ cursor: "pointer" }}>View</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem", marginBottom: "1.5rem" }}>
        <section className="admin-card admin-chart-card">
          <div className="admin-chart-head">
            <div>
              <h2 className="admin-panel-title">7-Day Workload Trend</h2>
              <p className="admin-panel-copy">Submitted lectures versus completed and failed jobs.</p>
            </div>
            <span className="admin-chart-pill">7 days</span>
          </div>
          <WeeklyTrendChart data={stats.weekly_trend} />
        </section>

        <section className="admin-card admin-chart-card">
          <div className="admin-chart-head">
            <div>
              <h2 className="admin-panel-title">Job Outcome Distribution</h2>
              <p className="admin-panel-copy">Cleared jobs, active work, and failure risk.</p>
            </div>
            <span className="admin-chart-pill">{formatNumber(stats.total_jobs)} jobs</span>
          </div>
          <HorizontalBarChart data={stats.job_status_breakdown} />
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1.5rem" }}>
        <section className="admin-card admin-chart-card">
          <div className="admin-chart-head">
            <div>
              <h2 className="admin-panel-title">Processing Signals</h2>
              <p className="admin-panel-copy">Source mix and currently active pipeline stages.</p>
            </div>
          </div>
          <div className="admin-signal-list">
            <div className="admin-signal-row">
              <header>
                <strong>YouTube lectures</strong>
                <span>{formatNumber(stats.youtube_lectures)}</span>
              </header>
              <div className="admin-progress-track">
                <div className="admin-progress-fill" style={{ width: `${stats.total_lectures ? (stats.youtube_lectures / stats.total_lectures) * 100 : 0}%`, background: "var(--primary-color)" }} />
              </div>
            </div>
            <div className="admin-signal-row">
              <header>
                <strong>Uploaded lectures</strong>
                <span>{formatNumber(stats.uploaded_lectures)}</span>
              </header>
              <div className="admin-progress-track">
                <div className="admin-progress-fill" style={{ width: `${stats.total_lectures ? (stats.uploaded_lectures / stats.total_lectures) * 100 : 0}%` }} />
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

        <section className="admin-card admin-lecture-panel">
          <div className="admin-lecture-head">
            <div>
              <h2 className="admin-panel-title">Lecture Overview</h2>
              <p className="admin-panel-copy">Latest generated and submitted lectures with owner and status.</p>
            </div>
            <span className="admin-chart-pill">{lectures.length} recent</span>
          </div>

          <div className="admin-lecture-list">
            {lectures.map((lecture, index) => {
              const tone = statusStyle(lecture.status);
              return (
                <article className="admin-lecture-row" key={lecture.id}>
                  <span className="admin-lecture-index">{String(index + 1).padStart(2, "0")}</span>
                  <div className="admin-lecture-main">
                    <strong>{lecture.title || "Untitled lecture"}</strong>
                    <span>
                      {lecture.owner_name || "Unknown owner"} · {lecture.owner_email || "No email"}
                    </span>
                  </div>
                  <div className="admin-lecture-meta">
                    <span className="admin-source-pill">{sourceLabel(lecture.source_type)}</span>
                    <span className="admin-badge" style={{ background: tone.background, color: tone.color }}>
                      {lecture.status}
                    </span>
                    <time>{new Date(lecture.created_at).toLocaleString()}</time>
                  </div>
                </article>
              );
            })}
            {lectures.length === 0 && (
              <div className="admin-lecture-empty">No lectures have been submitted yet.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
