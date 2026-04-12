"use client";

import React, { useEffect, useState } from 'react';
import { apiUrl, authHeaders } from '@/lib/api';
import { MdEdit, MdDelete, MdToggleOn, MdToggleOff } from 'react-icons/md';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Edit Modal State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', password: '', role: '', is_active: true });

  const fetchUsers = async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/admin/users"), { headers: authHeaders() });
      if (res.ok) setUsers(await res.json());
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (id: number) => {
     if(!confirm("Are you sure you want to permanently delete this user?")) return;
     try {
       await fetch(apiUrl(`/api/v1/admin/users/${id}`), { method: "DELETE", headers: authHeaders() });
       fetchUsers();
     } catch(e) {}
  };

  const handleToggleActive = async (u: any) => {
     try {
       await fetch(apiUrl(`/api/v1/admin/users/${u.id}`), {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: !u.is_active })
       });
       fetchUsers();
     } catch(e) {}
  };

  const openEdit = (u: any) => {
     setEditingUser(u);
     setEditForm({ full_name: u.full_name || '', email: u.email || '', password: '', role: u.role, is_active: u.is_active });
  };

  const saveEdit = async () => {
     try {
       const payload: any = { full_name: editForm.full_name, email: editForm.email, role: editForm.role };
       if (editForm.password) payload.password = editForm.password;
       
       await fetch(apiUrl(`/api/v1/admin/users/${editingUser.id}`), {
          method: "PUT",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload)
       });
       setEditingUser(null);
       fetchUsers();
     } catch(e) {}
  };

  return (
      <div style={{ position: "relative" }}>
        <h1 style={{ marginBottom: "2rem", fontSize: "2rem" }}>Manage Users</h1>
        <div className="admin-card" style={{ padding: "1.5rem" }}>
          {loading ? <p>Loading users...</p> : (
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>ID</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Full Name</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Email</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Role</th>
                  <th style={{ padding: "1rem", color: "var(--text-muted)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)", opacity: u.is_active ? 1 : 0.5 }}>
                     <td style={{ padding: "1rem" }}>#{u.id}</td>
                     <td style={{ padding: "1rem", fontWeight: "bold" }}>
                        {u.full_name || "N/A"}
                        {!u.is_active && <span style={{ marginLeft: "10px", fontSize: "0.7rem", color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "2px 6px", borderRadius: "8px" }}>Suspended</span>}
                     </td>
                     <td style={{ padding: "1rem" }}>{u.email}</td>
                     <td style={{ padding: "1rem" }}>
                        <span style={{ 
                            background: u.role === "admin" ? "rgba(239,68,68,0.2)" : "rgba(56,189,248,0.2)", 
                            color: u.role === "admin" ? "#ef4444" : "#38bdf8", 
                            padding: "4px 8px", borderRadius: "12px", fontSize: "0.8rem", fontWeight: "bold", textTransform: "uppercase" 
                        }}>
                            {u.role}
                        </span>
                     </td>
                     <td style={{ padding: "1rem", display: "flex", gap: "10px" }}>
                        <button onClick={() => openEdit(u)} style={{ background: "transparent", color: "var(--text)", border: "1px solid var(--border)", padding: "8px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center" }} title="Edit User">
                            <MdEdit size={18} />
                        </button>
                        <button onClick={() => handleToggleActive(u)} style={{ background: "transparent", color: u.is_active ? "#10b981" : "#ef4444", border: "1px solid var(--border)", padding: "8px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center" }} title={u.is_active ? "Suspend User" : "Activate User"}>
                            {u.is_active ? <MdToggleOn size={18} /> : <MdToggleOff size={18} />}
                        </button>
                        <button onClick={() => handleDelete(u.id)} style={{ background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", padding: "8px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center" }} title="Delete User">
                            <MdDelete size={18} />
                        </button>
                     </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Edit Modal */}
        {editingUser && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
                <div className="admin-card" style={{ width: "400px", padding: "2rem" }}>
                    <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>Edit User #{editingUser.id}</h2>
                    
                    <div style={{ marginBottom: "1rem" }}>
                       <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>Full Name</label>
                       <input type="text" value={editForm.full_name} onChange={e => setEditForm({...editForm, full_name: e.target.value})} style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }} />
                    </div>
                    
                    <div style={{ marginBottom: "1rem" }}>
                       <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>Email</label>
                       <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }} />
                    </div>

                    <div style={{ marginBottom: "1rem" }}>
                       <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>Role</label>
                       <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value})} style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)" }}>
                           <option value="user">User</option>
                           <option value="admin">Admin</option>
                       </select>
                    </div>
                    
                    <div style={{ marginBottom: "1.5rem" }}>
                       <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>New Password (Leave blank to keep)</label>
                       <input type="password" value={editForm.password} onChange={e => setEditForm({...editForm, password: e.target.value})} style={{ width: "100%", padding: "0.8rem", borderRadius: "8px", border: "1px solid var(--border)", background: "transparent", color: "var(--text)" }} placeholder="New password..." />
                    </div>
                    
                    <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                       <button onClick={() => setEditingUser(null)} style={{ padding: "0.8rem 1.5rem", borderRadius: "8px", background: "transparent", border: "1px solid var(--border)", color: "var(--text)", cursor: "pointer" }}>Cancel</button>
                       <button onClick={saveEdit} style={{ padding: "0.8rem 1.5rem", borderRadius: "8px", background: "#38bdf8", border: "none", color: "white", cursor: "pointer", fontWeight: "bold" }}>Save Changes</button>
                    </div>
                </div>
            </div>
        )}
      </div>
  );
}
