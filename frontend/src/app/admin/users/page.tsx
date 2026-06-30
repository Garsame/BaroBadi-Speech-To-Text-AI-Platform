"use client";

import React, { useEffect, useMemo, useState } from "react";
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

function initialsFor(user: UserRecord): string {
  const name = user.full_name || user.email;
  return name
    .split(/\s+|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function roleTone(role: UserRole): { background: string; color: string } {
  return role === "admin"
    ? { background: "var(--primary-translucent)", color: "var(--primary-color)" }
    : { background: "var(--primary-hover-translucent)", color: "var(--primary-hover)" };
}

function statusTone(isActive: boolean): { background: string; color: string } {
  return isActive
    ? { background: "var(--primary-translucent)", color: "var(--primary-color)" }
    : { background: "var(--admin-surface-soft)", color: "var(--text-muted)" };
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

  const userSummary = useMemo(() => {
    const admins = users.filter((user) => user.role === "admin").length;
    const active = users.filter((user) => user.is_active).length;
    return {
      total: users.length,
      active,
      admins,
      suspended: users.length - active,
    };
  }, [users]);

  return (
    <div style={{ position: "relative" }}>
      <div className="admin-page-header">
        <div>
          <span className="admin-page-kicker">User access</span>
          <h1 className="admin-page-title">Manage Users</h1>
          <p className="admin-page-lede">
            Review accounts, roles, and activation status from one compact view.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setFeedback(null);
            setIsCreateModalOpen(true);
          }}
          className="admin-action-btn"
        >
          <MdAdd size={20} />
          Add New User
        </button>
      </div>

      <div className="admin-user-summary" aria-label="User account summary">
        <div className="admin-user-summary-item">
          <strong>{userSummary.total}</strong>
          <span>Total users</span>
        </div>
        <div className="admin-user-summary-item">
          <strong>{userSummary.active}</strong>
          <span>Active</span>
        </div>
        <div className="admin-user-summary-item">
          <strong>{userSummary.admins}</strong>
          <span>Admins</span>
        </div>
        <div className="admin-user-summary-item">
          <strong>{userSummary.suspended}</strong>
          <span>Suspended</span>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.9rem 1rem",
            borderRadius: "10px",
            border:
              feedback.type === "success"
                ? "1px solid color-mix(in srgb, var(--primary-color) 22%, var(--border))"
                : "1px solid color-mix(in srgb, var(--primary-hover) 28%, var(--border))",
            background:
              feedback.type === "success"
                ? "var(--primary-translucent)"
                : "var(--primary-hover-translucent)",
            color: feedback.type === "success" ? "var(--primary-color)" : "var(--primary-hover)",
            fontWeight: 600,
          }}
        >
          {feedback.text}
        </div>
      )}

      <div className="admin-card admin-table-shell">
        {loading ? (
          <p style={{ padding: "1.5rem", color: "var(--text-muted)" }}>Loading users...</p>
        ) : (
          <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Account ID</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                    No users found in the system yet.
                  </td>
                </tr>
              )}

              {users.map((user) => {
                const role = roleTone(user.role);
                const status = statusTone(user.is_active);
                return (
                <tr key={user.id} style={{ opacity: user.is_active ? 1 : 0.58 }}>
                  <td style={{ minWidth: "260px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", alignItems: "center", gap: "0.75rem" }}>
                      <span className="admin-user-avatar">{initialsFor(user)}</span>
                      <div>
                        <div style={{ color: "var(--text)", fontWeight: 900 }}>{user.full_name || "No name set"}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "0.82rem", overflowWrap: "anywhere" }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--text-muted)", fontWeight: 800 }}>#{user.id}</td>
                  <td>
                    <span className="admin-badge" style={{ background: role.background, color: role.color }}>
                      {user.role}
                    </span>
                  </td>
                  <td>
                    <span className="admin-badge" style={{ background: status.background, color: status.color }}>
                      {user.is_active ? "Active" : "Suspended"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="admin-icon-action"
                      title="Edit User"
                    >
                      <MdEdit size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleActive(user)}
                      style={{
                        color: user.is_active ? "var(--primary-color)" : "var(--primary-hover)",
                      }}
                      className="admin-icon-action"
                      title={user.is_active ? "Suspend User" : "Activate User"}
                    >
                      {user.is_active ? <MdToggleOn size={18} /> : <MdToggleOff size={18} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(user.id)}
                      style={{
                        background: "transparent",
                        color: "var(--primary-color)",
                        border: "1px solid var(--border)",
                      }}
                      className="admin-icon-action"
                      title="Delete User"
                    >
                      <MdDelete size={18} />
                    </button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          </div>
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
                    background: "var(--primary-color)",
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
                  background: "var(--primary-color)",
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
