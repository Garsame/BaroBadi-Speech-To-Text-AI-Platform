"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MdAdd,
  MdAutoAwesome,
  MdCheckCircle,
  MdDarkMode,
  MdDashboard,
  MdKeyboardArrowDown,
  MdLibraryBooks,
  MdLightMode,
  MdLogout,
  MdMenu,
  MdNotifications,
  MdOutlineOndemandVideo,
  MdRocketLaunch,
  MdSchool,
  MdSettings,
  MdWarning,
} from "react-icons/md";
import {
  apiUrl,
  authHeaders,
  fetchCurrentUser,
  type AuthenticatedUser,
} from "@/lib/api";
import { clearSession, getSessionToken } from "@/lib/session";
import { useTheme } from "@/hooks/useTheme";
import PublicHeader from "../(public)/PublicHeader";
import OtpVerificationModal from "@/components/OtpVerificationModal";
import "../(public)/public.css";
import "./user-dashboard-shell.css";

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

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: MdDashboard },
  { href: "/dashboard/new-lecture", label: "New Lecture", icon: MdAdd },
  { href: "/dashboard/my-lectures", label: "My Lectures", icon: MdOutlineOndemandVideo },
  { href: "/dashboard/notes", label: "Notes Library", icon: MdLibraryBooks },
  { href: "/dashboard/quizzes", label: "AI Quizzes", icon: MdSchool },
];

