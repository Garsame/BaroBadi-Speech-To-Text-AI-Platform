"use client";

import React, { useState } from "react";

const GoogleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.85z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function GoogleChooserPage() {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const accounts = [
    { name: "Abdirahim Mohamud", email: "garsame40@gmail.com", initial: "A", color: "#3f51b5" },
    { name: "Garsame Learns", email: "garsamelearns@gmail.com", initial: "G", color: "#009688" },
    { name: "Garsame M Iftin", email: "hooyomcn102@gmail.com", initial: "G", color: "#e91e63" },
    { name: "bulle impact", email: "bulleimpact@gmail.com", initial: "b", color: "#ff9800" },
    { name: "Mohamed Bulle Nunow", email: "mohamedbullenunow@gmail.com", initial: "M", color: "#9c27b0" },
    { name: "Garsame M Iftin", email: "garsamemiftin@gmail.com", initial: "G", color: "#4caf50" },
  ];

  const handleSelect = (selectedEmail: string, selectedName: string) => {
    if (window.opener) {
      window.opener.postMessage(
        { type: "google-login-success", token: `mock-google-token-${selectedEmail}:${selectedName}` },
        window.location.origin
      );
      window.close();
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && name) {
      handleSelect(email, name);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#f0f4f9",
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      fontFamily: "Roboto, Arial, sans-serif",
      color: "#1f1f1f",
      padding: "24px"
    }}>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1 }}>
        <div style={{
          width: "100%",
          maxWidth: "440px",
          background: "#ffffff",
          borderRadius: "28px",
          padding: "40px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)"
        }}>
          {/* Header */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "24px" }}>
            <div style={{ marginBottom: "16px" }}>
              <GoogleIcon />
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "400", margin: "0 0 8px", color: "#1f1f1f" }}>
              Choose an account
            </h1>
            <p style={{ fontSize: "0.95rem", margin: "0", color: "#474747" }}>
              to continue to <span style={{ color: "#0b57d0", fontWeight: "500" }}>Baro Platform</span>
            </p>
          </div>

          {!showCustomForm ? (
            /* Accounts List */
            <div style={{ display: "flex", flexDirection: "column", border: "1px solid #c7c7c7", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ maxHeight: "280px", overflowY: "auto" }}>
                {accounts.map((acc, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelect(acc.email, acc.name)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "16px 20px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid #e3e3e3",
                      cursor: "pointer",
                      width: "100%",
                      textAlign: "left",
                      transition: "background 0.2s"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = "#f7f9fc"}
                    onMouseOut={(e) => e.currentTarget.style.background = "none"}
                  >
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      background: acc.color,
                      color: "#ffffff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "bold",
                      fontSize: "0.95rem",
                      marginRight: "14px"
                    }}>
                      {acc.initial}
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", fontWeight: "500", color: "#1f1f1f" }}>{acc.name}</div>
                      <div style={{ fontSize: "0.8rem", color: "#5e5e5e" }}>{acc.email}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Use another account option */}
              <button
                onClick={() => setShowCustomForm(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "16px 20px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  color: "#0b57d0",
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  transition: "background 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.background = "#f7f9fc"}
                onMouseOut={(e) => e.currentTarget.style.background = "none"}
              >
                <div style={{
                  width: "32px",
                  height: "32px",
                  marginRight: "14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#0b57d0">
                    <path d="M9 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm0 7c-2.67 0-8 1.34-8 4v3h16v-3c0-2.66-5.33-4-8-4zm6 5H3v-.99C3.17 14.7 6.06 14 9 14s5.83.7 6 2.01V18zm6-4v-3h-3v-2h3V6h2v3h3v2h-3v3h-2z"/>
                  </svg>
                </div>
                Use another account
              </button>
            </div>
          ) : (
            /* Custom Account Sign-In Form */
            <form onSubmit={handleCustomSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.82rem", color: "#474747", fontWeight: "500" }}>Google Name</label>
                <input
                  type="text"
                  required
                  placeholder="Enter name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    border: "1px solid #c7c7c7",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "0.9rem",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label style={{ fontSize: "0.82rem", color: "#474747", fontWeight: "500" }}>Google Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{
                    border: "1px solid #c7c7c7",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "0.9rem",
                    outline: "none"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setShowCustomForm(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#0b57d0",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    cursor: "pointer",
                    padding: "10px 16px",
                    borderRadius: "4px"
                  }}
                >
                  Back
                </button>
                <button
                  type="submit"
                  style={{
                    background: "#0b57d0",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "100px",
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    cursor: "pointer",
                    padding: "10px 24px",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.15)"
                  }}
                >
                  Next
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Footer Links */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "0.75rem",
        color: "#5e5e5e",
        maxWidth: "440px",
        width: "100%",
        margin: "0 auto"
      }}>
        <span>English (United States)</span>
        <div style={{ display: "flex", gap: "16px" }}>
          <span style={{ cursor: "pointer" }}>Help</span>
          <span style={{ cursor: "pointer" }}>Privacy</span>
          <span style={{ cursor: "pointer" }}>Terms</span>
        </div>
      </div>
    </div>
  );
}
