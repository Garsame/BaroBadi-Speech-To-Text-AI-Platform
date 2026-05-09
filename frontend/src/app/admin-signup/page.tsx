"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiUrl, fetchCurrentUser } from "@/lib/api";
import { clearSession, persistSession } from "@/lib/session";

export default function AdminSignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState("dark");

  useEffect(() => {
    const savedTheme = localStorage.getItem("admin-theme") || "dark";
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("admin-theme", newTheme);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        email: email,
        password: password,
        full_name: name,
      };

      const res = await fetch(apiUrl("/api/v1/auth/admin-signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to create Admin account.");
      }

      // Log in immediately after successful signup
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const loginRes = await fetch(apiUrl("/api/v1/auth/login"), {
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
        router.replace("/admin-login");
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

  const isLight = theme === "light";
  const bg = isLight ? "#f8fafc" : "#0f172a";
  const cardBg = isLight ? "#ffffff" : "#1e293b";
  const border = isLight ? "#e2e8f0" : "#334155";
  const text = isLight ? "#1e293b" : "#f8fafc";
  const textMuted = isLight ? "#64748b" : "#94a3b8";
  const inputBg = isLight ? "#f1f5f9" : "#0f172a";

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", backgroundColor: bg, transition: "background 0.3s" }}>
      <button onClick={toggleTheme} style={{ position: "absolute", top: "2rem", right: "2rem", background: cardBg, color: text, border: `1px solid ${border}`, padding: "10px", borderRadius: "50%", cursor: "pointer", fontSize: "1.2rem", boxShadow: "0 4px 6px rgba(0,0,0,0.1)" }}>
          {isLight ? "🌙" : "☀️"}
      </button>

      <div style={{ width: "100%", maxWidth: "450px", backgroundColor: cardBg, padding: "3rem", borderRadius: "12px", border: `1px solid ${border}`, boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
           <div style={{ width: "50px", height: "50px", background: "#ef4444", color: "white", borderRadius: "12px", display: "inline-flex", justifyContent: "center", alignItems: "center", fontSize: "1.5rem", fontWeight: "bold", marginBottom: "1rem" }}>A+</div>
           <h2 style={{ fontSize: "1.8rem", color: text, margin: 0 }}>Create Admin Account</h2>
           <p style={{ color: textMuted, marginTop: "0.5rem" }}>Register a new SuperAdmin</p>
        </div>

        {error && <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem", border: "1px solid rgba(239, 68, 68, 0.3)" }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", color: text }}>Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: `1px solid ${border}`, background: inputBg, color: text }}
            />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: "0.5rem", color: text }}>Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: `1px solid ${border}`, background: inputBg, color: text }}
            />
          </div>
          <div style={{ position: "relative" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", color: text }}>Master Password</label>
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: `1px solid ${border}`, background: inputBg, color: text }}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "10px", top: "35px", background: "transparent", border: "none", color: textMuted, cursor: "pointer", fontSize: "1.2rem" }}>
               {showPassword ? "👁️" : "👁️‍🗨️"}
            </button>
          </div>
          <button type="submit" disabled={loading} style={{ width: "100%", padding: "1rem", background: "#ef4444", color: "white", fontWeight: "bold", border: "none", borderRadius: "8px", cursor: loading ? "not-allowed" : "pointer", fontSize: "1rem", marginTop: "0.5rem" }}>
            {loading ? "Registering..." : "Create Admin Hub"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: "1.5rem", fontSize: "0.9rem" }}>
           <span style={{ color: textMuted }}>Already have an admin account? </span>
           <Link href="/admin-login" style={{ color: "#38bdf8", textDecoration: "none" }}>Sign In</Link>
        </div>
      </div>
    </div>
  );
}
