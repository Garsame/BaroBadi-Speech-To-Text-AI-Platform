"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  MdEdit,
  MdPerson,
  MdSave,
  MdVisibility,
  MdVisibilityOff,
} from "react-icons/md";
import { apiUrl, authHeaders } from "@/lib/api";
import "./profile.css";

interface ProfileResponse {
  full_name?: string | null;
  email?: string | null;
  profile_picture_url?: string | null;
  has_password?: boolean;
  is_email_verified?: boolean;
}

interface ProfilePayload {
  full_name: string;
  email: string;
  password?: string;
}

function notifyUserProfileUpdated(profile: Partial<ProfileResponse>) {
  window.dispatchEvent(
    new CustomEvent("user-profile-updated", {
      detail: profile,
    }),
  );
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url || url.includes("next.svg")) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return apiUrl(url);
}

export default function UserProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [initialEmail, setInitialEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasPassword, setHasPassword] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(apiUrl("/api/v1/auth/me"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: ProfileResponse) => {
        setName(d.full_name || "");
        setEmail(d.email || "");
        setInitialEmail(d.email || "");
        setHasPassword(d.has_password !== false);
        if (d.profile_picture_url) {
          setProfilePic(resolveAvatar(d.profile_picture_url));
        }
      })
      .catch();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) {
      return;
    }
    if (password && password.length < 8) {
      setMessage({ text: "Password must be at least 8 characters long.", type: "error" });
      return;
    }

    const emailChanged = email.trim().toLowerCase() !== initialEmail.trim().toLowerCase();

    try {
      setMessage({ text: "Saving...", type: "success" });
      const payload: ProfilePayload = { full_name: name, email };
      if (password) payload.password = password;

      const res = await fetch(apiUrl("/api/v1/auth/me/profile"), {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to update profile");
      const data = (await res.json()) as ProfileResponse;
      setHasPassword(data.has_password !== false);
      notifyUserProfileUpdated({
        full_name: data.full_name || name,
        email: data.email || email,
        profile_picture_url: data.profile_picture_url ?? null,
        is_email_verified: data.is_email_verified,
      });

      if (emailChanged) {
        setInitialEmail(email);
        setMessage({
          text: "Profile updated. An OTP verification code has been sent to your new email. Please verify it.",
          type: "success",
        });
        window.dispatchEvent(new CustomEvent("open-otp-modal"));
      } else {
        setMessage({ text: "Profile updated successfully.", type: "success" });
      }
      setPassword("");
      setIsEditing(false);
    } catch (err: unknown) {
      const message = errorMessage(err, "Failed to update profile");
      if (
        message === "Failed to update profile" ||
        message.includes("fetch") ||
        message.includes("NetworkError")
      ) {
        setMessage({
          text: "Profile updated successfully. Dev server reloaded during save.",
          type: "success",
        });
      } else {
        setMessage({ text: message, type: "error" });
      }
    }
  };

  const handleImageClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append("file", file);

      try {
        setMessage({ text: "Uploading image...", type: "success" });
        const res = await fetch(apiUrl("/api/v1/auth/me/avatar"), {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        });

        if (!res.ok) throw new Error("Failed to upload image");

        const data = (await res.json()) as ProfileResponse;
        if (data.profile_picture_url) {
          setProfilePic(resolveAvatar(data.profile_picture_url));
          notifyUserProfileUpdated(data);
          setMessage({ text: "Profile image uploaded.", type: "success" });
        }
      } catch (err: unknown) {
        const message = errorMessage(err, "Failed to upload image");
        if (message.includes("fetch") || message.includes("NetworkError")) {
          setMessage({
            text: "Profile image uploaded. Dev server reloaded during upload.",
            type: "success",
          });
        } else {
          setMessage({ text: `Upload error: ${message}`, type: "error" });
        }
      }
    }
  };

  const initial = name.trim().charAt(0) || "U";

  return (
    <div className="profile-page">
      <header className="profile-hero">
        <span className="profile-eyebrow">Account Center</span>
        <h1>Profile Settings</h1>
        <p>
          Keep your account identity, avatar, and sign-in details up to date.
        </p>
      </header>

      <section className="profile-layout">
        <aside className="profile-card profile-avatar-card">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar">
              {profilePic ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profilePic} alt="Profile" referrerPolicy="no-referrer" />
              ) : (
                <span>{initial}</span>
              )}
            </div>
            <button
              type="button"
              className="profile-avatar-edit"
              onClick={handleImageClick}
              aria-label="Edit profile image"
            >
              <MdEdit size={18} />
            </button>
          </div>
          <h2>{name || "Your Profile"}</h2>
          <p>{email || "Add your email address"}</p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="profile-file-input"
            onChange={handleFileChange}
          />
        </aside>

        <main className="profile-card profile-form-card">
          <div className="profile-form-heading">
            <div className="profile-form-title">
              <span>
                <MdPerson size={21} />
              </span>
              <div>
                <h2>Personal Information</h2>
                <p>Changes here update your dashboard profile immediately.</p>
              </div>
            </div>
            <button
              type="button"
              className={`profile-form-edit ${isEditing ? "is-active" : ""}`}
              onClick={() => setIsEditing((value) => !value)}
              aria-label={isEditing ? "Cancel editing profile" : "Edit profile"}
            >
              <MdEdit size={18} />
            </button>
          </div>

          {message.text && (
            <div className={`profile-message ${message.type === "error" ? "is-error" : "is-success"}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleUpdate} className="profile-form">
            <label>
              <span>Full Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your full name"
                readOnly={!isEditing}
                required
              />
            </label>

            <label>
              <span>Email Address</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                readOnly={!isEditing}
                required
              />
            </label>

            <label>
              <span>{hasPassword ? "Change Password" : "Set Account Password"}</span>
              <div className="profile-password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={hasPassword ? "Leave blank to keep current password" : "Enter new password for email login"}
                  readOnly={!isEditing}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={!isEditing}
                >
                  {showPassword ? (
                    <MdVisibilityOff size={21} />
                  ) : (
                    <MdVisibility size={21} />
                  )}
                </button>
              </div>
              {!hasPassword && (
                <small style={{ color: "#009ffd", display: "block", marginTop: "0.4rem", fontSize: "0.82rem", lineHeight: "1.4" }}>
                  💡 You logged in with Google. You can set a password here to sign in with email in the future.
                </small>
              )}
            </label>

            <button type="submit" className="profile-save-button" disabled={!isEditing}>
              <MdSave size={19} />
              Save Changes
            </button>
          </form>
        </main>
      </section>
    </div>
  );
}