function resolveProfileImageUrl(profilePictureUrl?: string | null): string | null {
  if (!profilePictureUrl || profilePictureUrl.includes("next.svg")) return null;
  if (/^https?:\/\//i.test(profilePictureUrl)) return profilePictureUrl;
  return apiUrl(profilePictureUrl);
}

function getNotificationView(notification: ActivityNotification) {
  let Icon = MdCheckCircle;
  let tone = "success";
  let title = notification.action.replace(/_/g, " ");
  let description = "";

  if (notification.action === "USER_LOGIN") {
    title = "Logged in";
    description = `Session started for ${notification.details?.email || "your account"}.`;
  } else if (notification.action === "USER_SIGNUP") {
    title = "Account created";
    description = "Your Baro Platform learning workspace is ready.";
  } else if (notification.action === "LECTURE_SUBMITTED") {
    Icon = MdRocketLaunch;
    tone = "info";
    title = "Lecture submitted";
    description = `"${notification.details?.title || "Untitled"}" is being processed.`;
  } else if (notification.action === "LECTURE_COMPLETED") {
    title = "Lecture completed";
    description = `Generated Somali notes for "${notification.details?.title || "Untitled"}".`;
  } else if (notification.action === "LECTURE_FAILED") {
    Icon = MdWarning;
    tone = "danger";
    title = "Processing failed";
    description = `"${notification.details?.title || "Untitled"}" failed at ${notification.details?.error_stage || "unknown stage"}.`;
  } else if (notification.action === "EMAIL_VERIFIED") {
    title = "User verified";
    description = "Your email has been verified successfully.";
  }

  return { Icon, tone, title, description };
}

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { theme, setTheme, toggleTheme } = useTheme();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<ActivityNotification[]>([]);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") {
      setIsSidebarCollapsed(true);
    }
  }, []);


  const handleToggleCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  };

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isSidebarOpen ? "hidden" : "";
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
        return { ...currentUser, ...detail };
      });
    }

    window.addEventListener("user-profile-updated", handleUserProfileUpdated);
    return () => window.removeEventListener("user-profile-updated", handleUserProfileUpdated);
  }, []);

  useEffect(() => {
    function handleOpenOtpModal() {
      setIsOtpModalOpen(true);
    }
    window.addEventListener("open-otp-modal", handleOpenOtpModal);
    return () => window.removeEventListener("open-otp-modal", handleOpenOtpModal);
  }, []);

  // Inactivity timeout of 30 minutes (1800000 milliseconds)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        clearSession();
        window.location.replace("/sign-in?expired=true");
      }, 30 * 60 * 1000);
    };

    const events = ["mousemove", "keydown", "click", "scroll"];
    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, []);

  useEffect(() => {

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



  const handleLogout = () => {
    clearSession();
    window.location.replace("/sign-in");
  };

  if (isLoading || !user) {
    return (
      <div className="inapp-dashboard-loading">
        <div className="inapp-loading-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <img src={theme === "dark" ? "/barobadi-logo-dark.png" : "/barobadi-logo.png"} alt="Baro Platform Logo" style={{ width: "150px", height: "auto", objectFit: "contain", animation: "user-loading-pulse 2s infinite ease-in-out" }} />
          <style>{`
            @keyframes user-loading-pulse {
              0%, 100% { opacity: 0.6; transform: scale(0.98); }
              50% { opacity: 1; transform: scale(1.02); }
            }
          `}</style>
          <strong>Loading dashboard</strong>
          <small>Preparing your Baro Platform workspace.</small>
        </div>
      </div>
    );
  }

  const profileImageUrl = resolveProfileImageUrl(user.profile_picture_url);
  const getInitials = (name: string) => (name ? name.charAt(0).toUpperCase() : "U");

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === href;
    if (href === "/dashboard/my-lectures") {
      return pathname.startsWith("/dashboard/my-lectures") || pathname.startsWith("/dashboard/lecture");
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="inapp-dashboard-shell-container" data-theme={theme} style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <PublicHeader />
      
      <div className={`inapp-dashboard-shell ${isSidebarCollapsed ? "is-collapsed" : ""}`} data-theme={theme} style={{ flex: 1 }}>
        {isSidebarOpen && (
          <button
            className="inapp-sidebar-backdrop"
            aria-label="Close menu"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <aside className={`inapp-sidebar ${isSidebarOpen ? "is-open" : ""}`}>
          <div className="inapp-nav-group" style={{ marginTop: "1rem" }}>
            <span className="inapp-nav-label">Main</span>
            <nav className="inapp-nav" aria-label="User dashboard navigation">
              {navLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    href={item.href}
                    className={`inapp-nav-link ${isActive(item.href) ? "active" : ""}`}
                    key={item.href}
                  >
                    <Icon />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="inapp-nav-group account">
            <span className="inapp-nav-label">Account</span>
            <Link href="/dashboard/profile" className="inapp-nav-link">
              <MdSettings />
              <span>Profile Settings</span>
            </Link>
            <button className="inapp-nav-link danger" onClick={handleLogout}>
              <MdLogout />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        <div className="inapp-main-shell" style={{ minHeight: "calc(100vh - 76px)" }}>
          {/* Top toolbar containing mobile open button and desktop collapse button */}
          <div className="inapp-top-toolbar-bar">
            <button 
              className="inapp-mobile-menu-btn"
              onClick={() => setIsSidebarOpen(true)}
            >
              <MdMenu size={22} />
              <span>Dashboard Menu</span>
            </button>
            <button 
              className="inapp-desktop-collapse-btn"
              onClick={handleToggleCollapse}
            >
              <MdMenu size={22} />
              <span>{isSidebarCollapsed ? "Show Sidebar" : "Hide Sidebar"}</span>
            </button>
          </div>

          {/* Unverified email warning banner */}
          {user && !user.is_email_verified && (
            <div className="unverified-email-banner" style={{
              background: "#fffbeb",
              border: "1px solid #f59e0b",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              margin: "1.25rem 1.25rem 0",
              color: "#78350f",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <MdWarning size={22} style={{ color: "#d97706", flexShrink: 0 }} />
                <span style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                  Your email address is unverified. Please verify your email to secure your account.
                </span>
              </div>
              <button
                disabled={isSendingVerification}
                onClick={async () => {
                  if (isSendingVerification) return;
                  setIsSendingVerification(true);
                  try {
                    const res = await fetch(apiUrl("/api/v1/auth/verify-email"), {
                      method: "POST",
                      headers: authHeaders()
                    });
                    if (res.ok) {
                      setIsOtpModalOpen(true);
                    }
                  } catch(e) {}
                  finally {
                    setIsSendingVerification(false);
                  }
                }}
                style={{
                  background: "#d97706",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.background = "#b45309"}
                onMouseOut={(e) => e.currentTarget.style.background = "#d97706"}
              >
                Verify Email Now
              </button>
            </div>
          )}

          {/* Missing password warning banner */}
          {user && !user.has_password && (
            <div className="missing-password-banner" style={{
              background: "rgba(59, 130, 246, 0.08)",
              border: "1px solid rgba(59, 130, 246, 0.2)",
              borderRadius: "12px",
              padding: "1rem 1.25rem",
              margin: "1.25rem 1.25rem 0",
              color: "#1e3a8a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <MdAutoAwesome size={22} style={{ color: "#3b82f6", flexShrink: 0 }} />
                <span style={{ fontSize: "0.9rem", fontWeight: "600" }}>
                  You signed in via Google. Set a password in Profile Settings if you want to use manual email sign-in later.
                </span>
              </div>
              <Link
                href="/dashboard/profile"
                style={{
                  background: "#3b82f6",
                  color: "#ffffff",
                  textDecoration: "none",
                  borderRadius: "8px",
                  padding: "8px 16px",
                  fontSize: "0.85rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                  transition: "background 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.background = "#2563eb"}
                onMouseOut={(e) => e.currentTarget.style.background = "#3b82f6"}
              >
                Set Password Now
              </Link>
            </div>
          )}

          <main className="inapp-dashboard-main" style={{ padding: "1.5rem 1.25rem" }}>{children}</main>
        </div>
      </div>

      {user && (
        <OtpVerificationModal
          isOpen={isOtpModalOpen}
          onClose={() => setIsOtpModalOpen(false)}
          email={user.email}
          onSuccess={() => {
            window.dispatchEvent(
              new CustomEvent("user-profile-updated", {
                detail: { is_email_verified: true },
              })
            );
            window.location.replace("/dashboard");
          }}
        />
      )}
    </div>
  );
}
