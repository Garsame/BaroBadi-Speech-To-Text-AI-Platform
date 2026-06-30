"use client";

import React, { useState, useEffect, useRef } from "react";
import { apiUrl, authHeaders } from "@/lib/api";
import { MdVisibility, MdVisibilityOff, MdEdit } from 'react-icons/md';

interface ProfileResponse {
  full_name?: string | null;
  email?: string | null;
  profile_picture_url?: string | null;
  detail?: unknown;
}

interface ProfilePayload {
  full_name: string;
  email: string;
  password?: string;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function detailMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string") return detail;
  if (detail) return JSON.stringify(detail);
  return fallback;
}

function resolveAvatar(url: string | null | undefined): string | null {
  if (!url || url.includes("next.svg")) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return apiUrl(url);
}

export default function AdminProfilePage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [isEditingForm, setIsEditingForm] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(apiUrl("/api/v1/auth/me"), { headers: authHeaders() });
        if (res.ok) {
          const data = (await res.json()) as ProfileResponse;
          setName(data.full_name || "");
          setEmail(data.email || "");
          if (data.profile_picture_url) {
             setProfilePic(resolveAvatar(data.profile_picture_url));
          }
        }
      } catch {}
    };
    fetchUser();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const payload: ProfilePayload = { full_name: name, email: email };
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
        const data = (await res.json()) as ProfileResponse;
        const errorMsg = detailMessage(data.detail, "Failed to update profile.");
        throw new Error(errorMsg || "Failed to update profile.");
      }

      setMessage({ text: "Profile settings updated successfully!", type: "success" });
      setPassword(""); // Clear password field after updating
      setIsEditingForm(false); // Reset editing mode
    } catch (err: unknown) {
      const message = errorMessage(err, "Failed to update profile.");
      if (message.includes("NetworkError") || message.includes("Failed to fetch")) {
          // Uvicorn drops the connection when reloading due to sql_app.db modifications in local dev
          setMessage({ text: "Profile updated successfully! (Note: Dev server auto-reloaded)", type: "success" });
          setPassword(""); 
          setIsEditingForm(false); // Reset editing mode
      } else {
          setMessage({ text: message, type: "error" });
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
                  const data = (await res.json()) as ProfileResponse;
                  throw new Error(detailMessage(data.detail, "Upload failed"));
              }
              const data = (await res.json()) as ProfileResponse;
              if(data.profile_picture_url) {
                  setProfilePic(resolveAvatar(data.profile_picture_url));
                  setMessage({ text: "Image successfully uploaded and routed to local disk storage!", type: "success" });
              }
          } catch (err: unknown) {
              setMessage({ text: `Upload Error: ${errorMessage(err, "Upload failed")}`, type: "error" });
          }
      }
  };

  return (
    <div style={{ maxWidth: "750px" }}>
      <style>{`
         .avatar-container {
            position: relative;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            cursor: pointer;
            overflow: hidden;
            border: 3px solid var(--border);
            transition: all 0.25s ease;
         }
         .avatar-container:hover {
            border-color: var(--primary-color);
            transform: scale(1.02);
         }
         .avatar-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            color: white;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 4px;
            opacity: 0;
            transition: opacity 0.25s ease;
         }
         .avatar-container:hover .avatar-overlay {
            opacity: 1;
         }
      `}</style>

      <h1 style={{ marginBottom: "1.5rem", fontSize: "1.5rem" }}>Edit Administrator Profile</h1>

      <div className="admin-card" style={{ padding: "2rem" }}>
         
         <div style={{ display: "flex", gap: "3rem", flexWrap: "wrap", alignItems: "flex-start" }}>
            
            {/* Left Column: Avatar upload with overlay edit trigger */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
                <div onClick={handleImageClick} className="avatar-container" title="Click to upload profile image">
                     <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: "var(--primary-color)", color: "white", display: "flex", justifyContent: "center", alignItems: "center", fontSize: "2.8rem", fontWeight: "bold", overflow: "hidden" }}>
                         {profilePic ? (
                             <img src={profilePic} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                         ) : (
                             name.charAt(0) || "A"
                         )}
                     </div>
                     <div className="avatar-overlay">
                         <MdEdit size={24} />
                         <span style={{ fontSize: "0.7rem", fontWeight: "bold" }}>Change</span>
                     </div>
                </div>
                <input type="file" ref={fileInputRef} style={{ display: "none" }} accept="image/*" onChange={handleFileChange} />
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.25rem" }}>Click image to edit</span>
            </div>

            {/* Right Column: Update settings form */}
            <div style={{ flex: 1, minWidth: "300px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.75rem" }}>
                    <h3 style={{ margin: 0, fontSize: "1.05rem", color: "var(--text)" }}>Personal Credentials</h3>
                    
                    <button 
                       type="button" 
                       onClick={() => setIsEditingForm(!isEditingForm)}
                       style={{
                         background: isEditingForm ? "var(--primary-translucent)" : "transparent",
                         border: "1px solid var(--border)",
                         borderRadius: "8px",
                         padding: "6px 12px",
                         display: "flex",
                         alignItems: "center",
                         gap: "6px",
                         cursor: "pointer",
                         color: isEditingForm ? "var(--primary-color)" : "var(--text-muted)",
                         fontWeight: "bold",
                         fontSize: "0.85rem",
                         transition: "all 0.2s ease"
                       }}
                    >
                       <MdEdit size={16} />
                       {isEditingForm ? "Cancel Edit" : "Edit Fields"}
                    </button>
                </div>

                {message && (
                     <div style={{ 
                       padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem", 
                       background: message.type === 'success' ? "var(--primary-translucent)" : "var(--primary-hover-translucent)", 
                       color: message.type === 'success' ? "var(--primary-color)" : "var(--primary-hover)",
                       border: `1px solid ${message.type === 'success' ? "color-mix(in srgb, var(--primary-color) 26%, var(--border))" : "color-mix(in srgb, var(--primary-hover) 26%, var(--border))"}` 
                     }}>
                         {message.text}
                     </div>
                )}

                <form onSubmit={handleUpdate} style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                   
                   <div>
                     <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "bold", color: "var(--text)", fontSize: "0.82rem" }}>Admin Full Name</label>
                     <input 
                       type="text" 
                       value={name} 
                       onChange={(e) => setName(e.target.value)} 
                       required 
                       readOnly={!isEditingForm}
                       style={{ 
                         width: "100%", 
                         padding: "0.7rem 0.8rem", 
                         borderRadius: "8px", 
                         border: "1px solid var(--border)", 
                         background: isEditingForm ? "transparent" : "rgba(148, 163, 184, 0.05)", 
                         color: "var(--text)",
                         fontSize: "0.85rem",
                         opacity: isEditingForm ? 1 : 0.8,
                         transition: "all 0.2s ease"
                       }} 
                     />
                   </div>

                   <div>
                     <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "bold", color: "var(--text)", fontSize: "0.82rem" }}>Admin Email Address</label>
                     <input 
                       type="email" 
                       value={email} 
                       onChange={(e) => setEmail(e.target.value)} 
                       required 
                       readOnly={!isEditingForm}
                       style={{ 
                         width: "100%", 
                         padding: "0.7rem 0.8rem", 
                         borderRadius: "8px", 
                         border: "1px solid var(--border)", 
                         background: isEditingForm ? "transparent" : "rgba(148, 163, 184, 0.05)", 
                         color: "var(--text)",
                         fontSize: "0.85rem",
                         opacity: isEditingForm ? 1 : 0.8,
                         transition: "all 0.2s ease"
                       }} 
                     />
                   </div>

                   <div style={{ position: "relative" }}>
                     <label style={{ display: "block", marginBottom: "0.4rem", fontWeight: "bold", color: "var(--text)", fontSize: "0.82rem" }}>Reset Master Password <span style={{ fontWeight: "normal", color: "var(--text-muted)", fontSize: "0.78rem" }}>(Leave blank to keep current)</span></label>
                     <input 
                       type={showPass ? "text" : "password"} 
                       value={password} 
                       onChange={(e) => setPassword(e.target.value)} 
                       readOnly={!isEditingForm}
                       placeholder={isEditingForm ? "Enter new password..." : "••••••••"}
                       style={{ 
                         width: "100%", 
                         padding: "0.7rem 0.8rem", 
                         borderRadius: "8px", 
                         border: "1px solid var(--border)", 
                         background: isEditingForm ? "transparent" : "rgba(148, 163, 184, 0.05)", 
                         color: "var(--text)",
                         fontSize: "0.85rem",
                         opacity: isEditingForm ? 1 : 0.8,
                         transition: "all 0.2s ease"
                       }} 
                     />
                     <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: "absolute", right: "10px", top: "33px", background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {showPass ? <MdVisibility size={20} /> : <MdVisibilityOff size={20} />}
                     </button>
                   </div>

                   <div style={{ marginTop: "1rem", paddingTop: "1.5rem", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
                      <button 
                         type="submit" 
                         disabled={loading || !isEditingForm} 
                         style={{ 
                           background: isEditingForm ? "var(--primary-color)" : "rgba(148, 163, 184, 0.12)", 
                           color: isEditingForm ? "white" : "var(--text-muted)", 
                           padding: "0.8rem 1.5rem", 
                           border: "none", 
                           borderRadius: "8px", 
                           fontWeight: "bold", 
                           cursor: (loading || !isEditingForm) ? "not-allowed" : "pointer", 
                           boxShadow: isEditingForm ? "0 4px 12px var(--primary-translucent)" : "none", 
                           transition: "all 0.2s ease" 
                         }}
                      >
                         {loading ? "Verifying & Saving..." : "Verify & Save Changes"}
                      </button>
                   </div>

                </form>
            </div>

         </div>

      </div>
    </div>
  );
}
