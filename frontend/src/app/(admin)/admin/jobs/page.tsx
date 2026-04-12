"use client";

import React from "react";

export default function AdminJobsPage() {
  const jobs = [
    {
      id: "101",
      lecture: "Physics 101",
      status: "running",
      stage: "transcribing",
      progress: 60,
    },
    {
      id: "102",
      lecture: "Math 202",
      status: "success",
      stage: "completed",
      progress: 100,
    },
    {
      id: "103",
      lecture: "Biology 303",
      status: "error",
      stage: "failed",
      progress: 20,
    },
  ];

  return (
    <div>
      <h1>Processing Jobs Monitoring</h1>
      <div className="card" style={{ marginTop: "2rem", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid var(--border-color)" }}>
              <th style={{ padding: "1rem" }}>Task ID</th>
              <th style={{ padding: "1rem" }}>Lecture</th>
              <th style={{ padding: "1rem" }}>Status</th>
              <th style={{ padding: "1rem" }}>Pipeline Stage</th>
              <th style={{ padding: "1rem" }}>Progress</th>
              <th style={{ padding: "1rem" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                <td style={{ padding: "1rem", fontFamily: "monospace" }}>#{job.id}</td>
                <td style={{ padding: "1rem" }}>{job.lecture}</td>
                <td style={{ padding: "1rem" }}>
                  <span
                    style={{
                      color:
                        job.status === "success"
                          ? "var(--success-color)"
                          : job.status === "running"
                            ? "var(--warning-color)"
                            : "var(--danger-color)",
                      fontWeight: 600,
                    }}
                  >
                    {job.status}
                  </span>
                </td>
                <td style={{ padding: "1rem" }}>{job.stage}</td>
                <td style={{ padding: "1rem" }}>
                  <div
                    style={{
                      background: "var(--border-color)",
                      height: "8px",
                      borderRadius: "4px",
                      width: "100px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        background: "var(--primary-color)",
                        height: "100%",
                        width: `${job.progress}%`,
                      }}
                    />
                  </div>
                </td>
                <td style={{ padding: "1rem" }}>
                  <button
                    className="btn"
                    style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                  >
                    Inspect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
