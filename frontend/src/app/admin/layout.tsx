"use client";

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  apiUrl,
  authHeaders,
  fetchCurrentUser,
  type AuthenticatedUser,
} from "@/lib/api";
import { clearSession, getSessionToken } from "@/lib/session";
import { useTheme } from "@/hooks/useTheme";
import { MdDashboard, MdPeople, MdOutlineOndemandVideo, MdSettings, MdLogout, MdNotifications, MdLightMode, MdDarkMode, MdKeyboardArrowDown, MdEmail, MdMenu } from 'react-icons/md';
import { FaCheckCircle, FaRocket, FaExclamationTriangle, FaTools } from 'react-icons/fa';

interface SystemNotification {
  id: string;
  level: string;
  message: string;
  created_at: string;
}

const ADMIN_PUBLIC_PATHS = new Set(["/maamul-login", "/maamul-signup"]);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { theme, setTheme, toggleTheme } = useTheme();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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

    const redirectToAdminLogin = () => {
      clearSession();
      window.location.replace("/maamul-login");
    };

    // Fetch user details & recent notifications
    const fetchContext = async () => {
      if (ADMIN_PUBLIC_PATHS.has(pathname)) {
        setIsLoading(false);
        return;
      }
      const token = getSessionToken();

      if (!token) {
        redirectToAdminLogin();
        return;
      }

      try {
        const currentUser = await fetchCurrentUser(token);

        if (currentUser.role !== "admin") {
          window.location.replace("/dashboard");
          return;
        }

        setUser(currentUser);

        const notifRes = await fetch(apiUrl("/api/v1/admin/system-logs?limit=5"), {
          headers: authHeaders(),
          cache: "no-store",
        });

        if (notifRes.ok) {
          setNotifications((await notifRes.json()) as SystemNotification[]);
        }
      } catch {
        redirectToAdminLogin();
      } finally {
        setIsLoading(false);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (ADMIN_PUBLIC_PATHS.has(pathname)) return;
      if (event.key === "token" && !getSessionToken()) {
        redirectToAdminLogin();
      }
    };

    const handlePageShow = () => {
      if (ADMIN_PUBLIC_PATHS.has(pathname)) return;
      if (!getSessionToken()) {
        redirectToAdminLogin();
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

  // Inactivity timeout of 30 minutes (1800000 milliseconds)
  useEffect(() => {
    if (ADMIN_PUBLIC_PATHS.has(pathname)) return;
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        clearSession();
        window.location.replace("/maamul-login?expired=true");
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



  const handleLogout = () => {
    clearSession();
    window.location.replace("/maamul-login");
  };

  if (ADMIN_PUBLIC_PATHS.has(pathname)) {
    return <>{children}</>;
  }

  if (isLoading) {
    const loadingBg = theme === "dark" ? "#0b1020" : "#ffffff";
    const loadingText = theme === "dark" ? "#a9b4c8" : "#65728a";
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: loadingBg }}>
        <img src={theme === "dark" ? "/barobadi-logo-dark.png" : "/barobadi-logo.png"} alt="BaroBadi Logo" style={{ width: "180px", height: "auto", objectFit: "contain", animation: "admin-loading-pulse 2s infinite ease-in-out" }} />
        <style>{`
          @keyframes admin-loading-pulse {
            0%, 100% { opacity: 0.6; transform: scale(0.98); }
            50% { opacity: 1; transform: scale(1.02); }
          }
        `}</style>
        <span style={{ fontSize: '0.9rem', color: loadingText, marginTop: '1rem' }}>Loading Admin Portal...</span>
      </div>
    );
  }
  if (!user || user.role !== "admin") {
    return <div style={{ height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>Redirecting...</div>;
  }

  const bg = theme === "dark" ? "#0b1020" : "#ffffff";
  const text = theme === "dark" ? "#f8fafc" : "#121a2d";
  const cardBg = theme === "dark" ? "#111827" : "#ffffff";
  const border = theme === "dark" ? "rgba(255, 255, 255, 0.1)" : "#dfe7f3";
  const hoverBg = theme === "dark" ? "rgba(0, 159, 253, 0.14)" : "rgba(42, 42, 114, 0.08)";
  const textMuted = theme === "dark" ? "#a9b4c8" : "#65728a";

  return (
    <>
      <style>{`
        .admin-theme-aware {
           --bg-color: ${bg};
           --text-color: ${text};
           --secondary-bg: ${cardBg};
           --border-color: ${border};
           --bg: ${bg};
           --text: ${text};
           --card-bg: ${cardBg};
           --border: ${border};
           --text-muted: ${textMuted};
           --primary-color: ${theme === "dark" ? "#009ffd" : "#2a2a72"};
           --primary-hover: #009ffd;
           --success-color: var(--primary-color);
           --warning-color: var(--primary-hover);
           --danger-color: var(--primary-color);
           
           /* Translucent variants for icons and badges */
           --primary-translucent: ${theme === "dark" ? "rgba(0, 159, 253, 0.15)" : "rgba(42, 42, 114, 0.08)"};
           --primary-hover-translucent: ${theme === "dark" ? "rgba(110, 199, 255, 0.15)" : "rgba(0, 159, 253, 0.08)"};
           --success-translucent: var(--primary-translucent);
           --warning-translucent: var(--primary-hover-translucent);
           --danger-translucent: var(--primary-translucent);
           --admin-surface-soft: ${theme === "dark" ? "#162033" : "#f4f8ff"};
           --admin-shadow: ${theme === "dark" ? "0 22px 70px rgba(0, 0, 0, 0.36)" : "0 22px 60px rgba(42, 42, 114, 0.08)"};
           --admin-soft-shadow: ${theme === "dark" ? "0 12px 32px rgba(0, 0, 0, 0.28)" : "0 12px 30px rgba(30, 41, 59, 0.06)"};

           font-family: var(--font-onest), "Onest", "Segoe UI", system-ui, sans-serif;
           background-color: var(--bg-color);
           color: var(--text-color);
           transition: all 0.3s ease;
        }
        .admin-shell {
           display: flex;
           height: 100vh;
           overflow: hidden;
           background: var(--bg-color);
        }
        .admin-sidebar {
           width: 288px;
           height: 100vh;
           flex-shrink: 0;
           display: flex;
           flex-direction: column;
           border-right: 1px solid var(--border);
           padding: 1.45rem 1.15rem;
           background: var(--card-bg);
           box-shadow: 14px 0 44px rgba(15, 23, 42, 0.05);
        }
        .admin-brand-panel {
           display: flex;
           align-items: center;
           justify-content: flex-start;
           min-height: 66px;
           margin-bottom: 1.15rem;
           border: 0;
           border-radius: 0;
           background: transparent;
           box-shadow: none;
        }
        .admin-nav-link {
           position: relative;
           padding: 0.68rem 0.82rem !important;
           border-radius: 999px;
           text-decoration: none;
           color: var(--text-color) !important;
           display: flex;
           align-items: center;
           gap: 10px;
           font-size: 0.85rem;
           font-weight: 500;
           transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
           border: 1px solid transparent;
           isolation: isolate;
           overflow: hidden;
        }
        .admin-nav-link::before {
           content: "";
           position: absolute;
           inset: 0 auto 0 0;
           width: 0;
           background: var(--primary-color);
           transform: scaleY(0);
           transform-origin: center;
           transition: transform 0.22s ease;
        }
        .admin-nav-link:hover {
           color: var(--primary-color) !important;
           background-color: transparent !important;
           border-color: var(--primary-color);
           transform: translateX(2px);
        }
        .admin-nav-link.active {
           color: var(--primary-color) !important;
           background: transparent !important;
           border: 1px solid var(--primary-color) !important;
           font-weight: 500;
           box-shadow: none;
        }
        .admin-nav-link.active::before {
           transform: scaleY(1);
        }
        .admin-sidebar-footer {
           margin-top: auto;
           padding-top: 1rem;
           border-top: 1px solid var(--border);
        }
        .admin-user-pill {
           display: grid;
           grid-template-columns: auto 1fr;
           gap: 0.75rem;
           align-items: center;
           border: 1px solid var(--border);
           border-radius: 18px;
           padding: 0.85rem;
           background: color-mix(in srgb, var(--admin-surface-soft) 58%, transparent);
        }
        .admin-avatar {
           width: 38px;
           height: 38px;
           border-radius: 50%;
           background: var(--primary-color);
           color: white;
           display: inline-flex;
           justify-content: center;
           align-items: center;
           font-weight: 900;
           font-size: 0.95rem;
           box-shadow: 0 12px 24px var(--primary-translucent);
        }
        .admin-topbar {
           min-height: 74px;
           padding: 0 2rem;
           display: flex;
           justify-content: space-between;
           align-items: center;
           border-bottom: 1px solid var(--border);
           background: color-mix(in srgb, var(--card-bg) 92%, transparent);
           backdrop-filter: blur(16px);
        }
        .admin-topbar-title {
           display: inline-flex;
           align-items: center;
           gap: 0.6rem;
           color: var(--primary-color);
           font-weight: 900;
           letter-spacing: 0.02em;
        }
        .admin-topbar-title::before {
           width: 10px;
           height: 10px;
           border-radius: 50%;
           content: "";
           background: var(--success-color);
           box-shadow: 0 0 0 5px var(--success-translucent);
        }
        .admin-main {
           flex: 1;
           padding: clamp(1.4rem, 3vw, 2.5rem);
           overflow-y: auto;
        }
        .admin-page-header {
           display: flex;
           justify-content: space-between;
           align-items: flex-end;
           gap: 1rem;
           margin-bottom: 1.4rem;
           flex-wrap: wrap;
        }
        .admin-page-kicker {
           display: inline-flex;
           align-items: center;
           gap: 0.45rem;
           margin-bottom: 0.4rem;
           color: var(--primary-color);
           font-size: 0.72rem;
           font-weight: 900;
           letter-spacing: 0.1em;
           text-transform: uppercase;
        }
        .admin-page-title {
           margin: 0;
           color: var(--text);
           font-size: clamp(1.45rem, 2vw, 1.85rem);
           line-height: 1.1;
        }
        .admin-page-lede {
           max-width: 760px;
           margin: 0.45rem 0 0;
           color: var(--text-muted);
           line-height: 1.65;
        }
        .admin-action-btn {
           display: inline-flex;
           align-items: center;
           justify-content: center;
           gap: 0.5rem;
           min-height: 44px;
           border: 1px solid var(--primary-color);
           border-radius: 14px;
           padding: 0 1rem;
           background: var(--primary-color);
           color: #fff;
           cursor: pointer;
           font: inherit;
           font-size: 0.85rem;
           font-weight: 500;
           box-shadow: 0 16px 30px var(--primary-translucent);
           transition: transform 0.2s ease, background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .admin-action-btn:hover {
           background: var(--primary-hover);
           border-color: var(--primary-hover);
           transform: translateY(-2px);
           box-shadow: 0 18px 34px var(--primary-hover-translucent);
        }
        .admin-card {
           background: var(--card-bg);
           border: 1px solid var(--border);
           border-radius: 20px;
           box-shadow: var(--admin-soft-shadow);
           transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .card-lift:hover {
           transform: translateY(-2.5px);
           border-color: color-mix(in srgb, var(--primary-color) 24%, var(--border));
           box-shadow: var(--admin-shadow);
        }
        .admin-icon-btn {
           background: transparent;
           border: 1px solid var(--border-color);
           cursor: pointer;
           width: 40px;
           height: 40px;
           border-radius: 10px;
           display: inline-flex;
           align-items: center;
           justify-content: center;
           color: var(--text-color);
           position: relative;
           transition: all 0.2s ease;
        }
        .admin-icon-btn:hover {
           background-color: ${hoverBg};
           border-color: var(--primary-hover);
           transform: translateY(-2px);
        }
        .admin-icon-action {
           width: 38px;
           height: 38px;
           display: inline-flex;
           align-items: center;
           justify-content: center;
           border: 1px solid var(--border);
           border-radius: 12px;
           background: color-mix(in srgb, var(--card-bg) 86%, transparent);
           color: var(--text);
           cursor: pointer;
           transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
        }
        .admin-icon-action:hover {
           transform: translateY(-2px);
           color: var(--primary-color);
           border-color: color-mix(in srgb, var(--primary-color) 32%, var(--border));
           background: var(--primary-translucent);
        }
        .admin-table-shell {
           overflow: hidden;
        }
        .admin-user-summary {
           display: grid;
           grid-template-columns: repeat(4, minmax(0, 1fr));
           margin-bottom: 1rem;
           overflow: hidden;
           border: 1px solid var(--border);
           border-radius: 12px;
           background: var(--card-bg);
        }
        .admin-user-summary-item {
           display: grid;
           gap: 0.25rem;
           padding: 1rem 1.1rem;
           border-right: 1px solid var(--border);
        }
        .admin-user-summary-item:last-child {
           border-right: 0;
        }
        .admin-user-summary-item strong {
           color: var(--primary-color);
           font-size: 1.35rem;
           line-height: 1;
        }
        .admin-user-summary-item span {
           color: var(--text-muted);
           font-size: 0.82rem;
           font-weight: 700;
        }
        .admin-user-avatar {
           width: 42px;
           height: 42px;
           border-radius: 50%;
           display: inline-flex;
           align-items: center;
           justify-content: center;
           border: 1px solid color-mix(in srgb, var(--primary-color) 30%, var(--border));
           background: var(--card-bg);
           color: var(--primary-color);
           font-weight: 900;
           font-size: 0.86rem;
        }
        .admin-table-scroll {
           overflow-x: auto;
        }
        .admin-table {
           width: 100%;
           border-collapse: collapse;
           text-align: left;
        }
        .admin-table thead tr {
           border-bottom: 1px solid var(--border);
           background: color-mix(in srgb, var(--admin-surface-soft) 62%, transparent);
        }
        .admin-table th {
           padding: 0.85rem 1rem;
           color: var(--text-muted);
           font-size: 0.68rem;
           font-weight: 500;
           letter-spacing: 0.08em;
           text-transform: uppercase;
           white-space: nowrap;
        }
        .admin-table td {
           padding: 0.92rem 1rem;
           border-bottom: 1px solid var(--border);
           color: var(--text);
           vertical-align: middle;
        }
        .admin-table tbody tr {
           transition: background 0.18s ease;
        }
        .admin-table tbody tr:hover {
           background: color-mix(in srgb, var(--admin-surface-soft) 54%, transparent);
        }
        .admin-badge {
           display: inline-flex;
           align-items: center;
           gap: 0.35rem;
           border-radius: 999px;
           padding: 0.34rem 0.64rem;
           font-size: 0.68rem;
           font-weight: 500;
           text-transform: uppercase;
           white-space: nowrap;
        }
        .admin-panel-title {
           margin: 0;
           color: var(--text);
           font-size: 0.95rem;
           line-height: 1.2;
        }
        .admin-panel-copy {
           margin: 0.35rem 0 0;
           color: var(--text-muted);
           font-size: 0.8rem;
           line-height: 1.6;
        }
        .admin-progress-track {
           height: 8px;
           overflow: hidden;
           border-radius: 999px;
           background: color-mix(in srgb, var(--border) 72%, transparent);
        }
        .admin-progress-fill {
           height: 100%;
           border-radius: inherit;
           background: var(--primary-color);
           box-shadow: 0 0 18px color-mix(in srgb, var(--primary-color) 36%, transparent);
        }
        .admin-stat-card {
           min-height: 142px;
           display: flex;
           flex-direction: column;
           justify-content: space-between;
           gap: 0.78rem;
           padding: 1rem;
           overflow: hidden;
           border-radius: 10px;
        }
        .admin-stat-main {
           display: flex;
           justify-content: space-between;
           align-items: flex-start;
           gap: 1rem;
        }
        .admin-stat-title {
           margin-top: 0.72rem;
           color: var(--text);
           font-size: 0.8rem;
           font-weight: 400;
           line-height: 1.3;
        }
        .admin-stat-value {
           color: var(--stat-accent, var(--primary-color));
           font-size: clamp(1.2rem, 2vw, 1.45rem);
           font-weight: 500;
           line-height: 1;
        }
        .admin-stat-divider {
           width: 100%;
           height: 1px;
           background: var(--border);
        }
        .admin-stat-footer {
           display: flex;
           align-items: center;
           justify-content: space-between;
           gap: 1rem;
           color: var(--text-muted);
           font-size: 0.78rem;
           line-height: 1.35;
        }
        .admin-stat-footer strong,
        .admin-stat-action {
           color: var(--primary-color);
           font-weight: 500;
           font-size: 0.76rem;
           white-space: nowrap;
        }
        .admin-stat-icon {
           width: 38px;
           height: 38px;
           display: inline-flex;
           align-items: center;
           justify-content: center;
           border-radius: 4px;
           color: var(--stat-accent, var(--primary-color));
           background: transparent;
        }
        .admin-chart-card {
           padding: 1.15rem;
        }
        .admin-chart-head {
           display: flex;
           justify-content: space-between;
           align-items: flex-start;
           gap: 1rem;
           margin-bottom: 1rem;
        }
        .admin-chart-pill {
           display: inline-flex;
           align-items: center;
           border: 1px solid var(--border);
           border-radius: 999px;
           padding: 0.34rem 0.64rem;
           color: var(--primary-color);
           background: var(--primary-translucent);
           font-size: 0.68rem;
           font-weight: 500;
           white-space: nowrap;
        }
        .admin-chart-legend {
           display: flex;
           flex-wrap: wrap;
           gap: 0.8rem;
           margin-top: 0.65rem;
           color: var(--text-color);
           font-size: 0.82rem;
        }
        .admin-chart-legend span {
           display: inline-flex;
           align-items: center;
           gap: 0.4rem;
        }
        .admin-legend-dot {
           width: 9px;
           height: 9px;
           border-radius: 50%;
           background: var(--dot-color, var(--primary-color));
        }
        .admin-workload-chart {
           display: grid;
           gap: 0.9rem;
        }
        .admin-workload-summary {
           display: grid;
           grid-template-columns: repeat(3, minmax(0, 1fr));
           overflow: hidden;
           border: 1px solid var(--border);
           border-radius: 12px;
           background: var(--card-bg);
        }
        .admin-workload-summary span {
           display: grid;
           grid-template-columns: auto auto 1fr;
           align-items: center;
           gap: 0.45rem;
           min-width: 0;
           padding: 0.72rem;
           border-right: 1px solid var(--border);
           color: var(--text-color);
           font-size: 0.78rem;
           font-weight: 700;
        }
        .admin-workload-summary span:last-child {
           border-right: 0;
        }
        .admin-workload-summary i {
           width: 8px;
           height: 8px;
           border-radius: 50%;
           background: var(--series-color, var(--primary-color));
        }
        .admin-workload-summary strong {
           color: var(--series-color, var(--primary-color));
           font-size: 1rem;
           line-height: 1;
        }
        .admin-workload-plot {
           display: grid;
           grid-template-columns: repeat(auto-fit, minmax(54px, 1fr));
           gap: 0.72rem;
           min-height: 220px;
           padding: 0.9rem 0.65rem 0.6rem;
           border: 1px solid var(--border);
           border-radius: 14px;
           background: var(--card-bg);
        }
        .admin-workload-day {
           display: grid;
           grid-template-rows: 1fr auto;
           gap: 0.5rem;
           min-width: 0;
        }
        .admin-workload-bars {
           display: flex;
           align-items: flex-end;
           justify-content: center;
           gap: 0.22rem;
           min-height: 168px;
           padding-inline: 0.15rem;
           border-bottom: 1px solid var(--border);
        }
        .admin-workload-bar {
           display: block;
           width: 10px;
           min-height: 3px;
           border-radius: 4px 4px 0 0;
           transition: opacity 0.18s ease, transform 0.18s ease;
        }
        .admin-workload-bar:hover {
           opacity: 1 !important;
           transform: translateY(-3px);
        }
        .admin-workload-day time {
           color: var(--text-color);
           font-size: 0.72rem;
           font-weight: 700;
           text-align: center;
           white-space: nowrap;
        }
        .admin-outcome-chart {
           display: grid;
           gap: 0.95rem;
        }
        .admin-outcome-stack {
           display: flex;
           align-items: stretch;
           height: 16px;
           overflow: hidden;
           border: 1px solid var(--border);
           border-radius: 999px;
           background: var(--admin-surface-soft);
        }
        .admin-outcome-stack span {
           min-width: 5px;
           border-right: 2px solid var(--card-bg);
        }
        .admin-outcome-stack span:last-child {
           border-right: 0;
        }
        .admin-distribution-list {
           display: grid;
           gap: 0;
        }
        .admin-distribution-row {
           display: grid;
           gap: 0.45rem;
           padding: 0.72rem 0;
           border-bottom: 1px solid var(--border);
        }
        .admin-distribution-row:last-child {
           border-bottom: 0;
        }
        .admin-distribution-row header {
           display: flex;
           justify-content: space-between;
           align-items: center;
           gap: 1rem;
        }
        .admin-distribution-label {
           display: inline-flex;
           align-items: center;
           min-width: 0;
           gap: 0.52rem;
        }
        .admin-distribution-label i {
           width: 10px;
           height: 10px;
           border-radius: 2px;
           background: var(--row-color, var(--primary-color));
           flex: 0 0 auto;
        }
        .admin-distribution-row strong {
           color: var(--text);
           font-size: 0.9rem;
        }
        .admin-distribution-row span {
           color: var(--text-color);
           font-size: 0.84rem;
           font-weight: 700;
           white-space: nowrap;
        }
        .admin-signal-list {
           display: grid;
           gap: 1rem;
           margin-top: 1rem;
        }
        .admin-signal-row {
           display: grid;
           gap: 0.5rem;
           border-radius: 16px;
           padding: 0.8rem;
           background: color-mix(in srgb, var(--admin-surface-soft) 48%, transparent);
        }
        .admin-signal-row header {
           display: flex;
           justify-content: space-between;
           gap: 1rem;
           color: var(--text);
        }
        .admin-lecture-panel {
           overflow: hidden;
        }
        .admin-lecture-head {
           display: flex;
           justify-content: space-between;
           align-items: flex-start;
           gap: 1rem;
           padding: 1.15rem;
           border-bottom: 1px solid var(--border);
        }
        .admin-lecture-list {
           display: grid;
        }
        .admin-lecture-row {
           display: grid;
           grid-template-columns: 42px minmax(0, 1fr) auto;
           align-items: center;
           gap: 1rem;
           min-width: 0;
           padding: 1rem 1.15rem;
           border-bottom: 1px solid var(--border);
           transition: background 0.18s ease;
        }
        .admin-lecture-row:last-child {
           border-bottom: 0;
        }
        .admin-lecture-row:hover {
           background: var(--admin-surface-soft);
        }
        .admin-lecture-index {
           display: inline-flex;
           align-items: center;
           justify-content: center;
           width: 42px;
           height: 42px;
           border: 1px solid var(--border);
           border-radius: 10px;
           color: var(--primary-color);
           font-size: 0.78rem;
           font-weight: 900;
        }
        .admin-lecture-main {
           display: grid;
           gap: 0.28rem;
           min-width: 0;
        }
        .admin-lecture-main strong {
           color: var(--text);
           font-size: 0.96rem;
           line-height: 1.35;
           overflow: hidden;
           text-overflow: ellipsis;
           white-space: nowrap;
        }
        .admin-lecture-main span {
           color: var(--text-color);
           font-size: 0.8rem;
           overflow: hidden;
           text-overflow: ellipsis;
           white-space: nowrap;
        }
        .admin-lecture-meta {
           display: flex;
           align-items: center;
           justify-content: flex-end;
           gap: 0.55rem;
           flex-wrap: wrap;
           max-width: 360px;
        }
        .admin-source-pill {
           display: inline-flex;
           align-items: center;
           border: 1px solid var(--primary-color);
           border-radius: 999px;
           padding: 0.3rem 0.58rem;
           color: var(--primary-color);
           font-size: 0.72rem;
           font-weight: 900;
           white-space: nowrap;
        }
        .admin-lecture-meta time {
           color: var(--text-color);
           font-size: 0.76rem;
           font-weight: 700;
           white-space: nowrap;
        }
        .admin-lecture-empty {
           padding: 3rem 1.15rem;
           color: var(--text-color);
           text-align: center;
        }
        .admin-log-timeline {
           position: relative;
           display: grid;
           gap: 0;
           padding: 0.4rem 0;
        }
        .admin-log-timeline::before {
           content: "";
           position: absolute;
           top: 2rem;
           bottom: 2rem;
           left: 25px;
           width: 1px;
           background: var(--border);
        }
        .admin-log-entry {
           position: relative;
           display: grid;
           grid-template-columns: 52px 1fr;
           gap: 1rem;
           padding: 1rem 1.1rem;
           border-bottom: 1px solid var(--border);
           transition: background 0.18s ease;
        }
        .admin-log-entry:last-child {
           border-bottom: 0;
        }
        .admin-log-entry:hover {
           background: color-mix(in srgb, var(--admin-surface-soft) 54%, transparent);
        }
        .admin-log-icon {
           position: relative;
           z-index: 1;
           width: 52px;
           height: 52px;
           display: inline-flex;
           align-items: center;
           justify-content: center;
           border: 1px solid var(--border);
           border-radius: 50%;
           color: var(--log-color, var(--primary-color));
           background: var(--card-bg);
           box-shadow: 0 12px 26px rgba(30, 41, 59, 0.08);
        }
        .admin-log-content {
           min-width: 0;
           display: grid;
           gap: 0.55rem;
        }
        .admin-log-topline {
           display: flex;
           justify-content: space-between;
           align-items: flex-start;
           gap: 1rem;
           flex-wrap: wrap;
        }
        .admin-log-title {
           display: flex;
           align-items: center;
           gap: 0.65rem;
           flex-wrap: wrap;
        }
        .admin-log-title strong {
           color: var(--text);
           font-size: 0.98rem;
        }
        .admin-log-time {
           color: var(--text-muted);
           font-size: 0.8rem;
           white-space: nowrap;
        }
        .admin-log-message {
           color: var(--text);
           line-height: 1.55;
           overflow-wrap: anywhere;
        }
        .admin-log-meta {
           display: flex;
           flex-wrap: wrap;
           gap: 0.6rem;
           color: var(--text-muted);
           font-size: 0.82rem;
        }
        
        /* Bell Wobble Animation */
        @keyframes admin-bell-wobble {
           0% { transform: rotate(0); }
           15% { transform: rotate(15deg); }
           30% { transform: rotate(-15deg); }
           45% { transform: rotate(10deg); }
           60% { transform: rotate(-10deg); }
           75% { transform: rotate(4deg); }
           85% { transform: rotate(-4deg); }
           100% { transform: rotate(0); }
        }
        .admin-icon-btn:hover .admin-bell-icon {
           animation: admin-bell-wobble 0.6s ease-in-out;
        }

        /* Pulsing Alert Dot */
        .admin-badge-dot {
           position: absolute;
           top: 6px;
           right: 6px;
           width: 8px;
           height: 8px;
           background-color: var(--danger-color);
           border-radius: 50%;
           border: 2px solid ${cardBg};
        }
        @keyframes admin-ping {
           0% {
              transform: scale(1);
              opacity: 0.9;
           }
           70% {
              transform: scale(2.2);
              opacity: 0;
           }
           100% {
              transform: scale(2.2);
              opacity: 0;
           }
        }
        .admin-badge-dot::after {
           content: '';
           position: absolute;
           top: -2px;
           left: -2px;
           width: 8px;
           height: 8px;
           border-radius: 50%;
           border: 2px solid var(--danger-color);
           animation: admin-ping 1.6s infinite ease-out;
           opacity: 0.9;
        }

         /* Custom Scrollbar Styling for Admin Dashboard and content areas */
         .admin-theme-aware ::-webkit-scrollbar,
         .admin-theme-aware::-webkit-scrollbar {
            width: 8px;
            height: 8px;
         }
         .admin-theme-aware ::-webkit-scrollbar-track,
         .admin-theme-aware::-webkit-scrollbar-track {
            background: var(--bg-color);
         }
         .admin-theme-aware ::-webkit-scrollbar-thumb,
         .admin-theme-aware::-webkit-scrollbar-thumb {
            background: var(--border-color);
            border-radius: 6px;
            border: 2px solid var(--bg-color);
         }
         .admin-theme-aware ::-webkit-scrollbar-thumb:hover,
         .admin-theme-aware::-webkit-scrollbar-thumb:hover {
            background: var(--primary-color);
         }
         
         /* Firefox scrollbar compatibility support */
         .admin-theme-aware,
         .admin-theme-aware * {
            scrollbar-width: thin;
            scrollbar-color: var(--border-color) var(--bg-color);
         }

         @media (max-width: 760px) {
            .admin-user-summary {
               grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .admin-workload-summary {
               grid-template-columns: 1fr;
            }
            .admin-workload-summary span {
               border-right: 0;
               border-bottom: 1px solid var(--border);
            }
            .admin-workload-summary span:last-child {
               border-bottom: 0;
            }
            .admin-lecture-row {
               grid-template-columns: 36px minmax(0, 1fr);
               align-items: flex-start;
            }
            .admin-lecture-index {
               width: 36px;
               height: 36px;
            }
            .admin-lecture-meta {
               grid-column: 2;
               justify-content: flex-start;
               max-width: 100%;
            }
            .admin-user-summary-item:nth-child(2) {
               border-right: 0;
            }
            .admin-user-summary-item:nth-child(-n + 2) {
               border-bottom: 1px solid var(--border);
            }
         }

         @media (max-width: 520px) {
            .admin-user-summary {
               grid-template-columns: 1fr;
            }
            .admin-lecture-head {
               flex-direction: column;
            }
            .admin-workload-plot {
               grid-template-columns: repeat(4, minmax(46px, 1fr));
               overflow-x: auto;
            }
            .admin-user-summary-item {
               border-right: 0;
               border-bottom: 1px solid var(--border);
            }
            .admin-user-summary-item:last-child {
               border-bottom: 0;
            }
         }

         @media (max-width: 980px) {
             .admin-mobile-menu-btn {
                display: inline-flex !important;
             }
             .admin-sidebar {
                position: fixed;
                top: 0;
                bottom: 0;
                left: 0;
                z-index: 10000;
                width: 288px;
                transform: translateX(-100%);
                transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
                box-shadow: 20px 0 50px rgba(0, 0, 0, 0.3);
             }
             .admin-sidebar.is-open {
                transform: translateX(0);
             }
             .admin-sidebar-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.6);
                backdrop-filter: blur(4px);
                z-index: 9999;
                border: none;
                cursor: pointer;
                animation: admin-fade-in 0.2s ease-out;
             }
             @keyframes admin-fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
             }
          }
      `}</style>

      <div className="admin-theme-aware admin-shell">
        {isSidebarOpen && (
          <button
            className="admin-sidebar-backdrop"
            aria-label="Close menu"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        <aside className={`admin-sidebar ${isSidebarOpen ? "is-open" : ""}`}>
          
          <div className="admin-brand-panel">
            <img src={theme === "dark" ? "/barobadi-logo-dark.png" : "/barobadi-logo.png"} alt="BaroBadi Admin Logo" style={{ width: '150px', height: 'auto', objectFit: 'contain', cursor: 'pointer' }} onClick={() => router.push('/admin/dashboard')} />
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
            <Link href="/admin/dashboard" className={`admin-nav-link ${pathname === '/admin/dashboard' ? 'active' : ''}`}>
              <MdDashboard size={20} /> System Overview
            </Link>
            <Link href="/admin/users" className={`admin-nav-link ${pathname === '/admin/users' ? 'active' : ''}`}>
              <MdPeople size={20} /> Manage Users
            </Link>
            <Link href="/admin/lectures" className={`admin-nav-link ${pathname === '/admin/lectures' ? 'active' : ''}`}>
              <MdOutlineOndemandVideo size={20} /> Lecture Oversight
            </Link>
            <Link href="/admin/messages" className={`admin-nav-link ${pathname === '/admin/messages' ? 'active' : ''}`}>
              <MdEmail size={20} /> User Messages
            </Link>
            <Link href="/admin/logs" className={`admin-nav-link ${pathname === '/admin/logs' ? 'active' : ''}`}>
              <FaTools size={20} /> System Logs
            </Link>
          </nav>
        </aside>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <header className="admin-topbar">
             <div className="admin-topbar-title">
                 <button
                   className="admin-mobile-menu-btn"
                   onClick={() => setIsSidebarOpen(true)}
                   style={{
                     background: "transparent",
                     border: "none",
                     color: "var(--text-color)",
                     cursor: "pointer",
                     marginRight: "0.75rem",
                     display: "none",
                     alignItems: "center",
                     padding: "4px"
                   }}
                 >
                    <MdMenu size={24} style={{ color: "var(--primary-color)" }} />
                 </button>
                 Admin Portal
             </div>
             <div ref={dropdownRef} style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                 <button onClick={toggleTheme} className="admin-icon-btn" title="Toggle Theme">
                    {theme === "dark" ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
                 </button>
                 
                 {/* Notifications Bell */}
                 <div style={{ position: "relative" }}>
                     <button onClick={() => { setShowNotifications(!showNotifications); setShowProfile(false); }} className="admin-icon-btn" title="System Alerts">
                         <MdNotifications className="admin-bell-icon" size={20} />
                         {notifications.length > 0 && <span className="admin-badge-dot"></span>}
                     </button>
                    {showNotifications && (
                        <div style={{ position: "absolute", top: "100%", right: "0", background: cardBg, border: `1px solid ${border}`, borderRadius: "8px", width: "350px", padding: "1rem", boxShadow: "0 10px 15px rgba(0,0,0,0.1)", zIndex: 9999 }}>
                            <h4 style={{ margin: "0 0 1rem 0", color: text }}>Recent Activity</h4>
                            {notifications.length === 0 ? (
                                <div style={{ color: textMuted, fontSize: "0.9rem" }}>No recent activity.</div>
                            ) : (
                                notifications.map((n, i) => (
                                    <div key={i} style={{ padding: "0.8rem 0", borderBottom: i === notifications.length - 1 ? "none" : `1px solid ${border}`, fontSize: "0.85rem", color: text, display: "flex", gap: "10px", alignItems: "flex-start" }}>
                                        <span style={{ fontSize: "1.2rem" }}>
                                            {n.level === "INFO" ? <FaRocket size={16} color="var(--primary-color)" /> : n.level === "ERROR" ? <FaExclamationTriangle size={16} color="var(--warning-color)" /> : <FaCheckCircle size={16} color="var(--success-color)" />}
                                        </span>
                                        <div>
                                            <div style={{ marginBottom: "2px" }}>{n.message}</div>
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
                        <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--primary-color)", overflow: "hidden", display: "flex", justifyContent: "center", alignItems: "center", border: `2px solid ${border}` }}>
                             {user.profile_picture_url && !user.profile_picture_url.includes("next.svg") ? (
                                <img src={apiUrl(user.profile_picture_url)} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                             ) : (
                                <span style={{ fontSize: "1.2rem", color: "white", fontWeight: "bold" }}>{user.full_name?.charAt(0) || "A"}</span>
                             )}
                        </div>
                        <span style={{ color: text, fontWeight: "bold" }}><MdKeyboardArrowDown size={22} color="var(--text-muted)" style={{marginLeft: "4px"}} /></span>
                    </button>
                    {showProfile && (
                        <div style={{ position: "absolute", top: "100%", right: "0", background: cardBg, border: `1px solid ${border}`, borderRadius: "8px", width: "250px", padding: "1rem", boxShadow: "0 10px 15px rgba(0,0,0,0.1)", zIndex: 9999, marginTop: "10px" }}>
                            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                                <div style={{ width: "60px", height: "60px", borderRadius: "50%", background: "var(--primary-color)", overflow: "hidden", display: "inline-flex", justifyContent: "center", alignItems: "center", fontSize: "1.5rem", fontWeight: "bold", marginBottom: "10px" }}>
                                     {user.profile_picture_url && !user.profile_picture_url.includes("next.svg") ? (
                                        <img src={apiUrl(user.profile_picture_url)} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                     ) : (
                                        <span style={{ color: "white" }}>{user.full_name?.charAt(0) || "A"}</span>
                                     )}
                                </div>
                                <h4 style={{ margin: 0, color: text }}>{user.full_name}</h4>
                                <p style={{ margin: 0, color: textMuted, fontSize: "0.85rem" }}>{user.email}</p>
                            </div>
                            <div style={{ borderTop: `1px solid ${border}`, paddingTop: "0.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                <Link href="/admin/profile" onClick={() => setShowProfile(false)} style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: text, padding: "0.5rem", borderRadius: "6px" }} className="hover:bg-opacity-50">
                                   <MdSettings size={20} />
                                   <span>Edit Profile Info</span>
                                </Link>
                                <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "var(--primary-color)", padding: "0.5rem", borderRadius: "6px", fontWeight: "bold" }} className="hover:bg-opacity-50">
                                   <MdLogout size={20} />
                                   <span>Sign Out</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

             </div>
          </header>
          <main className="admin-main">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
