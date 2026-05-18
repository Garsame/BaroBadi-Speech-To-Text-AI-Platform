"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { apiUrl, authHeaders } from "@/lib/api";

type NotesLibraryItem = {
  id: number;
  title: string;
  source_type?: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  completed_at?: string | null;
  genre_label?: string | null;
  subject_category?: string | null;
  genre_explanation?: string | null;
  confidence_score?: number | null;
  confidence_label?: string | null;
  summary?: string | null;
  key_points?: string[] | null;
};

type GenreGroup = {
  category: string;
  latestAt: string;
  lectures: NotesLibraryItem[];
};

const categoryRules: Array<{ category: string; keywords: string[] }> = [
  {
    category: "AI & Machine Learning",
    keywords: [
      "ai",
      "artificial intelligence",
      "machine learning",
      "deep learning",
      "neural",
      "llm",
      "large language",
      "language model",
      "prompt",
      "transformer",
      "generative",
      "gemini",
    ],
  },
  {
    category: "Software Development",
    keywords: [
      "software",
      "programming",
      "coding",
      "developer",
      "web development",
      "full-stack",
      "frontend",
      "backend",
      "react",
      "javascript",
      "python",
    ],
  },
  {
    category: "Cloud & Infrastructure",
    keywords: [
      "cloud",
      "infrastructure",
      "devops",
      "network",
      "server",
      "database",
      "security",
      "cybersecurity",
      "aws",
      "azure",
      "docker",
      "kubernetes",
    ],
  },
  {
    category: "Business & Management",
    keywords: [
      "business",
      "management",
      "marketing",
      "finance",
      "accounting",
      "economics",
      "strategy",
      "startup",
      "entrepreneur",
      "entrepreneurship",
      "sales",
      "leadership",
      "operations",
      "supply chain",
      "logistics",
      "human resources",
      "hr",
      "corporate",
      "governance",
      "investment",
      "banking",
      "product management",
      "project management",
      "market",
      "pricing",
      "revenue",
      "profit",
    ],
  },
  {
    category: "Health & Medicine",
    keywords: [
      "health",
      "medical",
      "medicine",
      "biology",
      "anatomy",
      "physiology",
      "physiological",
      "human body",
      "body system",
      "organ",
      "organs",
      "digestive",
      "digestion",
      "gastrointestinal",
      "stomach",
      "intestine",
      "intestines",
      "liver",
      "pancreas",
      "circulatory",
      "blood",
      "heart",
      "cardiac",
      "cardiovascular",
      "respiratory",
      "lung",
      "lungs",
      "nervous",
      "brain",
      "skeletal",
      "muscular",
      "endocrine",
      "immune",
      "immunology",
      "reproductive",
      "urinary",
      "renal",
      "kidney",
      "pathology",
      "clinical",
      "patient",
      "nursing",
      "nutrition",
      "disease",
      "mental health",
      "public health",
    ],
  },
  {
    category: "Science & Engineering",
    keywords: [
      "science",
      "engineering",
      "physics",
      "chemistry",
      "mathematics",
      "math",
      "robotics",
      "electronics",
    ],
  },
  {
    category: "Education & Learning",
    keywords: [
      "education",
      "teaching",
      "learning",
      "study",
      "curriculum",
      "roadmap",
      "training",
    ],
  },
  {
    category: "Arts & Humanities",
    keywords: [
      "art",
      "design",
      "history",
      "literature",
      "language",
      "philosophy",
      "religion",
      "culture",
      "music",
    ],
  },
  {
    category: "Social Sciences",
    keywords: [
      "psychology",
      "sociology",
      "politics",
      "political",
      "law",
      "anthropology",
      "communication",
    ],
  },
];

