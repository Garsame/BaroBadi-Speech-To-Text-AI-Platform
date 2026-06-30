"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  MdAccessTime,
  MdAdd,
  MdAutoAwesome,
  MdBarChart,
  MdCheckCircle,
  MdLibraryBooks,
  MdLightbulbOutline,
  MdQuiz,
  MdTrendingUp,
  MdWarning,
} from "react-icons/md";
import { FaFileAudio, FaYoutube } from "react-icons/fa";
import {
  apiUrl,
  authHeaders,
  fetchCurrentUser,
  type AuthenticatedUser,
} from "@/lib/api";
import { getSessionToken } from "@/lib/session";
import "./dashboard.css";

interface Lecture {
  id: number;
  title: string;
  source_type: string;
  status: string;
  created_at: string;
}

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

type TrendStatus = "excellent" | "improving" | "stable" | "dipping" | "no_data";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

export default function UserDashboard() {
  const [lectures, setLectures] = useState<Lecture[]>([]);
  const [quizSummary, setQuizSummary] = useState<QuizDashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = getSessionToken();
        if (token) {
          try {
            const currentUser = await fetchCurrentUser(token);
            setUser(currentUser);
          } catch (err) {
            console.error("Failed to fetch current user", err);
          }
        }

        const [lecturesRes, quizzesRes] = await Promise.all([
          fetch(apiUrl("/api/v1/lectures/"), {
            headers: authHeaders(),
          }),
          fetch(apiUrl("/api/v1/lectures/quizzes/dashboard-summary"), {
            headers: authHeaders(),
          }).catch((err) => {
            console.error("Failed to fetch quizzes summary", err);
            return null;
          }),
        ]);

        if (lecturesRes.ok) {
          const data = await lecturesRes.json();
          setLectures(data);
        }

        if (quizzesRes && quizzesRes.ok) {
          const data = await quizzesRes.json();
          setQuizSummary(data);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const completedCount = lectures.filter((lecture) => lecture.status === "completed").length;
  const processingCount = lectures.filter(
    (lecture) => lecture.status === "processing" || lecture.status === "submitted",
  ).length;
  const completionRate = lectures.length > 0 ? Math.round((completedCount / lectures.length) * 100) : 0;

  const takenQuizzes = quizSummary?.taken_quizzes || [];
  const pendingQuizzes = quizSummary?.pending_quizzes || [];
  const totalQuizzesTaken = takenQuizzes.length;

  let avgQuizScore = 0;
  if (totalQuizzesTaken > 0) {
    const totalScorePercent = takenQuizzes.reduce((acc, quiz) => {
      const score = quiz.highest_score || 0;
      const total = quiz.total_questions || 5;
      return acc + (score / total) * 100;
    }, 0);
    avgQuizScore = Math.round(totalScorePercent / totalQuizzesTaken);
  }

  const perfectQuizzes = takenQuizzes.filter(
    (quiz) =>
      quiz.highest_score !== null &&
      quiz.total_questions !== null &&
      quiz.highest_score === quiz.total_questions,
  );

  let peakTimeStr = "Not enough data";
  let peakTimeMsg = "Take a few quizzes so Baro Platform can detect your strongest study time.";

  if (totalQuizzesTaken > 0) {
    const timeGroups = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    takenQuizzes.forEach((quiz) => {
      const dateStr = quiz.last_attempt_at || quiz.created_at;
      const hour = new Date(dateStr).getHours();
      if (hour >= 5 && hour < 12) timeGroups.morning++;
      else if (hour >= 12 && hour < 17) timeGroups.afternoon++;
      else if (hour >= 17 && hour < 21) timeGroups.evening++;
      else timeGroups.night++;
    });

    const maxVal = Math.max(
      timeGroups.morning,
      timeGroups.afternoon,
      timeGroups.evening,
      timeGroups.night,
    );

    if (timeGroups.morning === maxVal) {
      peakTimeStr = "Morning focus";
      peakTimeMsg = "Your morning quiz sessions are currently the strongest.";
    } else if (timeGroups.afternoon === maxVal) {
      peakTimeStr = "Afternoon focus";
      peakTimeMsg = "Your afternoon sessions are showing the best results.";
    } else if (timeGroups.evening === maxVal) {
      peakTimeStr = "Evening focus";
      peakTimeMsg = "Evening review looks like your strongest study window.";
    } else {
      peakTimeStr = "Night focus";
      peakTimeMsg = "Late sessions are currently where you perform best.";
    }
  }

  const sortedTakenQuizzes = [...takenQuizzes].sort((a, b) => {
    const dateA = new Date(a.last_attempt_at || a.created_at).getTime();
    const dateB = new Date(b.last_attempt_at || b.created_at).getTime();
    return dateB - dateA;
  });

  let trendStatus: TrendStatus = "no_data";
  let trendText = "Complete two quizzes to activate trend analysis.";
  let trendDelta = 0;

  if (totalQuizzesTaken >= 2) {
    const last2 = sortedTakenQuizzes.slice(0, 2);
    const last2Avg =
      last2.reduce(
        (acc, quiz) => acc + ((quiz.highest_score || 0) / (quiz.total_questions || 5)) * 100,
        0,
      ) / 2;
    const rest = sortedTakenQuizzes.slice(2);
    const restAvg =
      rest.length > 0
        ? rest.reduce(
            (acc, quiz) =>
              acc + ((quiz.highest_score || 0) / (quiz.total_questions || 5)) * 100,
            0,
          ) / rest.length
        : last2Avg;

    trendDelta = Math.round(last2Avg - restAvg);

    if (last2Avg >= 85) {
      trendStatus = "excellent";
      trendText = "Your recent quiz scores are in the high-comprehension range.";
    } else if (last2Avg - restAvg >= 5) {
      trendStatus = "improving";
      trendText = `Recent scores improved by ${Math.abs(trendDelta)}%.`;
    } else if (restAvg - last2Avg >= 5) {
      trendStatus = "dipping";
      trendText = `Recent scores dipped by ${Math.abs(trendDelta)}%. Review notes before the next quiz.`;
    } else {
      trendStatus = "stable";
      trendText = "Your recent quiz performance is holding steady.";
    }
  } else if (totalQuizzesTaken === 1) {
    trendStatus = "stable";
    trendText = "First quiz completed. More attempts will sharpen this trend.";
  }

  const last5Quizzes = sortedTakenQuizzes.slice(0, 5).reverse();
  const chartWidth = 520;
  const chartHeight = 230;
  const chartBottom = 196;
  const paddingX = 42;
  const points = last5Quizzes.map((quiz, index) => {
    const score = quiz.highest_score || 0;
    const total = quiz.total_questions || 5;
    const percent = Math.round((score / total) * 100);
    const x =
      paddingX + (index * (chartWidth - 2 * paddingX)) / Math.max(1, last5Quizzes.length - 1);
    const y = chartBottom - (percent * 150) / 100;
    return { x, y, percent, title: quiz.title };
  });
  const linePath =
    points.length > 1
      ? points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ")
      : "";
  const barSeries = [completedCount, processingCount, pendingQuizzes.length, totalQuizzesTaken].map(
    (value) => Math.max(8, value * 18),
  );

  const recentLectures = lectures.slice(0, 5);
  const recommendedQuiz = pendingQuizzes[0];

  let evalTitle = "Learning engine ready";
  let evalTone = "primary";
  let EvalIcon = MdLibraryBooks;
  let evalText =
    "Upload lectures and take AI quizzes to unlock study diagnostics based on your Somali notes.";

  if (totalQuizzesTaken > 0) {
    if (avgQuizScore >= 85) {
      evalTitle = "Strong comprehension";
      evalTone = "success";
      EvalIcon = MdCheckCircle;
      evalText = `Your quiz average is ${avgQuizScore}%, which shows strong understanding of completed lectures.`;
    } else if (avgQuizScore >= 65) {
      evalTitle = "Steady progress";
      evalTone = "warning";
      EvalIcon = MdTrendingUp;
      evalText = `Your ${avgQuizScore}% average is solid. Review notes before each quiz to keep improving.`;
    } else {
      evalTitle = "Review recommended";
      evalTone = "danger";
      EvalIcon = MdWarning;
      evalText = `Your ${avgQuizScore}% average shows some gaps. Revisit the Somali notes before your next quiz.`;
    }
  }

  return (
    <div className="inapp-dashboard-page">
      <div className="inapp-dashboard-heading">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user?.full_name || "Student"}. Your main learning overview is here.</p>
        </div>
        <Link href="/dashboard/new-lecture" className="inapp-primary-link">
          <MdAdd /> New Lecture
        </Link>
      </div>

      <section className="inapp-summary-grid">
        <article className="inapp-panel inapp-compact-panel">
          <div>
            <strong>{lectures.length}</strong>
            <span>Total Lectures</span>
          </div>
          <MdLibraryBooks />
          <footer>
            <span className="inapp-positive">{processingCount}</span>
            <small>in progress</small>
            <Link href="/dashboard/my-lectures">View</Link>
          </footer>
        </article>

        <article className="inapp-panel inapp-compact-panel">
          <div>
            <strong>{completedCount}</strong>
            <span>Completed Notes</span>
          </div>
          <MdCheckCircle />
          <footer>
            <span className="inapp-positive">+{completionRate}%</span>
            <small>library completion</small>
            <Link href="/dashboard/my-lectures">View</Link>
          </footer>
        </article>

        <article className="inapp-panel inapp-compact-panel">
          <div>
            <strong>{totalQuizzesTaken}</strong>
            <span>Quizzes Taken</span>
          </div>
          <MdQuiz />
          <footer>
            <span className="inapp-positive">{pendingQuizzes.length}</span>
            <small>pending quizzes</small>
            <Link href="/dashboard/quizzes">View</Link>
          </footer>
        </article>

        <article className="inapp-panel inapp-compact-panel">
          <div>
            <strong>{avgQuizScore}%</strong>
            <span>Average Score</span>
          </div>
          <MdTrendingUp />
          <footer>
            <span className="inapp-positive">{perfectQuizzes.length}</span>
            <small>perfect scores</small>
            <Link href="/dashboard/quizzes">View</Link>
          </footer>
        </article>
      </section>

      <section className="inapp-main-grid">
        <article className="inapp-panel inapp-chart-panel">
          <header>
            <div>
              <h2>Quiz Performance</h2>
              <p>Last quiz scores across your completed lecture material.</p>
            </div>
          </header>

          {last5Quizzes.length === 0 ? (
            <div className="inapp-empty-chart">
              <MdBarChart />
              <strong>No quiz scores yet</strong>
              <span>Your performance chart appears after quiz attempts.</span>
            </div>
          ) : (
            <div className="inapp-chart-scroll">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height={chartHeight}>
                {[0, 25, 50, 75, 100].map((level) => {
                  const y = chartBottom - (level * 150) / 100;
                  return (
                    <g key={level}>
                      <line
                        x1="36"
                        y1={y}
                        x2={chartWidth - 24}
                        y2={y}
                        stroke="var(--user-border)"
                        strokeWidth="1"
                      />
                      <text x="10" y={y + 4} fill="var(--user-muted)" fontSize="10">
                        {level}%
                      </text>
                    </g>
                  );
                })}
                {points.length > 1 ? (
                  <path
                    d={linePath}
                    fill="none"
                    stroke="var(--user-primary)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {points.map((point, index) => (
                  <g key={`${point.title}-${index}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="7"
                      fill="var(--user-surface)"
                      stroke="var(--user-accent)"
                      strokeWidth="4"
                    />
                    <text
                      x={point.x}
                      y={point.y - 14}
                      fill="var(--user-text)"
                      fontSize="11"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      {point.percent}%
                    </text>
                    <text
                      x={point.x}
                      y="220"
                      fill="var(--user-muted)"
                      fontSize="10"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {point.title.length > 11 ? `${point.title.slice(0, 9)}...` : point.title}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </article>

        <article className="inapp-panel inapp-overall-panel">
          <header>
            <div>
              <h2>Overall Information</h2>
              <p>Your lecture and quiz balance.</p>
            </div>
          </header>

          <div className="inapp-ring-row">
            <div className="inapp-ring">
              <svg viewBox="0 0 140 140" width="140" height="140">
                <circle cx="70" cy="70" r="52" fill="none" stroke="var(--user-soft)" strokeWidth="14" />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="none"
                  stroke="var(--user-primary)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 52}`}
                  strokeDashoffset={`${2 * Math.PI * 52 * (1 - completionRate / 100)}`}
                  transform="rotate(-90 70 70)"
                />
              </svg>
              <strong>{completionRate}%</strong>
            </div>
            <div className="inapp-ring-stats">
              <div>
                <strong>{completedCount}</strong>
                <span>Completed</span>
              </div>
              <div>
                <strong>{processingCount}</strong>
                <span>Processing</span>
              </div>
            </div>
          </div>

          <div className="inapp-mini-bars" aria-label="Learning summary bars">
            {barSeries.map((value, index) => (
              <span key={index} style={{ height: `${Math.min(120, value)}px` }} />
            ))}
          </div>
        </article>
      </section>

      <section className="inapp-bottom-grid">
        <article className="inapp-panel">
          <header>
            <div>
              <h2>Recent Lecture Uploads</h2>
              <p>Your latest lecture sources and generated study packs.</p>
            </div>
            <Link href="/dashboard/new-lecture" className="inapp-outline-link">
              <MdAdd /> Add
            </Link>
          </header>

          {isLoading ? (
            <div className="inapp-empty-state">
              <MdAutoAwesome />
              <strong>Loading lectures</strong>
              <span>Your lecture library is being prepared.</span>
            </div>
          ) : recentLectures.length === 0 ? (
            <div className="inapp-empty-state">
              <MdLibraryBooks />
              <strong>No lectures yet</strong>
              <span>Upload a lecture to generate Somali notes and quizzes.</span>
              <Link href="/dashboard/new-lecture" className="inapp-primary-link">
                <MdAdd /> Add Lecture
              </Link>
            </div>
          ) : (
            <div className="inapp-lecture-list">
              {recentLectures.map((lecture) => (
                <Link
                  href={`/dashboard/lecture/${lecture.id}`}
                  className="inapp-lecture-row"
                  key={lecture.id}
                >
                  <span className="inapp-source-icon">
                    {lecture.source_type === "youtube" ? <FaYoutube /> : <FaFileAudio />}
                  </span>
                  <span className="inapp-lecture-copy">
                    <strong>{lecture.title || "Untitled Lecture"}</strong>
                    <small>
                      {formatDate(lecture.created_at)} - {lecture.source_type}
                    </small>
                  </span>
                  <span className={`status-badge status-${lecture.status.toLowerCase()}`}>
                    {formatStatus(lecture.status)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </article>

        <aside className="inapp-side-stack">
          <article className={`inapp-panel inapp-eval-card ${evalTone}`}>
            <span className="inapp-eval-badge">
              <EvalIcon /> {evalTitle}
            </span>
            <p>{evalText}</p>
          </article>

          <article className="inapp-panel">
            <header>
              <div>
                <h2>Study Insight</h2>
                <p>Best next action for learning.</p>
              </div>
              <MdLightbulbOutline />
            </header>
            <div className="inapp-insight-list">
              <div>
                <MdAccessTime />
                <span>
                  <strong>{peakTimeStr}</strong>
                  <small>{peakTimeMsg}</small>
                </span>
              </div>
              <div>
                <MdTrendingUp />
                <span>
                  <strong>
                    {trendStatus === "improving"
                      ? `Improving by ${Math.abs(trendDelta)}%`
                      : trendStatus === "dipping"
                        ? `Down by ${Math.abs(trendDelta)}%`
                        : trendStatus.replace("_", " ")}
                  </strong>
                  <small>{trendText}</small>
                </span>
              </div>
            </div>
          </article>

          <article className="inapp-panel">
            <header>
              <div>
                <h2>Recommendation</h2>
                <p>Suggested study action.</p>
              </div>
              <MdQuiz />
            </header>
            {recommendedQuiz ? (
              <div className="inapp-recommendation">
                <small>Recommended quiz</small>
                <strong>{recommendedQuiz.title}</strong>
                <Link href={`/dashboard/quizzes/${recommendedQuiz.id}`} className="inapp-primary-link">
                  <MdQuiz /> Start Quiz
                </Link>
              </div>
            ) : (
              <p className="inapp-muted">
                Upload a new lecture or review existing notes to continue learning.
              </p>
            )}
          </article>
        </aside>
      </section>
    </div>
  );
}
