"use client";
// Force recompile to refresh CSS variables

import React, { useEffect, useState } from "react";
import { useTheme } from "@/hooks/useTheme";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MdDarkMode,
  MdLightMode,
  MdLock,
  MdVisibility,
  MdVisibilityOff,
} from "react-icons/md";
import { apiUrl, fetchCurrentUser } from "@/lib/api";
import { clearSession, persistSession } from "@/lib/session";
import "../admin-auth.css";

export default function AdminSignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { theme, setTheme, toggleTheme } = useTheme();





  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const payload = {
        email,
        password,
        full_name: name,
      };

      const res = await fetch(apiUrl("/api/v1/auth/admin-signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = (await res.json()) as { detail?: string };
        throw new Error(errorData.detail || "Failed to create Admin account.");
      }

      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const loginRes = await fetch(apiUrl("/api/v1/auth/admin-login"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      if (loginRes.ok) {
        const loginData = (await loginRes.json()) as { access_token: string };
        const currentUser = await fetchCurrentUser(loginData.access_token);

        persistSession(loginData.access_token);
        router.replace(
          currentUser.role === "admin" ? "/admin/dashboard" : "/dashboard",
        );
      } else {
        clearSession();
        router.replace("/maamul-login");
      }
    } catch (err: unknown) {
      clearSession();
      setError(
        err instanceof Error ? err.message : "Failed to create Admin account.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-auth-shell" data-theme={theme}>
      <button
        type="button"
        className="admin-auth-theme"
        onClick={toggleTheme}
        aria-label="Toggle admin auth theme"
      >
        {theme === "dark" ? <MdLightMode size={20} /> : <MdDarkMode size={20} />}
      </button>

      <section className="admin-auth-card">
        <div className="admin-auth-brand" style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
          <img src={theme === "dark" ? "/barobadi-logo-dark.png" : "/barobadi-logo.png"} alt="Baro Platform Logo" style={{ width: '160px', height: 'auto', objectFit: 'contain' }} />
        </div>

        <div className="admin-auth-heading">
          <h1>Create Account</h1>
          <p>Create a new administrator account for platform management.</p>
        </div>

        {error && <div className="admin-auth-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="admin-auth-form">
          <label>
            <span>Full Name</span>
            <input
              type="text"
              placeholder="Admin full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label>
            <span>Email Address</span>
            <input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label>
            <span>Password</span>
            <div className="admin-auth-password">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Create a secure password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <MdVisibilityOff size={20} />
                ) : (
                  <MdVisibility size={20} />
                )}
              </button>
            </div>
          </label>

          <label className="admin-auth-check admin-auth-terms">
            <input type="checkbox" required />
            <span>I confirm this account is for authorized admin access.</span>
          </label>

          <button type="submit" className="admin-auth-submit" disabled={loading}>
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <p className="admin-auth-switch">
          Already have an admin account?{" "}
          <Link href="/maamul-login">Sign in here</Link>
        </p>
      </section>
    </main>
  );
}
