"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { apiUrl, authHeaders } from "@/lib/api";
import { MdSchool, MdAssignment, MdCheckCircle, MdSearch, MdOutlineHourglassEmpty } from "react-icons/md";
import { FaYoutube, FaFileAudio } from "react-icons/fa";

interface QuizDashboardLectureItem {
  id: number;
  title: string;
  status: string;
  quiz_generated: boolean;
  highest_score: number | null;
  total_questions: number | null;
  last_attempt_at: string | null;
  created_at: string;
}

interface QuizDashboardSummary {
  pending_quizzes: QuizDashboardLectureItem[];
  taken_quizzes: QuizDashboardLectureItem[];
}

export default function QuizzesDashboard() {
  const [summary, setSummary] = useState<QuizDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"pending" | "taken">("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(apiUrl("/api/v1/lectures/quizzes/dashboard-summary"), {
        headers: authHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Kuma guuleysan inaan soo qaadno macluumaadka kediska.");
      }

      const data = await response.json();
      setSummary(data);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Cilad ayaa dhacday inta lagu guda jiray soo dejinta xogta.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const getScorePercentage = (score: number, total: number) => {
    if (!total) return 0;
    return Math.round((score / total) * 100);
  };

  const getScoreColor = (percent: number) => {
    if (percent >= 80) return "var(--success-color)";
    if (percent >= 50) return "var(--warning-color)";
    return "var(--danger-color)";
  };

  // Filter lists based on search
  const pendingQuizzes = summary?.pending_quizzes || [];
  const takenQuizzes = summary?.taken_quizzes || [];

  const filteredPending = pendingQuizzes.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTaken = takenQuizzes.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fade-in">
      <style>{`
        .quizzes-header-section {
          margin-bottom: 2rem;
        }

        .quizzes-tabs-container {
          display: flex;
          border-bottom: 1px solid var(--border-color);
          margin-bottom: 2rem;
          gap: 1.5rem;
        }

        .quiz-tab-btn {
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          padding: 0.8rem 0.5rem;
          font-weight: 600;
          font-size: 1.05rem;
          cursor: pointer;
          color: var(--text-muted);
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .quiz-tab-btn:hover {
          color: var(--text-color);
        }

        .quiz-tab-btn.active {
          color: var(--primary-color);
          border-bottom-color: var(--primary-color);
        }

        .quiz-badge {
          background-color: var(--border-color);
          color: var(--text-color);
          padding: 0.15rem 0.6rem;
          border-radius: 999px;
          font-size: 0.8rem;
          font-weight: bold;
        }

        .quiz-tab-btn.active .quiz-badge {
          background-color: var(--primary-color);
          color: white;
        }

        .search-bar-wrapper {
          position: relative;
          max-width: 450px;
          margin-bottom: 2rem;
        }

        .search-bar-input {
          width: 100%;
          padding: 0.75rem 1rem 0.75rem 2.8rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          background-color: var(--secondary-bg);
          color: var(--text-color);
          font-size: 0.95rem;
          transition: border-color 0.2s;
        }

        .search-bar-input:focus {
          outline: none;
          border-color: var(--primary-color);
        }

        .search-icon-pos {
          position: absolute;
          left: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .quiz-grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1.5rem;
        }

        .quiz-card {
          background-color: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: var(--card-shadow);
          display: flex;
          flex-direction: column;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .quiz-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px rgba(0,0,0,0.06);
          border-color: var(--primary-color);
        }

        .quiz-card-header {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .quiz-card-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 1.25rem;
        }

        .quiz-card-title {
          font-weight: 700;
          font-size: 1.1rem;
          margin: 0;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          height: 3.1rem;
        }

        .quiz-card-meta {
          font-size: 0.82rem;
          color: var(--text-muted);
          margin-bottom: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .quiz-card-actions {
          margin-top: auto;
          display: flex;
          gap: 10px;
        }

        .quiz-card-action-btn {
          flex: 1;
          padding: 0.65rem 1rem;
          border-radius: 10px;
          font-weight: 700;
          font-size: 0.9rem;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .btn-primary-custom {
          background-color: var(--primary-color);
          color: white;
          border: none;
        }

        .btn-primary-custom:hover {
          opacity: 0.9;
        }

        .btn-secondary-custom {
          background-color: transparent;
          border: 1px solid var(--border-color);
          color: var(--text-color);
        }

        .btn-secondary-custom:hover {
          background-color: var(--border-color);
        }

        .grade-ribbon {
          position: absolute;
          top: 1rem;
          right: 1rem;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }

        .grade-score-pill {
          padding: 0.3rem 0.8rem;
          border-radius: 999px;
          font-weight: bold;
          font-size: 0.9rem;
          color: white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        }

        .grade-percentage-text {
          font-size: 0.72rem;
          color: var(--text-muted);
          margin-top: 4px;
          font-weight: 600;
        }

        .empty-quiz-state {
          padding: 5rem 2rem;
          text-align: center;
          border-radius: 16px;
          border: 2px dashed var(--border-color);
          background-color: var(--secondary-bg);
          max-width: 600px;
          margin: 2rem auto;
        }
      `}</style>

      <div className="quizzes-header-section">
        <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
          Kedisyada AI-ga (AI Quizzes)
        </h1>
        <p style={{ opacity: 0.7, fontSize: "1.1rem" }}>
          Ku tijaabi fahamkaaga casharada kedisyo toos ah oo AI-gu kuu diyaariyey.
        </p>
      </div>

      <div className="search-bar-wrapper">
        <MdSearch size={22} className="search-icon-pos" />
        <input
          type="text"
          placeholder="Raadi cashar magaciis..."
          className="search-bar-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="quizzes-tabs-container">
        <button
          className={`quiz-tab-btn ${activeTab === "pending" ? "active" : ""}`}
          onClick={() => setActiveTab("pending")}
        >
          <MdAssignment size={18} />
          Kedisyo Dhiman
          <span className="quiz-badge">{pendingQuizzes.length}</span>
        </button>
        <button
          className={`quiz-tab-btn ${activeTab === "taken" ? "active" : ""}`}
          onClick={() => setActiveTab("taken")}
        >
          <MdCheckCircle size={18} />
          Kedisyo la Qaaday
          <span className="quiz-badge">{takenQuizzes.length}</span>
        </button>
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: "4rem 0", opacity: 0.7 }}>
          Soo dejinaya macluumaadka kediska...
        </div>
      ) : error ? (
        <div className="alert alert-danger" style={{ padding: "1.5rem", borderRadius: "12px" }}>
          <strong>Cilad:</strong> {error}
          <button onClick={fetchSummary} className="btn" style={{ marginLeft: "1.5rem", padding: "0.4rem 1rem", fontSize: "0.85rem" }}>Dib u tijaabi</button>
        </div>
      ) : activeTab === "pending" ? (
        filteredPending.length === 0 ? (
          <div className="empty-quiz-state">
            <MdOutlineHourglassEmpty size={56} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
            <h3 style={{ margin: 0, fontWeight: 700 }}>Kedisyo dhiman ma jiraan</h3>
            <p style={{ opacity: 0.7, marginTop: "0.5rem" }}>
              {searchQuery ? "Wax ku aaddan raadintaada lama helin." : "Dhammaan casharada aad soo gudbisay kedisyadooda waad qaadatay!"}
            </p>
          </div>
        ) : (
          <div className="quiz-grid-container">
            {filteredPending.map((item) => (
              <div key={item.id} className="quiz-card">
                <div className="quiz-card-header">
                  <div
                    className="quiz-card-icon"
                    style={{
                      background: item.status === "youtube" ? "rgba(239, 68, 68, 0.1)" : "rgba(139, 92, 246, 0.1)",
                    }}
                  >
                    {item.status === "youtube" ? (
                      <FaYoutube size={22} color="#ef4444" />
                    ) : (
                      <FaFileAudio size={22} color="#8b5cf6" />
                    )}
                  </div>
                  <h3 className="quiz-card-title">{item.title}</h3>
                </div>

                <div className="quiz-card-meta">
                  <span>Waqtiga la abuuray: {new Date(item.created_at).toLocaleDateString()}</span>
                  <span>Kediska AI-ga: {item.quiz_generated ? "Diyaar waa yahay" : "AI ayaa abuuraya marka la bilaabo"}</span>
                </div>

                <div className="quiz-card-actions">
                  <Link
                    href={`/dashboard/quizzes/${item.id}`}
                    className="quiz-card-action-btn btn-primary-custom"
                  >
                    Bilow Kediska
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredTaken.length === 0 ? (
        <div className="empty-quiz-state">
          <MdSchool size={56} style={{ color: "var(--text-muted)", marginBottom: "1rem" }} />
          <h3 style={{ margin: 0, fontWeight: 700 }}>Kedisyo la qaaday ma jiraan</h3>
          <p style={{ opacity: 0.7, marginTop: "0.5rem" }}>
            {searchQuery ? "Wax ku aaddan raadintaada lama helin." : "Weli ma aadan dhammaystirin wax kedis ah. Tag qaybta Kedisyo Dhiman si aad u bilowdo."}
          </p>
        </div>
      ) : (
        <div className="quiz-grid-container">
          {filteredTaken.map((item) => {
            const score = item.highest_score || 0;
            const total = item.total_questions || 5;
            const percentage = getScorePercentage(score, total);
            const scoreColor = getScoreColor(percentage);

            return (
              <div key={item.id} className="quiz-card">
                <div className="grade-ribbon">
                  <span className="grade-score-pill" style={{ backgroundColor: scoreColor }}>
                    {score}/{total}
                  </span>
                  <span className="grade-percentage-text">{percentage}% Sax ah</span>
                </div>

                <div className="quiz-card-header" style={{ paddingRight: "70px" }}>
                  <div
                    className="quiz-card-icon"
                    style={{
                      background: item.status === "youtube" ? "rgba(239, 68, 68, 0.1)" : "rgba(139, 92, 246, 0.1)",
                    }}
                  >
                    {item.status === "youtube" ? (
                      <FaYoutube size={22} color="#ef4444" />
                    ) : (
                      <FaFileAudio size={22} color="#8b5cf6" />
                    )}
                  </div>
                  <h3 className="quiz-card-title">{item.title}</h3>
                </div>

                <div className="quiz-card-meta">
                  <span>Isku daygii ugu dambeeyay: {item.last_attempt_at ? new Date(item.last_attempt_at).toLocaleDateString() : ""}</span>
                  <span>Waqtiga casharka: {new Date(item.created_at).toLocaleDateString()}</span>
                </div>

                <div className="quiz-card-actions">
                  <Link
                    href={`/dashboard/quizzes/${item.id}?mode=review`}
                    className="quiz-card-action-btn btn-secondary-custom"
                  >
                    Eeg Natiijada
                  </Link>
                  <Link
                    href={`/dashboard/quizzes/${item.id}?mode=take`}
                    className="quiz-card-action-btn btn-primary-custom"
                  >
                    Mar kale Samee
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
