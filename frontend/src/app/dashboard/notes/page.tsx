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
  const [searchQuery, setSearchQuery] = useState("");
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

  const filteredGenreGroups = useMemo(() => {
    if (!searchQuery.trim()) return genreGroups;

    const query = searchQuery.toLowerCase();
    return genreGroups
      .map((group) => {
        const categoryMatches = group.category.toLowerCase().includes(query);
        const matchingLectures = group.lectures.filter((lecture) => {
          return (
            lecture.title.toLowerCase().includes(query) ||
            (lecture.summary && lecture.summary.toLowerCase().includes(query)) ||
            (lecture.genre_label && lecture.genre_label.toLowerCase().includes(query))
          );
        });

        if (categoryMatches) {
          return group;
        }

        if (matchingLectures.length > 0) {
          return {
            ...group,
            lectures: matchingLectures,
          };
        }

        return null;
      })
      .filter(Boolean) as GenreGroup[];
  }, [genreGroups, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const activeCategories = filteredGenreGroups.map((g) => g.category);
      setOpenGroups(new Set(activeCategories));
    }
  }, [searchQuery, filteredGenreGroups]);

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
          gap: 1rem;
          padding: 1.25rem;
        }

        .notes-library-row {
          display: flex;
          flex-direction: column;
          align-items: stretch;
          gap: 0.85rem;
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1.25rem;
          background: var(--bg-color);
          transition: border-color 0.2s ease;
        }

        .notes-library-row:hover {
          border-color: var(--primary-hover);
        }

        .notes-library-row-header {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.35rem;
        }

        .notes-library-row-genre {
          display: inline-flex;
          padding: 0.25rem 0.6rem;
          border-radius: 99px;
          background: rgba(42, 42, 114, 0.08);
          color: var(--primary-color);
          font-size: 0.76rem;
          font-weight: 500;
        }

        .notes-library-row-title {
          font-size: 1.12rem;
          font-weight: 600;
          color: var(--text-color);
          margin: 0;
          line-height: 1.35;
        }

        .notes-library-row-body {
          font-size: 0.95rem;
          color: var(--text-muted);
          line-height: 1.6;
        }

        .notes-library-row-summary-text {
          margin: 0;
        }

        .notes-library-row-key-points {
          margin: 0.65rem 0 0;
          padding-left: 1.25rem;
          color: var(--text-color);
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .notes-library-row-key-points li {
          line-height: 1.45;
        }

        .notes-library-row-footer {
          display: flex;
          justify-content: flex-end;
          align-items: center;
          margin-top: 0.25rem;
          border-top: 1px dashed var(--border-color);
          padding-top: 0.75rem;
        }

        .notes-library-row-footer-actions {
          display: flex;
          align-items: center;
          gap: 1.25rem;
        }

        .notes-library-row-score {
          font-weight: 600;
          font-size: 0.9rem;
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
                          <div className="notes-library-row-header">
                            <div className="notes-library-row-genre">
                              {lecture.genre_label || "Uncategorized"}
                            </div>
                            <h2 className="notes-library-row-title">
                              {lecture.title}
                            </h2>
                          </div>

                          <div className="notes-library-row-body">
                            <p className="notes-library-row-summary-text">
                              {lecture.summary || "Summary is not available yet."}
                            </p>

                            {keyPoints.length > 0 && (
                              <ul className="notes-library-row-key-points">
                                {keyPoints.map((point, index) => (
                                  <li key={`${lecture.id}-${index}`}>
                                    {point}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>

                          <div className="notes-library-row-footer">
                            <div className="notes-library-row-footer-actions">
                              <span
                                className="notes-library-row-score"
                                style={{ color: getScoreColor(lecture.confidence_score) }}
                              >
                                Confidence: {formatScore(lecture.confidence_score)}
                              </span>
                              <Link href={`/dashboard/lecture/${lecture.id}`} className="btn-outline">
                                Open Notes
                              </Link>
                            </div>
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
