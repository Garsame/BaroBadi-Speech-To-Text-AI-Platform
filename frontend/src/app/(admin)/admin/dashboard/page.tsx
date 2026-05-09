"use client";

import React, { useEffect, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api';

interface AdminStats {
  total_users: number;
  total_lectures: number;
  total_notes: number;
  automation_success_rate: number;
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

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [lectures, setLectures] = useState<AdminRecentLecture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const [statsRes, lecturesRes] = await Promise.all([
          fetch(apiUrl("/api/v1/admin/stats"), { headers: authHeaders() }),
          fetch(apiUrl("/api/v1/admin/recent-lectures?limit=10"), { headers: authHeaders() })
        ]);

        if (statsRes.ok && lecturesRes.ok) {
          setStats(await statsRes.json());
          setLectures(await lecturesRes.json());
        }
      } catch {
        console.error("Failed to load admin data");
      } finally {
        setLoading(false);
      }
    };
    fetchAdminData();
  }, []);

  if (loading || !stats) {
    return <div style={{ opacity: 0.5 }}>Loading global system matrix...</div>;
  }

  return (
    <div>
      <h1 style={{ marginBottom: "2rem", fontSize: "2rem" }}>System Overview</h1>
      
      {/* High Level Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", marginBottom: "3rem" }}>
        
        <div className="admin-card" style={{ padding: "1.5rem" }}>
           <h3 style={{ color: "var(--text-muted)", fontSize: "0.9rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>Total Platform Users</h3>
           <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "var(--text)" }}>{stats.total_users}</div>
        </div>
        
        <div className="admin-card" style={{ padding: "1.5rem" }}>
           <h3 style={{ color: "var(--text-muted)", fontSize: "0.9rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>Lectures Processed</h3>
           <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#38bdf8" }}>{stats.total_lectures}</div>
        </div>
        
        <div className="admin-card" style={{ padding: "1.5rem" }}>
           <h3 style={{ color: "var(--text-muted)", fontSize: "0.9rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>Notes Generated</h3>
           <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: "#a855f7" }}>{stats.total_notes}</div>
        </div>

        <div className="admin-card" style={{ padding: "1.5rem" }}>
           <h3 style={{ color: "var(--text-muted)", fontSize: "0.9rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>Pipeline Success Rate</h3>
           <div style={{ fontSize: "2.5rem", fontWeight: "bold", color: stats.automation_success_rate > 90 ? "#10b981" : "#f59e0b" }}>{stats.automation_success_rate}%</div>
        </div>

      </div>

      {/* Global Lecture Stream */}
      <h2 style={{ marginBottom: "1rem", fontSize: "1.5rem" }}>Global Processing Stream (Live)</h2>
      <div className="admin-card" style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "1rem 1.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Lecture Title</th>
              <th style={{ padding: "1rem 1.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Owner</th>
              <th style={{ padding: "1rem 1.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Type</th>
              <th style={{ padding: "1rem 1.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Status</th>
              <th style={{ padding: "1rem 1.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {lectures.map((l) => (
              <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "1rem 1.5rem", fontWeight: 600, color: "var(--text)" }}>{l.title || "Untitled"}</td>
                <td style={{ padding: "1rem 1.5rem" }}>
                  <div style={{ color: "var(--text)", fontWeight: "bold" }}>{l.owner_name}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{l.owner_email}</div>
                </td>
                <td style={{ padding: "1rem 1.5rem", color: "var(--text)" }}>{l.source_type || "Unknown"}</td>
                <td style={{ padding: "1rem 1.5rem" }}>
                   <span style={{ 
                      padding: "4px 8px", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "bold", textTransform: "uppercase",
                      background: l.status === "completed" ? "rgba(16, 185, 129, 0.2)" : l.status.includes("fail") ? "rgba(239, 68, 68, 0.2)" : "rgba(245, 158, 11, 0.2)",
                      color: l.status === "completed" ? "#10b981" : l.status.includes("fail") ? "#ef4444" : "#f59e0b"
                   }}>
                     {l.status}
                   </span>
                </td>
                <td style={{ padding: "1rem 1.5rem", color: "var(--text-muted)" }}>{new Date(l.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {lectures.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>No lectures have been processed in the system yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
