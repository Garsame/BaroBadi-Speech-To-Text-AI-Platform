"use client";

import React, { useEffect, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api';

interface AdminLecture {
  id: number;
  title?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  source_type?: string | null;
  status: string;
}

export default function LecturesPage() {
  const [lectures, setLectures] = useState<AdminLecture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLectures = async () => {
      try {
        const res = await fetch(apiUrl("/api/v1/admin/recent-lectures?limit=100"), { headers: authHeaders() });
        if (res.ok) setLectures(await res.json());
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchLectures();
  }, []);

  return (
      <div>
        <h1 style={{ marginBottom: "2rem", fontSize: "2rem" }}>Lecture Oversight</h1>
        <div className="admin-card" style={{ padding: "1.5rem" }}>
          {loading ? <p>Loading lectures...</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Title</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Owner Info</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Source</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {lectures.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                     <td style={{ padding: "1rem", fontWeight: "bold" }}>{l.title}</td>
                     <td style={{ padding: "1rem" }}>
                         <div>{l.owner_name}</div>
                         <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{l.owner_email}</div>
                     </td>
                     <td style={{ padding: "1rem" }}>{l.source_type}</td>
                     <td style={{ padding: "1rem" }}>{l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
  );
}
