"use client";

import React, { useEffect, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api';

export default function LogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch(apiUrl("/api/v1/admin/system-logs"), { headers: authHeaders() });
        if (res.ok) setLogs(await res.json());
      } catch (err) {} finally {
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
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Level</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Message</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                   <tr><td colSpan={3} style={{ padding: "1rem", textAlign: "center", color: "var(--text-muted)" }}>No system logs available yet.</td></tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border)", opacity: log.level === "ERROR" ? 1 : 0.8 }}>
                     <td style={{ padding: "1rem", whiteSpace: "nowrap" }}>{new Date(log.created_at).toLocaleString()}</td>
                     <td style={{ padding: "1rem" }}>
                        <span style={{ 
                            background: log.level === "ERROR" ? "rgba(239,68,68,0.2)" : log.level === "WARNING" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)", 
                            color: log.level === "ERROR" ? "#ef4444" : log.level === "WARNING" ? "#f59e0b" : "#10b981", 
                            padding: "4px 8px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold" 
                        }}>{log.level}</span>
                     </td>
                     <td style={{ padding: "1rem", color: "var(--text)" }}>{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
  );
}
