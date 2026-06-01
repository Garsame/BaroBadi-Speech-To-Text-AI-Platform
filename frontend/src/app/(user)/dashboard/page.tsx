"use client";

import React, { useEffect, useState } from 'react';
import { apiUrl, authHeaders, fetchCurrentUser, type AuthenticatedUser } from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import { MdDashboard, MdPeople, MdOutlineOndemandVideo, MdLibraryBooks, MdAddCircleOutline, MdSettings, MdLogout, MdNotifications, MdLightMode, MdDarkMode, MdKeyboardArrowDown, MdBuild, MdMenuBook, MdAutoAwesome, MdSchool, MdAdd } from 'react-icons/md';
import { FaCheckCircle, FaRocket, FaExclamationTriangle, FaYoutube, FaFileAudio, FaTools } from 'react-icons/fa';
import Link from 'next/link';

interface Lecture {
  id: number;
  title: string;
  source_type: string;
  status: string;
  created_at: string;
}

export default function UserDashboard() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = getSessionToken();
        if (token) {
          try {
            const currentUser = await fetchCurrentUser(token);
            setUser(currentUser);
          } catch (err) {
            console.error("Failed to fetch current user", err);
          }
        }

        const res = await fetch(apiUrl('/api/v1/lectures/'), {
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setLectures(data);
        }
      } catch (error) {
        console.error("Failed to fetch lectures", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const completedCount = lectures.filter(l => l.status === 'completed').length;
  const processingCount = lectures.filter(l => l.status === 'processing' || l.status === 'submitted').length;
  const failedCount = lectures.filter(l => l.status === 'failed').length;

  return (
    <div className="fade-in">
      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .stat-card-custom {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 1.5rem;
          border-radius: 16px;
          background: var(--secondary-bg);
          border: 1px solid var(--border-color);
          box-shadow: var(--card-shadow);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .stat-card-custom:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 20px rgba(0,0,0,0.06);
        }

        .stat-card-glow-1 {
          border-left: 5px solid var(--primary-color);
        }

        .stat-card-glow-2 {
          border-left: 5px solid var(--success-color);
        }

        .stat-card-glow-3 {
          border-left: 5px solid var(--warning-color);
        }

        .stat-icon-custom {
          width: 54px;
          height: 54px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .uploads-card {
          background-color: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 2rem;
          box-shadow: var(--card-shadow);
        }

        .lecture-list-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .lecture-item-card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.5rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background: var(--bg-color);
          transition: all 0.2s ease;
          text-decoration: none;
          color: inherit;
        }

        .lecture-item-card:hover {
          transform: translateY(-2px);
          border-color: var(--primary-color);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
        }

        .lecture-item-info {
          display: flex;
          align-items: center;
          gap: 1rem;
          min-width: 0;
        }

        .lecture-item-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: var(--secondary-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .lecture-item-details {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .lecture-item-details h4 {
          margin: 0;
          font-weight: 600;
          font-size: 1.05rem;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .uploads-card {
            padding: 1.25rem 1rem;
          }

          .lecture-item-card {
            flex-direction: column;
            align-items: stretch;
            gap: 1rem;
            padding: 1rem;
          }

          .lecture-item-info {
            align-items: flex-start;
          }

          .lecture-item-details h4 {
            font-size: 0.95rem;
            white-space: normal;
            overflow: visible;
            text-overflow: clip;
          }

          .status-badge {
            align-self: flex-start;
            text-align: center;
            width: 100%;
          }
        }
      `}</style>

      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Welcome back, {user?.full_name || "User"} 👋
        </h1>
        <p style={{ opacity: 0.7, fontSize: "1.1rem" }}>Here is an overview of your recent learning activities.</p>
      </div>
      
      <div className="stats-grid">
        <div className="stat-card-custom stat-card-glow-1">
          <div className="stat-icon-custom" style={{ background: "rgba(99, 102, 241, 0.1)", color: "var(--primary-color)" }}><MdLibraryBooks size={24} /></div>
          <div>
            <h3 style={{ opacity: 0.7, fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", margin: "0 0 4px 0" }}>Total Lectures</h3>
            <p style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>{lectures.length}</p>
          </div>
        </div>
        
        <div className="stat-card-custom stat-card-glow-2">
          <div className="stat-icon-custom" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}><MdAutoAwesome size={24} /></div>
          <div>
            <h3 style={{ opacity: 0.7, fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", margin: "0 0 4px 0" }}>Completed Notes</h3>
            <p style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>{completedCount}</p>
          </div>
        </div>
        
        <div className="stat-card-custom stat-card-glow-3">
          <div className="stat-icon-custom" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}><MdSettings size={24} /></div>
          <div>
            <h3 style={{ opacity: 0.7, fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase", margin: "0 0 4px 0" }}>Processing</h3>
            <p style={{ fontSize: '2.2rem', fontWeight: 800, margin: 0 }}>{processingCount}</p>
          </div>
        </div>
      </div>
      
      <div className="uploads-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
          <h2 style={{ fontWeight: 700, margin: 0 }}>Recent Uploads</h2>
          <Link href="/dashboard/new-lecture" className="btn" style={{ padding: "0.6rem 1.2rem", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
            <span><MdAddCircleOutline size={20} /></span> Process New Lecture
          </Link>
        </div>

        {isLoading ? (
          <div style={{ padding: "3rem 0", textAlign: "center", opacity: 0.6 }}>Loading data...</div>
        ) : lectures.length === 0 ? (
          <div style={{ padding: "4rem 2rem", textAlign: "center", background: "rgba(0,0,0,0.02)", borderRadius: "12px", border: "1px dashed var(--border-color)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}><MdSchool size={64} style={{color: "var(--primary-color)"}} /></div>
            <h3 style={{ marginBottom: "0.5rem", margin: 0 }}>No lectures processed yet</h3>
            <p style={{ opacity: 0.7, marginBottom: "1.5rem", marginTop: "0.5rem" }}>Upload a video or YouTube link to magically generate Somali study notes.</p>
          </div>
        ) : (
          <div className="lecture-list-container">
            {lectures.slice(0, 5).map((lecture) => (
              <Link href={`/dashboard/lecture/${lecture.id}`} key={lecture.id} className="lecture-item-card">
                <div className="lecture-item-info">
                  <div className="lecture-item-icon">
                    {lecture.source_type === 'youtube' ? <FaYoutube size={26} color="#ef4444" /> : <FaFileAudio size={26} color="#8b5cf6" />}
                  </div>
                  <div className="lecture-item-details">
                    <h4>{lecture.title || "Untitled Lecture"}</h4>
                    <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>{new Date(lecture.created_at).toLocaleDateString()} • {lecture.source_type}</span>
                  </div>
                </div>
                <div className={`status-badge status-${lecture.status.toLowerCase()}`} style={{ flexShrink: 0 }}>
                  {lecture.status}
                </div>
              </Link>
            ))}
            {lectures.length > 5 && (
              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                 <Link href="/dashboard/my-lectures" style={{ color: "var(--primary-color)", fontWeight: 600, fontSize: "0.9rem", textDecoration: "none" }}>View all {lectures.length} lectures →</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
