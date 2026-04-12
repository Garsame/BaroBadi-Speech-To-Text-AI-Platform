"use client";

import React, { useEffect, useState } from 'react';
import { apiUrl, authHeaders } from "@/lib/api";
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

  useEffect(() => {
    const fetchLectures = async () => {
      try {
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
    fetchLectures();
  }, []);

  const completedCount = lectures.filter(l => l.status === 'completed').length;
  const processingCount = lectures.filter(l => l.status === 'processing' || l.status === 'submitted').length;
  const failedCount = lectures.filter(l => l.status === 'failed').length;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ opacity: 0.7, fontSize: "1.1rem" }}>Here is an overview of your recent learning activities.</p>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '3rem' }}>
        <div className="stat-card user-card" style={{ padding: "1.5rem" }}>
          <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.1)", color: "var(--primary-color)" }}><MdLibraryBooks size={20} /></div>
          <div>
            <h3 style={{ opacity: 0.7, fontSize: "0.9rem", fontWeight: 600, textTransform: "uppercase" }}>Total Lectures</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 800 }}>{lectures.length}</p>
          </div>
        </div>
        
        <div className="stat-card user-card" style={{ padding: "1.5rem" }}>
          <div className="stat-icon" style={{ background: "rgba(16, 185, 129, 0.1)", color: "#10b981" }}><MdAutoAwesome size={32} /></div>
          <div>
            <h3 style={{ opacity: 0.7, fontSize: "0.9rem", fontWeight: 600, textTransform: "uppercase" }}>Completed Notes</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 800 }}>{completedCount}</p>
          </div>
        </div>
        
        <div className="stat-card user-card" style={{ padding: "1.5rem" }}>
          <div className="stat-icon" style={{ background: "rgba(245, 158, 11, 0.1)", color: "#f59e0b" }}><MdSettings size={20} /></div>
          <div>
            <h3 style={{ opacity: 0.7, fontSize: "0.9rem", fontWeight: 600, textTransform: "uppercase" }}>Processing</h3>
            <p style={{ fontSize: '2.5rem', fontWeight: 800 }}>{processingCount}</p>
          </div>
        </div>
      </div>
      
      <div className="user-card" style={{ padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h2 style={{ fontWeight: 700 }}>Recent Uploads</h2>
          <Link href="/dashboard/new-lecture" className="btn" style={{ padding: "0.6rem 1.2rem", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span><MdAddCircleOutline size={20} /></span> Process New Lecture
          </Link>
        </div>

        {isLoading ? (
          <div style={{ padding: "3rem 0", textAlign: "center", opacity: 0.6 }}>Loading data...</div>
        ) : lectures.length === 0 ? (
          <div style={{ padding: "4rem 2rem", textAlign: "center", background: "rgba(0,0,0,0.02)", borderRadius: "12px", border: "1px dashed var(--border-color)" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}><MdSchool size={64} style={{color: "var(--primary-color)"}} /></div>
            <h3 style={{ marginBottom: "0.5rem" }}>No lectures processed yet</h3>
            <p style={{ opacity: 0.7, marginBottom: "1.5rem" }}>Upload a video or YouTube link to magically generate Somali study notes.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {lectures.slice(0, 5).map((lecture) => (
              <Link href={`/dashboard/my-lectures/${lecture.id}`} key={lecture.id} className="lecture-list-item">
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "var(--secondary-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                    {lecture.source_type === 'youtube' ? <FaYoutube size={26} color="#ef4444" /> : <FaFileAudio size={26} color="#8b5cf6" />}
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 600, fontSize: "1.05rem", marginBottom: "4px" }}>{lecture.title || "Untitled Lecture"}</h4>
                    <span style={{ fontSize: "0.85rem", opacity: 0.6 }}>{new Date(lecture.created_at).toLocaleDateString()} • {lecture.source_type}</span>
                  </div>
                </div>
                <div className={`status-badge status-${lecture.status.toLowerCase()}`}>
                  {lecture.status}
                </div>
              </Link>
            ))}
            {lectures.length > 5 && (
              <div style={{ textAlign: "center", marginTop: "1rem" }}>
                 <Link href="/dashboard/my-lectures" style={{ color: "var(--primary-color)", fontWeight: 600, fontSize: "0.9rem" }}>View all {lectures.length} lectures →</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
