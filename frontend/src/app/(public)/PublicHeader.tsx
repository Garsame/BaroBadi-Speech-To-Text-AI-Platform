"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { 
  MdArrowOutward, 
  MdClose, 
  MdMenu, 
  MdNotifications, 
  MdKeyboardArrowDown, 
  MdSettings, 
  MdLogout, 
  MdWarning,
  MdCheckCircle,
  MdRocketLaunch,
  MdVerified
} from "react-icons/md";
import ThemeToggle from "@/components/ThemeToggle";
import { getSessionToken, clearSession } from "@/lib/session";
import { fetchCurrentUser, apiUrl, authHeaders, type AuthenticatedUser } from "@/lib/api";
import OtpVerificationModal from "@/components/OtpVerificationModal";

function resolveProfileImageUrl(profilePictureUrl?: string | null): string | null {
  if (!profilePictureUrl || profilePictureUrl.includes("next.svg")) return null;
  if (/^https?:\/\//i.test(profilePictureUrl)) return profilePictureUrl;
  return apiUrl(profilePictureUrl);
}

function getNotificationView(notification: any) {
  let Icon = MdCheckCircle;
  let tone = "success";
  let title = notification.action.replace(/_/g, " ");
  let description = "";

  if (notification.action === "USER_LOGIN") {
    title = "Logged in";
    description = `Session started for ${notification.details?.email || "your account"}.`;
  } else if (notification.action === "USER_SIGNUP") {
    title = "Account created";
    description = "Your BaroBadi learning workspace is ready.";
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
  } else if (notification.action === "EMAIL_VERIFICATION_REQUIRED") {
    Icon = MdWarning;
    tone = "danger";
    title = "Verify email";
    description = "Your email is unverified. Click to verify now.";
  } else if (notification.action === "EMAIL_VERIFIED") {
    Icon = MdCheckCircle;
    tone = "success";
    title = "User verified";
    description = "Your email has been verified successfully.";
  }

  return { Icon, tone, title, description };
}

export default function PublicHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);

  const closeMenu = () => setIsMenuOpen(false);

  // Synchronize state and listen to updates
  useEffect(() => {
    const token = getSessionToken();
    if (token) {
      fetchCurrentUser(token)
        .then((currentUser) => {
          setUser(currentUser);
          fetchNotifications(currentUser);
        })
        .catch(() => {
          clearSession();
          setUser(null);
        });
    }

    function handleUserProfileUpdated(event: Event) {
      const detail = (event as CustomEvent<Partial<AuthenticatedUser>>).detail;
      if (!detail) return;

      setUser((currentUser) => {
        if (!currentUser) return currentUser;
        const updated = { ...currentUser, ...detail };
        // Refetch/re-calculate notifications
        fetchNotifications(updated);
        return updated;
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

  const fetchNotifications = async (currentUser: AuthenticatedUser) => {
    try {
      const notifRes = await fetch(apiUrl("/api/v1/auth/me/activity?limit=5"), {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (notifRes.ok) {
        let activities = await notifRes.json();
        // Prepend verification warning if unverified
        if (currentUser && !currentUser.is_email_verified) {
          activities = [
            {
              id: -999,
              action: "EMAIL_VERIFICATION_REQUIRED",
              created_at: new Date().toISOString(),
              details: { email: currentUser.email }
            },
            ...activities
          ];
        }
        setNotifications(activities);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowProfile(false);
        setShowNotifications(false);
      }

      const target = event.target as Node;
      const clickedToggle = mobileToggleRef.current && mobileToggleRef.current.contains(target);
      const clickedMenu = mobileMenuRef.current && mobileMenuRef.current.contains(target);

      if (!clickedToggle && !clickedMenu) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    clearSession();
    window.location.replace("/sign-in");
  };

  const handleVerifyEmail = async () => {
    if (isSendingVerification) return;
    setIsSendingVerification(true);
    try {
      const res = await fetch(apiUrl("/api/v1/auth/verify-email"), {
        method: "POST",
        headers: authHeaders()
      });
      if (res.ok) {
        setIsOtpModalOpen(true);
        setShowNotifications(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSendingVerification(false);
    }
  };

  // Build navLinks dynamically
  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
  ];

  if (user) {
    navLinks.push({ href: "/dashboard", label: "Dashboard" });
  }

  const profileImageUrl = user ? resolveProfileImageUrl(user.profile_picture_url) : null;
  const getInitials = (name: string) => (name ? name.charAt(0).toUpperCase() : "U");

  return (
    <header className="public-header">
      <style>{`
        /* Self-contained dropdown & avatar styling */
        .header-auth-actions {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .header-popover-wrap {
          position: relative;
        }
        .header-icon-button {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid var(--public-border);
          background: var(--public-surface-soft);
          color: var(--public-text);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          position: relative;
          transition: all 0.2s;
        }
        .header-icon-button:hover {
          background: var(--public-border);
          color: var(--public-primary);
        }
        .header-icon-button svg {
          font-size: 1.25rem;
        }
        .header-unread-dot {
          position: absolute;
          top: 6px;
          right: 6px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #ef4444;
          border: 1px solid var(--public-surface-soft);
        }
        .header-profile-trigger {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
          color: var(--public-text);
        }
        .header-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          background: var(--public-primary);
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 0.95rem;
        }
        .header-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .header-profile-name {
          font-weight: 700;
          font-size: 0.9rem;
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        @media (max-width: 640px) {
          .header-profile-name {
            display: none;
          }
        }
        
        /* Dropdowns */
        .header-dropdown {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          width: 300px;
          background: var(--public-surface);
          border: 1px solid var(--public-border);
          border-radius: 12px;
          box-shadow: var(--public-shadow);
          padding: 1rem;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .header-dropdown-heading {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid var(--public-border);
          padding-bottom: 0.5rem;
          margin-bottom: 0.25rem;
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--public-muted);
        }
        .header-dropdown-empty {
          color: var(--public-muted);
          font-size: 0.85rem;
          text-align: center;
          padding: 1rem 0;
          margin: 0;
        }
        
        /* Notification items */
        .header-notif-item {
          display: flex;
          gap: 0.75rem;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--public-border);
        }
        .header-notif-item:last-child {
          border-bottom: none;
        }
        .header-notif-icon {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .header-notif-icon.success {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }
        .header-notif-icon.info {
          background: rgba(0, 159, 253, 0.1);
          color: var(--public-accent);
        }
        .header-notif-icon.danger {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
        }
        .header-notif-content {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-size: 0.8rem;
        }
        .header-notif-content strong {
          color: var(--public-text);
          font-weight: 700;
        }
        .header-notif-content p {
          color: var(--public-muted);
          margin: 0;
          line-height: 1.3;
        }
        .header-notif-content small {
          color: var(--public-muted);
          font-size: 0.7rem;
        }
        
        /* Profile dropdown items */
        .header-profile-summary {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding-bottom: 0.75rem;
          border-bottom: 1px solid var(--public-border);
          margin-bottom: 0.25rem;
        }
        .header-profile-summary strong {
          color: var(--public-text);
          font-size: 0.95rem;
          margin-top: 0.5rem;
        }
        .header-profile-summary small {
          color: var(--public-muted);
          font-size: 0.8rem;
        }
        .header-profile-link, .header-profile-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 0.75rem;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 700;
          color: var(--public-text);
          cursor: pointer;
          background: transparent;
          border: none;
          text-align: left;
          width: 100%;
        }
        .header-profile-link:hover {
          background: var(--public-surface-soft);
          color: var(--public-primary);
        }
        .header-profile-btn {
          color: #ef4444;
        }
        .header-profile-btn:hover {
          background: rgba(239, 68, 68, 0.05);
        }
      `}</style>
      
      <div
        className={`public-container header-container ${
          isMenuOpen ? "menu-open" : ""
        }`}
      >
        <Link href={user ? "/dashboard" : "/"} className="logo" onClick={closeMenu}>
          <Image
            src="/barobadi-logo.png"
            alt="Baro Platform Logo"
            width={180}
            height={56}
            className="logo-light"
            priority
            style={{ width: "auto", height: "auto" }}
          />
          <Image
            src="/barobadi-logo-dark.png"
            alt="Baro Platform Logo"
            width={180}
            height={56}
            className="logo-dark"
            priority
            style={{ width: "auto", height: "auto" }}
          />
        </Link>

        <div className="mobile-header-tools">
          <ThemeToggle />
          <button
            ref={mobileToggleRef}
            className="mobile-nav-toggle"
            type="button"
            aria-controls="public-navigation"
            aria-expanded={isMenuOpen}
            aria-label={
              isMenuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <MdClose /> : <MdMenu />}
          </button>
        </div>

        <div ref={mobileMenuRef} className="public-menu-content">
          <nav
            id="public-navigation"
            className="public-nav"
            aria-label="Public navigation"
          >
            {navLinks.map((link) => (
              <Link
                href={link.href}
                key={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                onClick={closeMenu}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="header-actions" ref={dropdownRef}>
            <span className="desktop-theme-toggle">
              <ThemeToggle />
            </span>

            {user ? (
              /* Authenticated actions */
              <div className="header-auth-actions">
                {/* Notifications Bell */}
                <div className="header-popover-wrap">
                  <button
                    className="header-icon-button"
                    onClick={() => {
                      setShowNotifications(!showNotifications);
                      setShowProfile(false);
                    }}
                    aria-label="Show notifications"
                    title="Notifications"
                  >
                    <MdNotifications />
                    {notifications.length > 0 && <span className="header-unread-dot" />}
                  </button>

                  {showNotifications && (
                    <div className="header-dropdown">
                      <div className="header-dropdown-heading">
                        <span>Recent Activity</span>
                        <span>{notifications.length} updates</span>
                      </div>
                      {notifications.length === 0 ? (
                        <p className="header-dropdown-empty">No recent activity.</p>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", maxHeight: "280px", overflowY: "auto" }}>
                          {notifications.map((notification) => {
                            const item = getNotificationView(notification);
                            const Icon = item.Icon;
                            const isVerifyNotif = notification.action === "EMAIL_VERIFICATION_REQUIRED";

                            return (
                              <div 
                                className="header-notif-item" 
                                key={notification.id}
                                onClick={isVerifyNotif ? handleVerifyEmail : undefined}
                                style={{ cursor: isVerifyNotif ? "pointer" : "default" }}
                              >
                                <span className={`header-notif-icon ${item.tone}`}>
                                  <Icon />
                                </span>
                                <div className="header-notif-content">
                                  <strong>{item.title}</strong>
                                  {item.description && <p>{item.description}</p>}
                                  {isVerifyNotif && (
                                    <button
                                      type="button"
                                      style={{
                                        background: "var(--public-primary)",
                                        color: "#ffffff",
                                        border: "none",
                                        borderRadius: "4px",
                                        padding: "4px 10px",
                                        fontWeight: "bold",
                                        fontSize: "0.75rem",
                                        marginTop: "6px",
                                        cursor: "pointer",
                                        alignSelf: "flex-start"
                                      }}
                                    >
                                      Verify Now
                                    </button>
                                  )}
                                  {!isVerifyNotif && <small>{new Date(notification.created_at).toLocaleDateString()}</small>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Profile Trigger */}
                <div className="header-popover-wrap">
                  <button
                    className="header-profile-trigger"
                    onClick={() => {
                      setShowProfile(!showProfile);
                      setShowNotifications(false);
                    }}
                    aria-label="Show profile menu"
                  >
                    <span className="header-avatar">
                      {profileImageUrl ? (
                        <img src={profileImageUrl} alt="Profile" referrerPolicy="no-referrer" />
                      ) : (
                        getInitials(user.full_name)
                      )}
                    </span>
                    <span className="header-profile-name" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      {user.full_name}
                      {user.is_email_verified && (
                        <MdVerified style={{ color: "#1d9bf0", flexShrink: 0 }} size={16} title="Verified Email" />
                      )}
                    </span>
                    <MdKeyboardArrowDown />
                  </button>

                  {showProfile && (
                    <div className="header-dropdown" style={{ width: "240px" }}>
                      <div className="header-profile-summary">
                        <span className="header-avatar" style={{ width: "48px", height: "48px", fontSize: "1.1rem" }}>
                          {profileImageUrl ? (
                            <img src={profileImageUrl} alt="Profile" referrerPolicy="no-referrer" />
                          ) : (
                            getInitials(user.full_name)
                          )}
                        </span>
                        <strong style={{ display: "inline-flex", alignItems: "center", gap: "4px", justifyContent: "center" }}>
                          {user.full_name}
                          {user.is_email_verified && (
                            <MdVerified style={{ color: "#1d9bf0", flexShrink: 0 }} size={16} title="Verified Email" />
                          )}
                        </strong>
                        <small>{user.email}</small>
                      </div>
                      <Link href="/dashboard/profile" className="header-profile-link" onClick={() => setShowProfile(false)}>
                        <MdSettings /> Profile Settings
                      </Link>
                      <button onClick={handleLogout} className="header-profile-btn">
                        <MdLogout /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Unauthenticated actions - Hides Sign Up */
              <>
                <Link
                  href="/sign-in"
                  className="public-btn public-btn-ghost"
                  onClick={closeMenu}
                  style={{ borderRadius: "12px" }}
                >
                  <span>Sign In</span>
                  <MdArrowOutward className="auth-link-icon" aria-hidden="true" />
                </Link>
              </>
            )}
          </div>
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
    </header>
  );
}
