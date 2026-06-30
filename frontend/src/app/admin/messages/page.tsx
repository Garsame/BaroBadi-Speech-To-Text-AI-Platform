"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiUrl, authHeaders, getErrorMessage } from "@/lib/api";
import {
  MdEmail,
  MdDrafts,
  MdDelete,
  MdReply,
  MdSearch,
  MdExpandMore,
  MdExpandLess,
  MdRefresh,
} from "react-icons/md";

interface ContactMessageRecord {
  id: number;
  name: string;
  email: string;
  topic: string;
  message: string;
  is_read: boolean;
  created_at: string;
  reply_message?: string | null;
  replied_at?: string | null;
  is_replied?: boolean;
}

interface FeedbackState {
  type: "success" | "error";
  text: string;
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<ContactMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "read">("all");
  const [expandedMessageId, setExpandedMessageId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState<Record<number, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<number, boolean>>({});
  const [showReplyForm, setShowReplyForm] = useState<Record<number, boolean>>({});
  const [replySuccess, setReplySuccess] = useState<Record<number, string>>({});

  const fetchMessages = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(apiUrl("/api/v1/admin/messages"), {
        headers: authHeaders(),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to load messages."));
      }

      const data = (await res.json()) as ContactMessageRecord[];
      setMessages(data);
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load messages.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchMessages();
  }, []);

  const handleToggleRead = async (msg: ContactMessageRecord) => {
    setFeedback(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/admin/messages/${msg.id}/read`), {
        method: "PUT",
        headers: authHeaders(),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to update status."));
      }

      const updated = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, is_read: updated.is_read } : m))
      );
      setFeedback({
        type: "success",
        text: `Message from ${msg.name} marked as ${updated.is_read ? "read" : "unread"}.`,
      });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update message status.",
      });
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete the message from ${name}?`)) {
      return;
    }

