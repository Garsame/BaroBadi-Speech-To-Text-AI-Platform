"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  MdAssignment,
  MdCheckCircle,
  MdPlayArrow,
  MdQuiz,
  MdRefresh,
  MdReplay,
  MdSearch,
  MdSchool,
  MdTrendingUp,
} from "react-icons/md";
import { apiUrl, authHeaders } from "@/lib/api";
import "./quizzes.css";

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

function formatDate(value: string | null) {
  if (!value) return "Not attempted";
  return new Date(value).toLocaleDateString();
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
      const response = await fetch(
        apiUrl("/api/v1/lectures/quizzes/dashboard-summary"),
        {
          headers: authHeaders(),
          cache: "no-store",
        },
      );

      if (!response.ok) {
        throw new Error("Unable to load quiz information.");
      }

      const data = (await response.json()) as QuizDashboardSummary;
      setSummary(data);
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading quizzes.",
      );
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

  const pendingQuizzes = useMemo(
    () => summary?.pending_quizzes || [],
    [summary?.pending_quizzes],
  );
  const takenQuizzes = useMemo(
    () => summary?.taken_quizzes || [],
    [summary?.taken_quizzes],
  );

  const filteredPending = pendingQuizzes.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredTaken = takenQuizzes.filter((item) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const stats = useMemo(() => {
    const totalScore = takenQuizzes.reduce(
      (sum, item) =>
        sum + getScorePercentage(item.highest_score || 0, item.total_questions || 0),
      0,
    );
    const averageScore =
      takenQuizzes.length > 0 ? Math.round(totalScore / takenQuizzes.length) : 0;

    return [
      {
        label: "Pending Quizzes",
        value: pendingQuizzes.length,
        note: "Ready to start",
        icon: <MdAssignment size={22} />,
      },
      {
        label: "Completed",
        value: takenQuizzes.length,
        note: "Attempts recorded",
        icon: <MdCheckCircle size={22} />,
      },
      {
        label: "Average Score",
        value: `${averageScore}%`,
        note: "Across quiz attempts",
        icon: <MdTrendingUp size={22} />,
      },
    ];
  }, [pendingQuizzes.length, takenQuizzes]);

  const visibleItems = activeTab === "pending" ? filteredPending : filteredTaken;

  return (
    <div className="quizzes-page">
      <header className="quizzes-hero">
        <div>
          <span className="quizzes-eyebrow">AI Practice</span>
          <h1>AI Quizzes</h1>
          <p>
            Review generated quizzes, start new attempts, and track your best
            scores from each lecture.
          </p>
        </div>
      </header>

      <section className="quizzes-stats-grid">
        {stats.map((stat) => (
          <article key={stat.label} className="quizzes-stat-card">
            <span className="quizzes-stat-icon">{stat.icon}</span>
            <div>
              <h2>{stat.value}</h2>
              <strong>{stat.label}</strong>
              <p>{stat.note}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="quizzes-toolbar">
        <label className="quizzes-search">
          <MdSearch size={21} />
          <input
            type="text"
            placeholder="Search quiz by lecture title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </label>

        <div className="quizzes-tabs" aria-label="Quiz status tabs">
          <button
            type="button"
            className={activeTab === "pending" ? "is-active" : ""}
            onClick={() => setActiveTab("pending")}
          >
            <MdAssignment size={18} />
            Pending
            <strong>{pendingQuizzes.length}</strong>
          </button>
          <button
            type="button"
            className={activeTab === "taken" ? "is-active" : ""}
            onClick={() => setActiveTab("taken")}
          >
            <MdCheckCircle size={18} />
            Taken
            <strong>{takenQuizzes.length}</strong>
          </button>
        </div>
      </section>

      {isLoading ? (
        <div className="quizzes-empty-state">Loading quiz information...</div>
      ) : error ? (
        <div className="quizzes-error-state">
          <strong>{error}</strong>
          <button type="button" onClick={fetchSummary}>
            <MdRefresh size={18} />
            Try Again
          </button>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="quizzes-empty-state">
          <MdSchool size={46} />
          <h2>
            {searchQuery
              ? "No quiz matches your search"
              : activeTab === "pending"
                ? "No pending quizzes"
                : "No completed quizzes yet"}
          </h2>
          <p>
            {activeTab === "pending"
              ? "Completed lecture quizzes will appear here when they are ready to take."
              : "Take a quiz from the pending tab to start building your practice history."}
          </p>
        </div>
      ) : (
        <section className="quizzes-card-grid">
          {visibleItems.map((item) => {
            const score = item.highest_score || 0;
            const total = item.total_questions || 0;
            const percentage = getScorePercentage(score, total);
            const scoreColor = getScoreColor(percentage);

            return (
              <article key={item.id} className="quiz-card-pro">
                <div className="quiz-card-top">
                  <span className="quiz-card-icon">
                    <MdQuiz size={23} />
                  </span>
                  {activeTab === "taken" && (
                    <span
                      className="quiz-score-pill"
                      style={{ color: scoreColor, backgroundColor: `${scoreColor}1f` }}
                    >
                      {total ? `${score}/${total}` : "0"}
                    </span>
                  )}
                </div>
                <h2>{item.title}</h2>
                <div className="quiz-card-meta">
                  <span>Created: {formatDate(item.created_at)}</span>
                  {activeTab === "pending" ? (
                    <span>
                      Status:{" "}
                      {item.quiz_generated
                        ? "Quiz is ready"
                        : "AI will generate it when you start"}
                    </span>
                  ) : (
                    <>
                      <span>Last attempt: {formatDate(item.last_attempt_at)}</span>
                      <span>{percentage}% highest score</span>
                    </>
                  )}
                </div>
                <div className="quiz-card-actions">
                  {activeTab === "pending" ? (
                    <Link href={`/dashboard/quizzes/${item.id}`}>
                      <MdPlayArrow size={18} />
                      Start Quiz
                    </Link>
                  ) : (
                    <>
                      <Link href={`/dashboard/quizzes/${item.id}?mode=review`}>
                        <MdCheckCircle size={18} />
                        Review
                      </Link>
                      <Link href={`/dashboard/quizzes/${item.id}?mode=take`}>
                        <MdReplay size={18} />
                        Retake
                      </Link>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
