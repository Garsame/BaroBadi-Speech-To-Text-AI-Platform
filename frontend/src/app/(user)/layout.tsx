"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  apiUrl,
  authHeaders,
  fetchCurrentUser,
  type AuthenticatedUser,
} from "@/lib/api";
import { clearSession, getSessionToken } from "@/lib/session";
import { MdDashboard, MdPeople, MdOutlineOndemandVideo, MdLibraryBooks, MdAddCircleOutline, MdSettings, MdLogout, MdNotifications, MdLightMode, MdDarkMode, MdKeyboardArrowDown, MdBuild, MdMenuBook, MdAutoAwesome, MdSchool, MdAdd } from 'react-icons/md';
import { FaCheckCircle, FaRocket, FaExclamationTriangle, FaYoutube, FaFileAudio, FaTools } from 'react-icons/fa';

interface ActivityNotification {
  id: number;
  action: string;
  created_at: string;
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState("light");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfile(false);
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("user-theme");
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      localStorage.setItem("user-theme", "light");
    }

    const redirectToSignIn = () => {
      clearSession();
      window.location.replace("/sign-in");
    };

    const fetchContext = async () => {
      const token = getSessionToken();

      if (!token) {
        redirectToSignIn();
        return;
      }

      try {
        const currentUser = await fetchCurrentUser(token);

        if (currentUser.role === "admin") {
          window.location.replace("/admin/dashboard");
          return;
        }

        const notifRes = await fetch(apiUrl("/api/v1/auth/me/activity?limit=5"), {
          headers: authHeaders(),
          cache: "no-store",
        });

        setUser(currentUser);
        if (notifRes.ok) setNotifications(await notifRes.json());
      } catch {
        redirectToSignIn();
      } finally {
        setIsLoading(false);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "token" && !getSessionToken()) {
        redirectToSignIn();
      }
    };

    const handlePageShow = () => {
      if (!getSessionToken()) {
        redirectToSignIn();
      }
    };

    fetchContext();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("user-theme", newTheme);
  };

  const handleLogout = () => {
    clearSession();
    window.location.replace("/sign-in");
  };

  if (isLoading || !user) {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Loading Dashboard...</div>;
  }

  const bg = theme === "dark" ? "#0f172a" : "#f8fafc";
  const text = theme === "dark" ? "#f8fafc" : "#0f172a";
  const cardBg = theme === "dark" ? "#1e293b" : "#ffffff";
  const border = theme === "dark" ? "#334155" : "#e2e8f0";
  const hoverBg = theme === "dark" ? "rgba(56, 189, 248, 0.1)" : "rgba(56, 189, 248, 0.2)";
  const textMuted = theme === "dark" ? "#94a3b8" : "#64748b";

  const getInitials = (name: string) => name ? name.charAt(0).toUpperCase() : "U";

  return (
    <>
      <style>{`
        .user-theme-aware {
           --bg-color: ${bg};
           --text-color: ${text};
           --secondary-bg: ${cardBg};
           --border-color: ${border};
           --bg: ${bg};
           --text: ${text};
           --card-bg: ${cardBg};
           --border: ${border};
           --text-muted: ${textMuted};
           background-color: var(--bg-color);
           color: var(--text-color);
           transition: all 0.3s ease;
        }
        .user-nav-link:hover {
           background-color: ${hoverBg} !important;
        }
        .user-card {
           background-color: var(--card-bg);
           border: 1px solid var(--border);
           border-radius: 12px;
        }
      `}</style>
      
      <div className="user-theme-aware" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        
        {/* Sidebar */}
        <aside style={{ width: '280px', height: '100vh', flexShrink: 0, backgroundColor: cardBg, padding: '2rem', borderRight: `1px solid ${border}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '3rem' }}>
             <img src="/barobadi-logo.png" alt="BaroBadi Logo" style={{ width: '150px', height: 'auto', objectFit: 'contain', cursor: 'pointer' }} onClick={() => router.push('/dashboard')} />
          </div>
          
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
            <Link href="/dashboard" className="user-nav-link" style={{ padding: '0.8rem 1rem', borderRadius: '8px', textDecoration: 'none', color: text, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: pathname === '/dashboard' ? 'bold' : 'normal', background: pathname === '/dashboard' ? hoverBg : 'transparent' }}>
              <MdDashboard size={20} /> Dashboard
            </Link>
            <Link href="/dashboard/new-lecture" className="user-nav-link" style={{ padding: '0.8rem 1rem', borderRadius: '8px', textDecoration: 'none', color: text, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: pathname === '/dashboard/new-lecture' ? 'bold' : 'normal', background: pathname === '/dashboard/new-lecture' ? hoverBg : 'transparent' }}>
              <MdAddCircleOutline size={20} /> New Lecture
            </Link>
            <Link href="/dashboard/my-lectures" className="user-nav-link" style={{ padding: '0.8rem 1rem', borderRadius: '8px', textDecoration: 'none', color: text, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: pathname === '/dashboard/my-lectures' ? 'bold' : 'normal', background: pathname === '/dashboard/my-lectures' ? hoverBg : 'transparent' }}>
               <MdOutlineOndemandVideo size={20} /> My Lectures
            </Link>
            <Link href="/dashboard/notes" className="user-nav-link" style={{ padding: '0.8rem 1rem', borderRadius: '8px', textDecoration: 'none', color: text, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: pathname === '/dashboard/notes' ? 'bold' : 'normal', background: pathname === '/dashboard/notes' ? hoverBg : 'transparent' }}>
              <MdLibraryBooks size={20} /> Notes Library
            </Link>
          </nav>
          
          <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
             <Link href="/dashboard/profile" className="user-nav-link" style={{ padding: '0.8rem 1rem', borderRadius: '8px', textDecoration: 'none', color: text, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: pathname === '/dashboard/profile' ? 'bold' : 'normal', background: pathname === '/dashboard/profile' ? hoverBg : 'transparent' }}>
                <MdSettings size={20} /> Account Settings
             </Link>
             <button onClick={handleLogout} className="user-nav-link" style={{ padding: '0.8rem 1rem', borderRadius: '8px', textDecoration: 'none', color: '#ef4444', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
                <MdLogout size={20} /> Sign Out
             </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          
          <header style={{ height: '70px', padding: '0 3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: cardBg, borderBottom: `1px solid ${border}` }}>
             <div style={{ fontSize: "1.2rem", fontWeight: 700, color: text }}>
                Welcome back, {user.full_name || "User"} 👋
             </div>
             
             <div ref={dropdownRef} style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                <button onClick={toggleTheme} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: text }}>
                   {theme === "dark" ? <MdLightMode size={22} /> : <MdDarkMode size={22} />}
                </button>
                
                {/* Notifications Bell */}
                <div style={{ position: "relative" }}>
                    <button onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.5rem", position: "relative" }}>
                        <MdNotifications size={24} />
                        {notifications.length > 0 && <span style={{ position: "absolute", top: 0, right: 0, width: "10px", height: "10px", background: "#ef4444", borderRadius: "50%" }}></span>}
                    </button>
                    {showNotifications && (
                        <div style={{ position: "absolute", top: "100%", right: "0", background: cardBg, border: `1px solid ${border}`, borderRadius: "8px", width: "350px", padding: "1rem", boxShadow: "0 10px 15px rgba(0,0,0,0.1)", zIndex: 100 }}>
                            <h4 style={{ margin: "0 0 1rem 0", color: text }}>Recent Activity</h4>
                            {notifications.length === 0 ? (
                                <div style={{ color: textMuted, fontSize: "0.9rem" }}>No recent activity.</div>
                            ) : (
                                notifications.map((n, i) => (
                                    <div key={i} style={{ padding: "0.8rem 0", borderBottom: i === notifications.length - 1 ? "none" : `1px solid ${border}`, fontSize: "0.85rem", color: text, display: "flex", gap: "10px", alignItems: "flex-start" }}>
                                        <span style={{ fontSize: "1.2rem" }}><FaCheckCircle size={16} color="#10b981" /></span>
                                        <div>
                                            <div style={{ marginBottom: "2px", fontWeight: "bold" }}>{n.action.replace(/_/g, " ")}</div>
                                            <div style={{ color: textMuted, fontSize: "0.75rem" }}>{new Date(n.created_at).toLocaleString()}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Profile Dropdown */}
                <div style={{ position: "relative", marginLeft: "1rem" }}>
                    <button onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#38bdf8", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", border: `2px solid ${border}` }}>
                             {user.profile_picture_url ? (
                                <img src={apiUrl(user.profile_picture_url)} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                             ) : (
                                <span style={{ fontSize: "1.2rem", color: "white", fontWeight: "bold" }}>{getInitials(user.full_name)}</span>
                             )}
                        </div>
                        <span style={{ color: text, fontWeight: "bold" }}><MdKeyboardArrowDown size={22} color="var(--text-muted)" style={{marginLeft: "4px"}} /></span>
                    </button>
                    {showProfile && (
                        <div style={{ position: "absolute", top: "100%", right: "0", background: cardBg, border: `1px solid ${border}`, borderRadius: "8px", width: "250px", padding: "1rem", boxShadow: "0 10px 15px rgba(0,0,0,0.1)", zIndex: 100, marginTop: "10px" }}>
                            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                                <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "#38bdf8", overflow: "hidden", display: "inline-flex", justifyContent: "center", alignItems: "center", fontSize: "1.5rem", fontWeight: "bold", marginBottom: "10px" }}>
                                     {user.profile_picture_url ? (
                                        <img src={apiUrl(user.profile_picture_url)} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                     ) : (
                                        <span style={{ color: "white" }}>{getInitials(user.full_name)}</span>
                                     )}
                                </div>
                                <h4 style={{ margin: 0, color: text }}>{user.full_name}</h4>
                                <p style={{ margin: 0, color: textMuted, fontSize: "0.85rem" }}>{user.email}</p>
                            </div>
                            <div style={{ borderTop: `1px solid ${border}`, paddingTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <Link href="/dashboard/profile" onClick={() => setShowProfile(false)} style={{ display: "block", textDecoration: "none", color: text, padding: "0.5rem", borderRadius: "6px" }} className="hover:bg-opacity-50">
                                   <MdSettings size={20} /> Edit Profile Info
                                </Link>
                                <button onClick={handleLogout} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: "0.5rem", borderRadius: "6px", fontWeight: "bold" }} className="hover:bg-opacity-50">
                                   <MdLogout size={20} /> Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
             </div>
          </header>

          <main style={{ flex: 1, padding: "2rem 3rem", overflowY: "auto", position: "relative" }}>
             {children}
          </main>
          
        </div>
      </div>
    </>
  );
}
