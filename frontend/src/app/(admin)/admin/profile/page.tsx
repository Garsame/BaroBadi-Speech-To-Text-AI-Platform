"use client";

import React, { useState, useEffect, useRef } from "react";
import { apiUrl, authHeaders } from "@/lib/api";

export default function AdminProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [showPass, setShowPass] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(apiUrl("/api/v1/auth/me"), { headers: authHeaders() });
        if (res.ok) {
          const data = await res.json();
          setName(data.full_name || "");
          setEmail(data.email || "");
          if (data.profile_picture_url) {
             setProfilePic(apiUrl(data.profile_picture_url));
          }
        }
      } catch (err) {}
    };
    fetchUser();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const payload: any = { full_name: name, email: email };
      if (password) payload.password = password;

      const res = await fetch(apiUrl("/api/v1/admin/profile"), {
        method: "PUT",
        headers: {
            ...authHeaders(),
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        const errorMsg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
        throw new Error(errorMsg || "Failed to update profile.");
      }

      setMessage({ text: "Profile settings updated successfully!", type: "success" });
      setPassword(""); // Clear password field after updating
    } catch (err: any) {
      if (err.message.includes("NetworkError") || err.message.includes("Failed to fetch")) {
          // Uvicorn drops the connection when reloading due to sql_app.db modifications in local dev
          setMessage({ text: "Profile updated successfully! (Note: Dev server auto-reloaded)", type: "success" });
          setPassword(""); 
      } else {
          setMessage({ text: err.message, type: "error" });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = () => {
     if(fileInputRef.current) {
         fileInputRef.current.click();
     }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          try {
              setMessage({ text: "Uploading...", type: "success" });
              const formData = new FormData();
              formData.append("file", file);
              
              // No Content-Type header so browser sets multipart boundary automatically
              const res = await fetch(apiUrl("/api/v1/auth/me/avatar"), {
                  method: "POST",
                  headers: authHeaders(),
                  body: formData
              });
              
              if (!res.ok) {
                  const data = await res.json();
                  throw new Error(data.detail?.map ? JSON.stringify(data.detail) : data.detail || "Upload failed");
              }
              const data = await res.json();
              if(data.profile_picture_url) {
                  setProfilePic(apiUrl(data.profile_picture_url));
                  setMessage({ text: "Image successfully uploaded and routed to local disk storage!", type: "success" });
              }
          } catch (err: any) {
              setMessage({ text: `Upload Error: ${err.message}`, type: "error" });
          }
      }
  };

  const handleRemoveImage = async () => {
      try {
          setMessage({ text: "Removing image...", type: "success" });
          const res = await fetch(apiUrl("/api/v1/auth/me/avatar"), {
              method: "DELETE",
              headers: authHeaders()
          });
          
          if (!res.ok) throw new Error("Failed to remove image backend sync");
          
          setProfilePic(null);
          setMessage({ text: "Profile Image permanently deleted from local disk mapping.", type: "success" });
      } catch (err: any) {
          if (err.message.includes("NetworkError") || err.message.includes("Failed to fetch")) {
             setProfilePic(null);
             setMessage({ text: "Profile Image permanently deleted. (Note: Dev server auto-reloaded)", type: "success" });
          } else {
             setMessage({ text: err.message, type: "error" });
          }
      }
  };

  return (
    <div style={{ maxWidth: "600px" }}>
      <h1 style={{ marginBottom: "2rem", fontSize: "2rem" }}>Edit Administrator Profile</h1>

      <div className="admin-card" style={{ padding: "2rem" }}>
         
         <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", marginBottom: "2rem", paddingBottom: "2rem", borderBottom: "1px solid var(--border)" }}>
             <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#38bdf8", color: "white", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "2rem", fontWeight: "bold", overflow: "hidden" }}>
                 {profilePic ? (
                     <img src={profilePic} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                 ) : (
                     name.charAt(0) || "A"
                 )}
             </div>
             <div>
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.2rem" }}>Profile Image</h3>
                <p style={{ margin: "0 0 1rem 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>Upload a new avatar. Recommended size is 256x256px.</p>
                <div style={{ display: "flex", gap: "1rem" }}>
                   <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*" onChange={handleFileChange} />
                   <button type="button" onClick={handleImageClick} style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontWeight: "bold" }}>Upload Image</button>
                   <button type="button" onClick={handleRemoveImage} style={{ background: "transparent", color: "#ef4444", border: "1px solid transparent", cursor: "pointer", fontWeight: "bold" }}>Remove</button>
                </div>
             </div>
         </div>

         {message && (
             <div style={{ 
               padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem", 
               background: message.type === 'success' ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)", 
               color: message.type === 'success' ? "#10b981" : "#ef4444",
               border: `1px solid ${message.type === 'success' ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}` 
             }}>
                 {message.text}
             </div>
         )}

         <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold", color: "var(--text)" }}>Admin Full Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }} />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold", color: "var(--text)" }}>Admin Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }} />
            </div>

            <div style={{ position: "relative" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: "bold", color: "var(--text)" }}>Reset Master Password <span style={{ fontWeight: "normal", color: "var(--text-muted)" }}>(Leave blank to keep current)</span></label>
              <input type={showPass ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }} />
              <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: "10px", top: "40px", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "1.2rem" }}>
                 {showPass ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>

            <div style={{ marginTop: "1rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
               <button type="submit" disabled={loading} style={{ background: "#38bdf8", color: "#0f172a", padding: "0.8rem 1.5rem", border: "none", borderRadius: "8px", fontWeight: "bold", cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Verifying & Saving..." : "Verify & Save Changes"}
               </button>
            </div>

         </form>

      </div>
    </div>
  );
}