    setFeedback(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/admin/messages/${id}`), {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to delete message."));
      }

      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (expandedMessageId === id) {
        setExpandedMessageId(null);
      }
      setFeedback({
        type: "success",
        text: "Message deleted successfully.",
      });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to delete message.",
      });
    }
  };

  const handleSendReply = async (id: number) => {
    const text = (replyText[id] || "").trim();
    if (!text) return;

    setSubmittingReply((prev) => ({ ...prev, [id]: true }));
    setFeedback(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/admin/messages/${id}/reply`), {
        method: "POST",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reply_message: text }),
      });

      if (!res.ok) {
        throw new Error(await getErrorMessage(res, "Failed to send reply."));
      }

      const updated = await res.json();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                is_read: updated.is_read,
                is_replied: updated.is_replied,
                reply_message: updated.reply_message,
                replied_at: updated.replied_at,
              }
            : m
        )
      );

      setShowReplyForm((prev) => ({ ...prev, [id]: false }));
      setReplyText((prev) => ({ ...prev, [id]: "" }));
      setFeedback({
        type: "success",
        text: "Reply sent and support response emailed successfully!",
      });
      setReplySuccess((prev) => ({ ...prev, [id]: "Support response sent and emailed successfully!" }));
      setTimeout(() => {
        setReplySuccess((prev) => ({ ...prev, [id]: "" }));
      }, 7000);
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to send reply.",
      });
    } finally {
      setSubmittingReply((prev) => ({ ...prev, [id]: false }));
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedMessageId((current) => (current === id ? null : id));
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // Status filter
      if (statusFilter === "unread" && msg.is_read) return false;
      if (statusFilter === "read" && !msg.is_read) return false;

      // Search query filter
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        msg.name.toLowerCase().includes(query) ||
        msg.email.toLowerCase().includes(query) ||
        msg.topic.toLowerCase().includes(query) ||
        msg.message.toLowerCase().includes(query)
      );
    });
  }, [messages, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = messages.length;
    const unread = messages.filter((m) => !m.is_read).length;
    return {
      total,
      unread,
      read: total - unread,
    };
  }, [messages]);

  return (
    <div style={{ position: "relative" }}>
      {/* Page Header */}
      <div className="admin-page-header">
        <div>
          <span className="admin-page-kicker">User feedback</span>
          <h1 className="admin-page-title">User Messages</h1>
          <p className="admin-page-lede">
            Review and manage inquiries, feature requests, and partnership proposals sent from the Contact page.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchMessages()}
          className="admin-action-btn"
          style={{ background: "transparent", border: "1px solid var(--border-color)", color: "var(--text-color)" }}
        >
          <MdRefresh size={20} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="admin-user-summary" style={{ marginBottom: "2rem" }}>
        <div className="admin-user-summary-item">
          <strong>{stats.total}</strong>
          <span>Total messages</span>
        </div>
        <div className="admin-user-summary-item" style={{ borderLeft: "1px solid var(--border)" }}>
          <strong style={{ color: stats.unread > 0 ? "var(--primary-hover)" : "var(--primary-color)" }}>{stats.unread}</strong>
          <span>Unread inquiries</span>
        </div>
        <div className="admin-user-summary-item" style={{ borderLeft: "1px solid var(--border)" }}>
          <strong>{stats.read}</strong>
          <span>Read & processed</span>
        </div>
      </div>

      {/* Feedback Alert */}
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

      {/* Search & Filter Controls */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            flex: 1,
            minWidth: "260px",
          }}
        >
          <span
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <MdSearch size={20} />
          </span>
          <input
            type="text"
            placeholder="Search by name, email, topic, or message contents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "0.75rem 0.75rem 0.75rem 2.5rem",
              borderRadius: "12px",
              border: "1px solid var(--border-color)",
              background: "var(--secondary-bg)",
              color: "var(--text-color)",
              outline: "none",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className="admin-action-btn"
            style={{
              height: "42px",
              minHeight: "auto",
              padding: "0 1.2rem",
              borderRadius: "10px",
              background: statusFilter === "all" ? "var(--primary-color)" : "transparent",
              border: `1px solid ${statusFilter === "all" ? "var(--primary-color)" : "var(--border-color)"}`,
              color: statusFilter === "all" ? "#fff" : "var(--text-color)",
              boxShadow: "none",
            }}
          >
            All Messages
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("unread")}
            className="admin-action-btn"
            style={{
              height: "42px",
              minHeight: "auto",
              padding: "0 1.2rem",
              borderRadius: "10px",
              background: statusFilter === "unread" ? "var(--primary-color)" : "transparent",
              border: `1px solid ${statusFilter === "unread" ? "var(--primary-color)" : "var(--border-color)"}`,
              color: statusFilter === "unread" ? "#fff" : "var(--text-color)",
              boxShadow: "none",
            }}
          >
            Unread
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("read")}
            className="admin-action-btn"
            style={{
              height: "42px",
              minHeight: "auto",
              padding: "0 1.2rem",
              borderRadius: "10px",
              background: statusFilter === "read" ? "var(--primary-color)" : "transparent",
              border: `1px solid ${statusFilter === "read" ? "var(--primary-color)" : "var(--border-color)"}`,
              color: statusFilter === "read" ? "#fff" : "var(--text-color)",
              boxShadow: "none",
            }}
          >
            Read
          </button>
        </div>
      </div>

      {/* Messages Table Card */}
      <div className="admin-card admin-table-shell">
        {loading ? (
          <p style={{ padding: "1.5rem", color: "var(--text-muted)" }}>Loading user messages...</p>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "35px" }}></th>
                  <th>Sender</th>
                  <th>Topic</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMessages.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: "3rem", textAlign: "center", color: "var(--text-muted)" }}>
                      No contact messages found matching your criteria.
                    </td>
                  </tr>
                )}

                {filteredMessages.map((msg) => {
                  const isExpanded = expandedMessageId === msg.id;
                  const formattedDate = new Date(msg.created_at).toLocaleString();

                  return (
                    <React.Fragment key={msg.id}>
                      <tr
                        style={{
                          opacity: msg.is_read ? 0.78 : 1,
                          fontWeight: msg.is_read ? "normal" : "bold",
                          cursor: "pointer",
                          background: isExpanded ? "color-mix(in srgb, var(--admin-surface-soft) 40%, transparent)" : "transparent",
                        }}
                        onClick={() => toggleExpand(msg.id)}
                      >
                        <td onClick={(e) => e.stopPropagation()} style={{ width: "35px" }}>
                          <button
                            type="button"
                            onClick={() => toggleExpand(msg.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--text-muted)",
                              display: "flex",
                              alignItems: "center",
                              padding: 0,
                            }}
                          >
                            {isExpanded ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
                          </button>
                        </td>
                        <td style={{ minWidth: "200px" }}>
                          <div style={{ display: "grid" }}>
                            <span style={{ color: "var(--text)", fontWeight: msg.is_read ? 600 : 900 }}>
                              {msg.name}
                            </span>
                            <span style={{ color: "var(--text-muted)", fontSize: "0.82rem", fontWeight: "normal" }}>
                              {msg.email}
                            </span>
                          </div>
                        </td>
                        <td style={{ minWidth: "150px" }}>
                          <span style={{ color: "var(--text)" }}>{msg.topic}</span>
                        </td>
                        <td style={{ color: "var(--text-muted)", fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                          {formattedDate}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                            <span
                              className="admin-badge"
                              style={{
                                background: msg.is_read
                                  ? "var(--admin-surface-soft)"
                                  : "var(--primary-translucent)",
                                color: msg.is_read
                                  ? "var(--text-muted)"
                                  : "var(--primary-color)",
                              }}
                            >
                              {msg.is_read ? "Read" : "Unread"}
                            </span>
                            {msg.is_replied && (
                              <span
                                className="admin-badge"
                                style={{
                                  background: "rgba(16, 185, 129, 0.15)",
                                  color: "#10b981",
                                }}
                              >
                                Replied
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                            <button
                              type="button"
                              onClick={() => void handleToggleRead(msg)}
                              className="admin-icon-action"
                              title={msg.is_read ? "Mark as Unread" : "Mark as Read"}
                            >
                              {msg.is_read ? <MdEmail size={18} /> : <MdDrafts size={18} />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedMessageId(msg.id);
                                setShowReplyForm((prev) => ({ ...prev, [msg.id]: true }));
                                if (!replyText[msg.id]) {
                                  setReplyText((prev) => ({ ...prev, [msg.id]: "" }));
                                }
                              }}
                              className="admin-icon-action"
                              title="Compose Reply"
                              style={{ background: "transparent", border: "1px solid var(--border)" }}
                            >
                              <MdReply size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(msg.id, msg.name)}
                              style={{
                                background: "transparent",
                                color: "var(--primary-color)",
                                border: "1px solid var(--border)",
                              }}
                              className="admin-icon-action"
                              title="Delete Message"
                            >
                              <MdDelete size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
 
                      {/* Expanded row details */}
                      {isExpanded && (
                        <tr style={{ background: "color-mix(in srgb, var(--admin-surface-soft) 22%, transparent)" }}>
                          <td></td>
                          <td colSpan={5} style={{ padding: "1.25rem 1.5rem" }}>
                            <div
                              style={{
                                display: "grid",
                                gap: "0.75rem",
                                animation: "admin-fade-in 0.2s ease-out",
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                                <strong>Message Context:</strong>
                                <span style={{ color: "var(--text-muted)", fontSize: "0.82rem" }}>
                                  Inquiry ID: #{msg.id}
                                </span>
                              </div>
                              <div
                                style={{
                                  background: "var(--secondary-bg)",
                                  border: "1px solid var(--border-color)",
                                  borderRadius: "10px",
                                  padding: "1rem 1.25rem",
                                  color: "var(--text-color)",
                                  lineHeight: 1.6,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {msg.message}
                              </div>
 
                              {/* Previous reply logs */}
                              {msg.is_replied && msg.reply_message && (
                                <div
                                  style={{
                                    border: "1px solid var(--border-color)",
                                    borderRadius: "10px",
                                    padding: "1rem 1.25rem",
                                    background: "rgba(16, 185, 129, 0.05)",
                                    display: "grid",
                                    gap: "0.5rem",
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                                    <strong style={{ color: "#10b981" }}>Sent Support Response:</strong>
                                    <span>
                                      {msg.replied_at ? new Date(msg.replied_at).toLocaleString() : ""}
                                    </span>
                                  </div>
                                  <div style={{ color: "var(--text-color)", whiteSpace: "pre-wrap" }}>
                                    {msg.reply_message}
                                  </div>
                                </div>
                              )}
 
                              {/* Compose reply form */}
                              {showReplyForm[msg.id] && (
                                <div
                                  style={{
                                    display: "grid",
                                    gap: "0.75rem",
                                    border: "1px solid var(--border-color)",
                                    borderRadius: "10px",
                                    padding: "1rem 1.25rem",
                                    background: "var(--admin-surface-soft)",
                                  }}
                                >
                                  <label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                                    Compose Support Email Response:
                                  </label>
                                  <textarea
                                    placeholder={`Type your response to ${msg.name} here...`}
                                    value={replyText[msg.id] || ""}
                                    onChange={(e) =>
                                      setReplyText((prev) => ({ ...prev, [msg.id]: e.target.value }))
                                    }
                                    rows={4}
                                    style={{
                                      width: "100%",
                                      padding: "0.75rem",
                                      borderRadius: "8px",
                                      border: "1px solid var(--border-color)",
                                      background: "var(--secondary-bg)",
                                      color: "var(--text-color)",
                                      outline: "none",
                                      fontFamily: "inherit",
                                      lineHeight: 1.5,
                                    }}
                                  />
                                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                                    <button
                                      type="button"
                                      onClick={() => setShowReplyForm((prev) => ({ ...prev, [msg.id]: false }))}
                                      className="admin-action-btn"
                                      style={{
                                        background: "transparent",
                                        border: "1px solid var(--border-color)",
                                        color: "var(--text-color)",
                                        height: "34px",
                                        minHeight: "auto",
                                        fontSize: "0.85rem",
                                        padding: "0 1.1rem",
                                      }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={submittingReply[msg.id] || !(replyText[msg.id] || "").trim()}
                                      onClick={() => void handleSendReply(msg.id)}
                                      className="admin-action-btn"
                                      style={{
                                        height: "34px",
                                        minHeight: "auto",
                                        fontSize: "0.85rem",
                                        padding: "0 1.1rem",
                                        opacity: submittingReply[msg.id] || !(replyText[msg.id] || "").trim() ? 0.6 : 1,
                                      }}
                                    >
                                      {submittingReply[msg.id] ? (
                                        <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                          <span className="reply-spinner"></span>
                                          Sending...
                                        </span>
                                      ) : (
                                        "Send Response Email"
                                      )}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Local Success Notification */}
                              {replySuccess[msg.id] && (
                                <div
                                  style={{
                                    margin: "0.5rem 0",
                                    padding: "0.75rem 1rem",
                                    borderRadius: "8px",
                                    border: "1px solid rgba(16, 185, 129, 0.3)",
                                    background: "rgba(16, 185, 129, 0.1)",
                                    color: "#10b981",
                                    fontWeight: 650,
                                    fontSize: "0.88rem",
                                    animation: "admin-fade-in 0.2s ease-out",
                                  }}
                                >
                                  ✓ {replySuccess[msg.id]}
                                </div>
                              )}
 
                              {/* Form toggles */}
                              <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
                                {!showReplyForm[msg.id] && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowReplyForm((prev) => ({ ...prev, [msg.id]: true }));
                                      if (!replyText[msg.id]) {
                                        setReplyText((prev) => ({ ...prev, [msg.id]: "" }));
                                      }
                                    }}
                                    className="admin-action-btn"
                                    style={{
                                      height: "38px",
                                      minHeight: "auto",
                                      fontSize: "0.85rem",
                                      padding: "0 1.1rem",
                                      borderRadius: "8px",
                                    }}
                                  >
                                    <MdReply size={16} />
                                    {msg.is_replied ? "Reply Again" : `Reply to ${msg.name}`}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void handleToggleRead(msg)}
                                  className="admin-action-btn"
                                  style={{
                                    height: "38px",
                                    minHeight: "auto",
                                    fontSize: "0.85rem",
                                    padding: "0 1.1rem",
                                    borderRadius: "8px",
                                    background: "transparent",
                                    border: "1px solid var(--border-color)",
                                    color: "var(--text-color)",
                                    boxShadow: "none",
                                  }}
                                >
                                  {msg.is_read ? "Keep as Unread" : "Mark Processed"}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Animation helper style */}
      <style>{`
        @keyframes admin-fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .reply-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: reply-spin 0.6s linear infinite;
          display: inline-block;
        }
        @keyframes reply-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
