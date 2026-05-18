"use client";

import React, { useEffect, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api';

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
    return { background: "rgba(56,189,248,0.16)", color: "#0284c7" };
  }
  if (eventType.includes("SIGNUP")) {
    return { background: "rgba(16,185,129,0.16)", color: "#059669" };
  }
  return { background: "rgba(168,85,247,0.16)", color: "#7c3aed" };
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
        <h1 style={{ marginBottom: "2rem", fontSize: "2rem" }}>System Logs</h1>
        <div className="admin-card" style={{ padding: "1.5rem" }}>
          {loading ? <p>Loading logs...</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Time</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Event</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>User / Admin</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                   <tr><td colSpan={4} style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)" }}>No recent system entries yet.</td></tr>
                )}
                {logs.map((log) => {
                  const colors = eventColor(log.event_type);
                  return (
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                     <td style={{ padding: "1rem", whiteSpace: "nowrap", color: "var(--text)" }}>{new Date(log.created_at).toLocaleString()}</td>
                     <td style={{ padding: "1rem" }}>
                        <span style={{
                            background: colors.background,
                            color: colors.color,
                            padding: "4px 10px",
                            borderRadius: "12px",
                            fontSize: "0.8rem",
                            fontWeight: "bold",
                            whiteSpace: "nowrap",
                        }}>{eventLabel(log.event_type)}</span>
                     </td>
                     <td style={{ padding: "1rem" }}>
                        <div style={{ color: "var(--text)", fontWeight: 700 }}>{log.actor_name || "Unknown"}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{log.actor_email || "Unknown"}</div>
                     </td>
                     <td style={{ padding: "1rem", color: "var(--text)" }}>
                        {log.event_type === "LECTURE_GENERATED"
                          ? `Generated "${log.lecture_title || "Untitled lecture"}"`
                          : log.message}
                     </td>
                  </tr>
                )})}
              </tbody>
            </table>
          )}
        </div>
      </div>
  );
}
