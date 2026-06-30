"use client";

import React, { useEffect, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api';
import { MdArticle, MdAutoAwesome, MdEventNote, MdLogin, MdPersonAddAlt1 } from 'react-icons/md';

interface SystemLog {
  id: string;
  created_at: string;
  level: string;
  event_type: string;
  message: string;
  actor_name?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;
  lecture_title?: string | null;
}

function eventLabel(eventType: string): string {
  switch (eventType) {
    case "ADMIN_LOGIN":
      return "Admin Login";
    case "USER_LOGIN":
      return "User Login";
    case "ADMIN_SIGNUP":
      return "Admin Signup";
    case "USER_SIGNUP":
      return "User Signup";
    case "LECTURE_GENERATED":
      return "Lecture Generated";
    default:
      return "System Entry";
  }
}

function eventColor(eventType: string): { background: string; color: string } {
  if (eventType === "LECTURE_GENERATED") {
    return { background: "var(--primary-translucent)", color: "var(--primary-color)" };
  }
  if (eventType.includes("SIGNUP")) {
    return { background: "var(--primary-hover-translucent)", color: "var(--primary-hover)" };
  }
  return { background: "var(--primary-translucent)", color: "var(--primary-color)" };
}

function eventIcon(eventType: string): React.ReactNode {
  if (eventType === "LECTURE_GENERATED") return <MdAutoAwesome size={21} />;
  if (eventType.includes("SIGNUP")) return <MdPersonAddAlt1 size={21} />;
  if (eventType.includes("LOGIN")) return <MdLogin size={21} />;
  if (eventType.includes("LECTURE")) return <MdArticle size={21} />;
  return <MdEventNote size={21} />;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(apiUrl("/api/v1/admin/system-logs"), { headers: authHeaders() });
        if (res.ok) setLogs(await res.json());
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
      <div>
        <div className="admin-page-header">
          <div>
            <span className="admin-page-kicker">Audit trail</span>
            <h1 className="admin-page-title">System Logs</h1>
            <p className="admin-page-lede">
              Recent sign-ins, account activity, lecture generation, and system entries.
            </p>
          </div>
          <span className="admin-chart-pill">{logs.length} entries</span>
        </div>
        <div className="admin-card admin-table-shell">
          {loading ? <p style={{ padding: "1.5rem", color: "var(--text-muted)" }}>Loading logs...</p> : (
            <div className="admin-log-timeline">
              {logs.length === 0 && (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>No recent system entries yet.</div>
              )}
              {logs.map((log) => {
                const colors = eventColor(log.event_type);
                const message = log.event_type === "LECTURE_GENERATED"
                  ? `Generated "${log.lecture_title || "Untitled lecture"}"`
                  : log.message;

                return (
                  <article
                    className="admin-log-entry"
                    key={log.id}
                    style={{ "--log-color": colors.color } as React.CSSProperties}
                  >
                    <span className="admin-log-icon">{eventIcon(log.event_type)}</span>
                    <div className="admin-log-content">
                      <div className="admin-log-topline">
                        <div className="admin-log-title">
                          <strong>{eventLabel(log.event_type)}</strong>
                          <span className="admin-badge" style={{ background: colors.background, color: colors.color }}>
                            {log.level || "Info"}
                          </span>
                        </div>
                        <time className="admin-log-time">{new Date(log.created_at).toLocaleString()}</time>
                      </div>
                      <div className="admin-log-message">{message}</div>
                      <div className="admin-log-meta">
                        <span>{log.actor_name || "Unknown actor"}</span>
                        <span>{log.actor_email || "No email"}</span>
                        {log.actor_role && <span>{log.actor_role}</span>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
  );
}
