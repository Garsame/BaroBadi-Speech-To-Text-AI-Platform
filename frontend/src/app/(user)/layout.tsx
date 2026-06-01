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
import { MdDashboard, MdPeople, MdOutlineOndemandVideo, MdLibraryBooks, MdAddCircleOutline, MdSettings, MdLogout, MdNotifications, MdLightMode, MdDarkMode, MdKeyboardArrowDown, MdBuild, MdMenuBook, MdAutoAwesome, MdSchool, MdAdd, MdMenu, MdStorage } from 'react-icons/md';
import { FaCheckCircle, FaRocket, FaExclamationTriangle, FaYoutube, FaFileAudio, FaTools } from 'react-icons/fa';

interface ActivityNotification {
  id: number;
  action: string;
  created_at: string;
  details?: {
    title?: string;
    email?: string;
    role?: string;
    source_type?: string;
    error_stage?: string;
  } | null;
}

function resolveProfileImageUrl(profilePictureUrl?: string | null): string | null {
  if (!profilePictureUrl) return null;
  if (/^https?:\/\//i.test(profilePictureUrl)) return profilePictureUrl;
  return apiUrl(profilePictureUrl);
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState("light");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

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
    function handleUserProfileUpdated(event: Event) {
      const detail = (event as CustomEvent<Partial<AuthenticatedUser>>).detail;
      if (!detail) return;

      setUser((currentUser) => {
        if (!currentUser) return currentUser;
        return {
          ...currentUser,
          ...detail,
        };
      });
    }

    window.addEventListener("user-profile-updated", handleUserProfileUpdated);
    return () => window.removeEventListener("user-profile-updated", handleUserProfileUpdated);
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
  const profileImageUrl = resolveProfileImageUrl(user.profile_picture_url);

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
           --active-bg: ${theme === "dark" ? "rgba(99, 102, 241, 0.16)" : "rgba(99, 102, 241, 0.08)"};
           --active-color: var(--primary-color);
           background-color: var(--bg-color);
           color: var(--text-color);
           transition: all 0.3s ease;
        }

        .dashboard-container {
          display: flex;
          height: 100vh;
          overflow: hidden;
          width: 100vw;
          position: relative;
        }

        .dashboard-sidebar {
          width: 280px;
          height: 100vh;
          flex-shrink: 0;
          background-color: var(--card-bg);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          z-index: 40;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .sidebar-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          z-index: 35;
          animation: sidebar-fade-in 0.2s ease-out;
        }

        @keyframes sidebar-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .drive-logo-section {
          display: flex;
          padding: 1.5rem 1rem 1rem 1rem;
          align-items: center;
        }

        .sidebar-logo {
          height: 38px;
          width: auto;
          object-fit: contain;
          transition: height 0.2s ease;
        }

        @keyframes slide-down {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .drive-nav-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0.8rem 1.5rem 0.8rem 1rem;
          color: var(--text);
          font-weight: 500;
          text-decoration: none;
          font-size: 0.95rem;
          border-radius: 0 999px 999px 0;
          margin-right: 12px;
          transition: all 0.2s ease;
        }

        .drive-nav-link:hover {
          background-color: var(--active-bg);
        }

        .drive-nav-link.active {
          background-color: var(--active-bg);
          color: var(--active-color);
          font-weight: 700;
        }

        .drive-divider {
          height: 1px;
          background-color: var(--border);
          margin: 0.75rem 0;
          width: 100%;
        }

        .drive-storage-section {
          margin-top: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .drive-storage-bar {
          height: 6px;
          border-radius: 999px;
          background-color: var(--border);
          overflow: hidden;
          width: 100%;
        }

        .drive-storage-fill {
          height: 100%;
          background: var(--primary-color);
          border-radius: 999px;
        }

        .main-content-layout {
          flex: 1;
          display: flex;
          flex-direction: column;
          height: 100vh;
          overflow: hidden;
        }

        .dashboard-header {
          height: 70px;
          padding: 0 3rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background-color: var(--card-bg);
          border-bottom: 1px solid var(--border);
        }

        .mobile-toggle-btn {
          display: none;
          background: transparent;
          border: none;
          color: var(--text);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: background-color 0.2s;
        }

        .mobile-toggle-btn:hover {
          background-color: var(--active-bg);
        }

        .dashboard-main-area {
          flex: 1;
          padding: 2rem 3rem;
          overflow-y: auto;
          position: relative;
        }

        .user-card {
           background-color: var(--card-bg);
           border: 1px solid var(--border);
           border-radius: 12px;
        }

        /* Responsiveness Media Queries */
        @media (max-width: 1024px) {
          .sidebar-logo {
            height: 48px;
          }

          .dashboard-sidebar {
            position: fixed;
            top: 0;
            bottom: 0;
            left: 0;
            transform: translateX(-100%);
            z-index: 50;
            box-shadow: 0 10px 25px rgba(0,0,0,0.15);
          }

          .dashboard-sidebar.sidebar-open {
            transform: translateX(0);
          }

          .mobile-toggle-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
          }

          .dashboard-header {
            padding: 0 1.5rem;
          }

          .dashboard-main-area {
            padding: 1.5rem 1rem;
          }
        }
      `}</style>
      
      {isSidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div className="user-theme-aware dashboard-container">
        
        {/* Sidebar */}
        <aside className={`dashboard-sidebar ${isSidebarOpen ? "sidebar-open" : ""}`}>
          
          {/* Logo Section */}
          <div className="drive-logo-section">
            <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center' }}>
              <img src="/barobadi-logo.png" alt="BaroBadi Logo" className="sidebar-logo" />
            </Link>
          </div>

          <div className="drive-divider" style={{ margin: "0.25rem 0 0.75rem 0" }} />
          
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1 }}>
            <Link href="/dashboard" className={`drive-nav-link ${pathname === '/dashboard' ? 'active' : ''}`}>
              <MdDashboard size={20} /> Dashboard
            </Link>
            <Link href="/dashboard/new-lecture" className={`drive-nav-link ${pathname === '/dashboard/new-lecture' ? 'active' : ''}`}>
              <MdAddCircleOutline size={20} /> New Lecture
            </Link>
            <Link href="/dashboard/my-lectures" className={`drive-nav-link ${pathname === '/dashboard/my-lectures' ? 'active' : ''}`}>
               <MdOutlineOndemandVideo size={20} /> My Lectures
            </Link>
            <Link href="/dashboard/notes" className={`drive-nav-link ${pathname === '/dashboard/notes' ? 'active' : ''}`}>
              <MdLibraryBooks size={20} /> Notes Library
            </Link>
            <Link href="/dashboard/quizzes" className={`drive-nav-link ${pathname.startsWith('/dashboard/quizzes') ? 'active' : ''}`}>
              <MdSchool size={20} /> AI Quizzes
            </Link>

          </nav>



        </aside>

        {/* Main Content Area */}
        <div className="main-content-layout">
          
          <header className="dashboard-header">
             <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <button 
                  className="mobile-toggle-btn"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Toggle Sidebar Menu"
                >
                  <MdMenu size={24} />
                </button>

             </div>
             
             <div ref={dropdownRef} style={{ display: "flex", gap: "1.5rem", alignItems: "center" }}>
                <button onClick={toggleTheme} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.2rem", color: text }}>
                   {theme === "dark" ? <MdLightMode size={22} /> : <MdDarkMode size={22} />}
                </button>
                
                {/* Notifications Bell */}
                <div style={{ position: "relative" }}>
                    <button onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "1.5rem", position: "relative", display: "flex", color: text }}>
                        <MdNotifications size={24} />
                        {notifications.length > 0 && <span style={{ position: "absolute", top: 0, right: 0, width: "10px", height: "10px", background: "#ef4444", borderRadius: "50%" }}></span>}
                    </button>
                    {showNotifications && (
                        <div style={{ position: "absolute", top: "100%", right: "0", background: cardBg, border: `1px solid ${border}`, borderRadius: "8px", width: "350px", padding: "1rem", boxShadow: "0 10px 15px rgba(0,0,0,0.1)", zIndex: 100 }}>
                            <h4 style={{ margin: "0 0 1rem 0", color: text }}>Recent Activity</h4>
                            {notifications.length === 0 ? (
                                <div style={{ color: textMuted, fontSize: "0.9rem" }}>No recent activity.</div>
                            ) : (
                                notifications.map((n, i) => {
                                    let icon = <FaCheckCircle size={16} color="#10b981" />;
                                    let titleText = n.action.replace(/_/g, " ");
                                    let descriptionText = "";

                                    if (n.action === "USER_LOGIN") {
                                        titleText = "Logged In Successfully";
                                        descriptionText = `Session started for ${n.details?.email || "user"}.`;
                                    } else if (n.action === "USER_SIGNUP") {
                                        titleText = "Welcome to SomaliNotes! 👋";
                                        descriptionText = "Your account was successfully registered.";
                                    } else if (n.action === "LECTURE_SUBMITTED") {
                                        icon = <FaRocket size={16} color="#38bdf8" />;
                                        titleText = "Lecture Submitted";
                                        descriptionText = `"${n.details?.title || "Untitled"}" is now being processed.`;
                                    } else if (n.action === "LECTURE_COMPLETED") {
                                        icon = <FaCheckCircle size={16} color="#10b981" />;
                                        titleText = "Lecture Finished! 🎉";
                                        descriptionText = `Generated Somali study notes for "${n.details?.title || "Untitled"}"`;
                                    } else if (n.action === "LECTURE_FAILED") {
                                        icon = <FaExclamationTriangle size={16} color="#ef4444" />;
                                        titleText = "Processing Failed ❌";
                                        descriptionText = `"${n.details?.title || "Untitled"}" failed at stage: ${n.details?.error_stage || "unknown"}.`;
                                    }

                                    return (
                                        <div key={i} style={{ padding: "0.8rem 0", borderBottom: i === notifications.length - 1 ? "none" : `1px solid ${border}`, fontSize: "0.85rem", color: text, display: "flex", gap: "10px", alignItems: "flex-start" }}>
                                            <span style={{ fontSize: "1.2rem", marginTop: "2px" }}>{icon}</span>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: "bold", color: text }}>{titleText}</div>
                                                {descriptionText && <div style={{ color: textMuted, margin: "2px 0", fontSize: "0.8rem" }}>{descriptionText}</div>}
                                                <div style={{ color: textMuted, fontSize: "0.72rem" }}>{new Date(n.created_at).toLocaleString()}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Profile Dropdown */}
                <div style={{ position: "relative" }}>
                    <button onClick={() => { setShowProfile(!showProfile); setShowNotifications(false); }} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                        <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#38bdf8", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", border: `2px solid ${border}` }}>
                             {profileImageUrl ? (
                                <img src={profileImageUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
                                     {profileImageUrl ? (
                                        <img src={profileImageUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                     ) : (
                                        <span style={{ color: "white" }}>{getInitials(user.full_name)}</span>
                                     )}
                                </div>
                                <h4 style={{ margin: 0, color: text }}>{user.full_name}</h4>
                                <p style={{ margin: 0, color: textMuted, fontSize: "0.85rem" }}>{user.email}</p>
                            </div>
                            <div style={{ borderTop: `1px solid ${border}`, paddingTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <Link href="/dashboard/profile" onClick={() => setShowProfile(false)} style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", color: text, padding: "0.5rem", borderRadius: "6px" }} className="hover:bg-opacity-50">
                                   <MdSettings size={20} /> Edit Profile Info
                                </Link>
                                <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "#ef4444", padding: "0.5rem", borderRadius: "6px", fontWeight: "bold" }} className="hover:bg-opacity-50">
                                   <MdLogout size={20} /> Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
             </div>
          </header>

          <main className="dashboard-main-area">
             {children}
          </main>
          
        </div>
      </div>
    </>
  );
}
