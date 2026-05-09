"use client";

import React, { useEffect, useState } from "react";
import { apiUrl, authHeaders, getErrorMessage } from "@/lib/api";
import { MdAdd, MdDelete, MdEdit, MdToggleOff, MdToggleOn } from "react-icons/md";

type UserRole = "user" | "admin";

interface UserRecord {
  id: number;
  full_name: string | null;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

interface EditFormState {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  is_active: boolean;
}

interface CreateFormState {
  full_name: string;
  email: string;
  password: string;
}

interface FeedbackState {
  type: "success" | "error";
  text: string;
}

const defaultCreateForm: CreateFormState = {
  full_name: "",
  email: "",
  password: "",
};

const defaultEditForm: EditFormState = {
  full_name: "",
  email: "",
  password: "",
  role: "user",
  is_active: true,
};

function getErrorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(defaultCreateForm);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(defaultEditForm);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch(apiUrl("/api/v1/admin/users"), {
        headers: authHeaders(),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to load users."));
      }

      setUsers((await res.json()) as UserRecord[]);
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text: getErrorText(error, "Failed to load users."),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchUsers();
  }, []);

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateForm(defaultCreateForm);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditForm(defaultEditForm);
  };

  const handleCreateUser = async () => {
    setIsCreatingUser(true);
    setFeedback(null);

    try {
      const res = await fetch(apiUrl("/api/v1/admin/users"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to create user."));
      }

      const createdUser = (await res.json()) as UserRecord;
      closeCreateModal();
      await fetchUsers();
      setFeedback({
        type: "success",
        text: `${createdUser.email} was added successfully and can sign in now.`,
      });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text: getErrorText(error, "Failed to create user."),
      });
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to permanently delete this user?")) {
      return;
    }

    setFeedback(null);

    try {
      const res = await fetch(apiUrl(`/api/v1/admin/users/${id}`), {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to delete user."));
      }

      await fetchUsers();
      setFeedback({
        type: "success",
        text: "User deleted successfully.",
      });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text: getErrorText(error, "Failed to delete user."),
      });
    }
  };

  const handleToggleActive = async (user: UserRecord) => {
    setFeedback(null);

    try {
      const res = await fetch(apiUrl(`/api/v1/admin/users/${user.id}`), {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to update user status."));
      }

      await fetchUsers();
      setFeedback({
        type: "success",
        text: `${user.email} is now ${user.is_active ? "suspended" : "active"}.`,
      });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text: getErrorText(error, "Failed to update user status."),
      });
    }
  };

  const openEdit = (user: UserRecord) => {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name || "",
      email: user.email,
      password: "",
      role: user.role,
      is_active: user.is_active,
    });
  };

  const saveEdit = async () => {
    if (!editingUser) {
      return;
    }

    setIsSavingEdit(true);
    setFeedback(null);

    try {
      const payload: {
        full_name: string;
        email: string;
        role: UserRole;
        password?: string;
      } = {
        full_name: editForm.full_name,
        email: editForm.email,
        role: editForm.role,
      };

      if (editForm.password) {
        payload.password = editForm.password;
      }

      const res = await fetch(apiUrl(`/api/v1/admin/users/${editingUser.id}`), {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to save user changes."));
      }

      closeEditModal();
      await fetchUsers();
      setFeedback({
        type: "success",
        text: "User details updated successfully.",
      });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text: getErrorText(error, "Failed to save user changes."),
      });
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "2rem" }}>Manage Users</h1>
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setIsCreateModalOpen(true);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "#38bdf8",
            color: "white",
            border: "none",
            borderRadius: "10px",
            padding: "0.85rem 1.2rem",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.95rem",
            boxShadow: "0 10px 20px rgba(56, 189, 248, 0.2)",
          }}
        >
          <MdAdd size={20} />
          Add New User
        </button>
      </div>

      {feedback && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.9rem 1rem",
            borderRadius: "10px",
            border:
              feedback.type === "success"
                ? "1px solid rgba(16, 185, 129, 0.25)"
                : "1px solid rgba(239, 68, 68, 0.25)",
            background:
              feedback.type === "success"
                ? "rgba(16, 185, 129, 0.1)"
                : "rgba(239, 68, 68, 0.1)",
            color: feedback.type === "success" ? "#10b981" : "#ef4444",
            fontWeight: 600,
          }}
        >
          {feedback.text}
        </div>
      )}

      <div className="admin-card" style={{ padding: "1.5rem" }}>
        {loading ? (
          <p>Loading users...</p>
        ) : (
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
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No users found in the system yet.
                  </td>
                </tr>
              )}

              {users.map((user) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    opacity: user.is_active ? 1 : 0.5,
                  }}
                >
                  <td style={{ padding: "1rem" }}>#{user.id}</td>
                  <td style={{ padding: "1rem", fontWeight: "bold" }}>
                    {user.full_name || "N/A"}
                    {!user.is_active && (
                      <span
                        style={{
                          marginLeft: "10px",
                          fontSize: "0.7rem",
                          color: "#ef4444",
                          background: "rgba(239,68,68,0.1)",
                          padding: "2px 6px",
                          borderRadius: "8px",
                        }}
                      >
                        Suspended
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "1rem" }}>{user.email}</td>
                  <td style={{ padding: "1rem" }}>
                    <span
                      style={{
                        background:
                          user.role === "admin"
                            ? "rgba(239,68,68,0.2)"
                            : "rgba(56,189,248,0.2)",
                        color: user.role === "admin" ? "#ef4444" : "#38bdf8",
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontSize: "0.8rem",
                        fontWeight: "bold",
                        textTransform: "uppercase",
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: "1rem", display: "flex", gap: "10px" }}>
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      style={{
                        background: "transparent",
                        color: "var(--text)",
                        border: "1px solid var(--border)",
                        padding: "8px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Edit User"
                    >
                      <MdEdit size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(user)}
                      style={{
                        background: "transparent",
                        color: user.is_active ? "#10b981" : "#ef4444",
                        border: "1px solid var(--border)",
                        padding: "8px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title={user.is_active ? "Suspend User" : "Activate User"}
                    >
                      {user.is_active ? <MdToggleOn size={18} /> : <MdToggleOff size={18} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(user.id)}
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        color: "#ef4444",
                        border: "1px solid rgba(239,68,68,0.2)",
                        padding: "8px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                      title="Delete User"
                    >
                      <MdDelete size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isCreateModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div className="admin-card" style={{ width: "420px", padding: "2rem" }}>
            <h2 style={{ marginTop: 0, marginBottom: "0.6rem" }}>Add New User</h2>
            <p style={{ marginTop: 0, marginBottom: "1.5rem", color: "var(--text-muted)" }}>
              Create a new sign-in account for the platform. The user will be able
              to log in as soon as you save these credentials.
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateUser();
              }}
            >
              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      full_name: event.target.value,
                    }))
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "0.8rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                  }}
                />
              </div>

              <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                  style={{
                    width: "100%",
                    padding: "0.8rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                  }}
                />
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                  Password
                </label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  required
                  minLength={6}
                  style={{
                    width: "100%",
                    padding: "0.8rem",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "transparent",
                    color: "var(--text)",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  style={{
                    padding: "0.8rem 1.5rem",
                    borderRadius: "8px",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser}
                  style={{
                    padding: "0.8rem 1.5rem",
                    borderRadius: "8px",
                    background: "#38bdf8",
                    border: "none",
                    color: "white",
                    cursor: isCreatingUser ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {isCreatingUser ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingUser && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1000,
          }}
        >
          <div className="admin-card" style={{ width: "400px", padding: "2rem" }}>
            <h2 style={{ marginTop: 0, marginBottom: "1.5rem" }}>
              Edit User #{editingUser.id}
            </h2>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                Full Name
              </label>
              <input
                type="text"
                value={editForm.full_name}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    full_name: event.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "0.8rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                }}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                Email
              </label>
              <input
                type="email"
                value={editForm.email}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "0.8rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                }}
              />
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                Role
              </label>
              <select
                value={editForm.role}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    role: event.target.value as UserRole,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "0.8rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                }}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-muted)" }}>
                New Password (Leave blank to keep)
              </label>
              <input
                type="password"
                value={editForm.password}
                onChange={(event) =>
                  setEditForm((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "0.8rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text)",
                }}
                placeholder="New password..."
              />
            </div>

            <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={closeEditModal}
                style={{
                  padding: "0.8rem 1.5rem",
                  borderRadius: "8px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={isSavingEdit}
                style={{
                  padding: "0.8rem 1.5rem",
                  borderRadius: "8px",
                  background: "#38bdf8",
                  border: "none",
                  color: "white",
                  cursor: isSavingEdit ? "not-allowed" : "pointer",
                  fontWeight: "bold",
                }}
              >
                {isSavingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