function keywordMatches(text: string, keyword: string): boolean {
  const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapedKeyword}\\b`, "i").test(text);
}

function formatDate(value?: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatScore(score?: number | null): string {
  return typeof score === "number" ? `${Math.round(score)}%` : "Pending";
}

function getScoreColor(score?: number | null): string {
  if (typeof score !== "number") return "var(--text-muted)";
  if (score >= 85) return "var(--success-color)";
  if (score >= 65) return "var(--warning-color)";
  return "var(--danger-color)";
}

function getLatestDate(lecture: NotesLibraryItem): string {
  return lecture.completed_at || lecture.updated_at || lecture.created_at;
}

function resolveCategory(lecture: NotesLibraryItem): string {
  const subjectCategory = (lecture.subject_category || "").trim();
  const knownCategory = categoryRules.some((rule) => rule.category === subjectCategory);
  if (knownCategory || subjectCategory === "Other Subjects") {
    return subjectCategory;
  }

  const genre = (lecture.genre_label || "").trim();
  const genreMatch = categoryRules.find((rule) =>
    rule.keywords.some((keyword) => keywordMatches(genre, keyword)),
  );

  if (genreMatch) return genreMatch.category;

  const titleMatch = categoryRules.find((rule) =>
    rule.keywords.some((keyword) => keywordMatches(lecture.title, keyword)),
  );

  if (titleMatch) return titleMatch.category;

  return genre && genre.toLowerCase() !== "uncategorized"
    ? genre
    : "Other Subjects";
}

function groupNotesByGenre(lectures: NotesLibraryItem[]): GenreGroup[] {
  const groups = new Map<string, NotesLibraryItem[]>();

  lectures.forEach((lecture) => {
    const category = resolveCategory(lecture);
    const existing = groups.get(category) || [];
    existing.push(lecture);
    groups.set(category, existing);
  });

  return Array.from(groups.entries())
    .map(([category, items]) => {
      const sortedItems = [...items].sort(
        (first, second) =>
          new Date(getLatestDate(second)).getTime() -
          new Date(getLatestDate(first)).getTime(),
      );

      return {
        category,
        lectures: sortedItems,
        latestAt: getLatestDate(sortedItems[0]),
      };
    })
    .sort(
      (first, second) =>
        new Date(second.latestAt).getTime() - new Date(first.latestAt).getTime(),
    );
}

export default function NotesLibraryPage() {
  const [lectures, setLectures] = useState<NotesLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchNotesLibrary = async () => {
      try {
        const response = await fetch(apiUrl("/api/v1/lectures/notes-library"), {
          headers: authHeaders(),
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Failed to load generated notes.");
        }

        const data = (await response.json()) as NotesLibraryItem[];
        setLectures(data);
        setOpenGroups(new Set(groupNotesByGenre(data).slice(0, 3).map((group) => group.category)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load generated notes.");
      } finally {
        setLoading(false);
      }
    };

    void fetchNotesLibrary();
  }, []);

  const genreGroups = useMemo(() => groupNotesByGenre(lectures), [lectures]);

  const toggleGroup = (category: string) => {
    setOpenGroups((current) => {
      const next = new Set(current);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <div>
      <style>{`
        .notes-library-lecture-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1rem;
        }

        .notes-library-row {
          display: grid;
          grid-template-columns: minmax(220px, 0.9fr) minmax(320px, 1.5fr) minmax(150px, auto);
          gap: 1rem;
          align-items: center;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 1rem;
          background: var(--bg-color);
        }

        .notes-library-row-summary {
          min-width: 0;
        }

        .notes-library-row-actions {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 1rem;
          white-space: nowrap;
        }

        @media (max-width: 980px) {
          .notes-library-row {
            grid-template-columns: 1fr;
            align-items: stretch;
          }

          .notes-library-row-actions {
            justify-content: space-between;
          }
        }
      `}</style>
      <div style={{ marginBottom: "1.5rem" }}>
        <h1 style={{ margin: 0 }}>Notes Library</h1>
        <p style={{ marginTop: "0.75rem", opacity: 0.8, maxWidth: "65ch" }}>
          Generated notes organized by the AI genre assigned during lecture processing.
        </p>
      </div>

      {loading ? (
        <div className="card" style={{ borderRadius: "8px" }}>
          Loading generated notes...
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : genreGroups.length === 0 ? (
        <div className="card" style={{ borderRadius: "8px", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
            No generated notes yet
          </h2>
          <p style={{ opacity: 0.75, marginBottom: "1rem" }}>
            Completed lectures with generated Somali notes will appear here.
          </p>
          <Link href="/dashboard/new-lecture" className="btn">
            Add Lecture
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {genreGroups.map((group) => {
            const isOpen = openGroups.has(group.category);

            return (
              <section
                key={group.category}
                className="card"
                style={{ borderRadius: "8px", padding: 0, overflow: "hidden" }}
              >
                <button
                  type="button"
                  onClick={() => toggleGroup(group.category)}
                  style={{
                    width: "100%",
                    padding: "1.1rem 1.25rem",
                    border: "none",
                    borderBottom: isOpen ? "1px solid var(--border-color)" : "none",
                    background: "transparent",
                    color: "var(--text-color)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "1rem",
                    textAlign: "left",
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontWeight: 900, fontSize: "1.08rem" }}>
                      {group.category}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                      {group.lectures.length} lecture{group.lectures.length === 1 ? "" : "s"} | Latest {formatDate(group.latestAt)}
                    </span>
                  </span>
                  <span
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isOpen ? <FaChevronUp size={13} /> : <FaChevronDown size={13} />}
                  </span>
                </button>

                {isOpen && (
                  <div className="notes-library-lecture-list">
                    {group.lectures.map((lecture) => {
                      const keyPoints = lecture.key_points?.slice(0, 2) || [];

                      return (
                        <article
                          key={lecture.id}
                          className="notes-library-row"
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                display: "inline-flex",
                                padding: "0.28rem 0.55rem",
                                borderRadius: "999px",
                                background: "rgba(99, 102, 241, 0.12)",
                                color: "var(--primary-color)",
                                fontSize: "0.78rem",
                                fontWeight: 800,
                                marginBottom: "0.6rem",
                              }}
                            >
                              {lecture.genre_label || "Uncategorized"}
                            </div>
                            <h2 style={{ fontSize: "1.05rem", margin: 0, lineHeight: 1.35 }}>
                              {lecture.title}
                            </h2>
                          </div>

                          <div className="notes-library-row-summary">
                            <p style={{ margin: 0, color: "var(--text-muted)", lineHeight: 1.55 }}>
                              {lecture.summary || "Summary is not available yet."}
                            </p>

                            {keyPoints.length > 0 && (
                              <ul
                                style={{
                                  margin: "0.7rem 0 0",
                                  paddingLeft: "1.1rem",
                                  color: "var(--text-color)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.35rem",
                                }}
                              >
                                {keyPoints.map((point, index) => (
                                  <li key={`${lecture.id}-${index}`} style={{ lineHeight: 1.45 }}>
                                    {point}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="notes-library-row-actions">
                            <span style={{ color: getScoreColor(lecture.confidence_score), fontWeight: 900 }}>
                              {formatScore(lecture.confidence_score)}
                            </span>
                            <Link href={`/dashboard/lecture/${lecture.id}`} className="btn-outline">
                              Open Notes
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
