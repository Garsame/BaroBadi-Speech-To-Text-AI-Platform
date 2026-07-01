"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import { MdCreateNewFolder, MdEdit, MdCheck, MdClose } from "react-icons/md";
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
  if (subjectCategory) {
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

  const [emptyCategories, setEmptyCategories] = useState<string[]>([]);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryValue, setEditCategoryValue] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLibraryName, setNewLibraryName] = useState("");


  // Load empty categories from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("empty-categories-user");
    if (saved) {
      try {
        setEmptyCategories(JSON.parse(saved));
      } catch (e) {}
    }
  }, []);

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
      if (openGroups.size === 0) {
        setOpenGroups(new Set(groupNotesByGenre(data).slice(0, 3).map((group) => group.category)));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load generated notes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotesLibrary();
  }, []);

  // Merges real DB categories with empty custom ones
  const genreGroups = useMemo(() => {
    const dbGroups = groupNotesByGenre(lectures);
    const dbCategoryNames = new Set(dbGroups.map((g) => g.category));

    // Filter out empty categories that now have lectures
    const activeEmpty = emptyCategories.filter((cat) => !dbCategoryNames.has(cat));
    if (activeEmpty.length !== emptyCategories.length) {
      localStorage.setItem("empty-categories-user", JSON.stringify(activeEmpty));
      setTimeout(() => setEmptyCategories(activeEmpty), 0);
    }

    const emptyGroups: GenreGroup[] = activeEmpty.map((cat) => ({
      category: cat,
      lectures: [],
      latestAt: new Date(0).toISOString(),
    }));

    return [...dbGroups, ...emptyGroups].sort((a, b) => {
      if (a.lectures.length === 0 && b.lectures.length > 0) return 1;
      if (b.lectures.length === 0 && a.lectures.length > 0) return -1;
      return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
    });
  }, [lectures, emptyCategories]);

  // Filter categories by search query
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

  // Rename category handler
  const handleRenameCategory = async (oldCategory: string) => {
    const trimmed = editCategoryValue.trim();
    if (!trimmed) {
      alert("Category name cannot be empty.");
      return;
    }
    if (trimmed === oldCategory) {
      setEditingCategory(null);
      return;
    }

    setRenaming(true);
    try {
      const response = await fetch(apiUrl("/api/v1/lectures/notes-library/rename-category"), {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          old_category: oldCategory,
          new_category: trimmed,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to rename category on backend.");
      }

      // Update local state optimistically
      setLectures((prev) =>
        prev.map((l) => {
          if (l.subject_category === oldCategory) {
            return { ...l, subject_category: trimmed };
          }
          return l;
        })
      );

      // Update empty categories list
      setEmptyCategories((prev) => {
        const next = prev.map((cat) => (cat === oldCategory ? trimmed : cat));
        localStorage.setItem("empty-categories-user", JSON.stringify(next));
        return next;
      });

      // Update open groups set
      setOpenGroups((prev) => {
        const next = new Set(prev);
        if (next.has(oldCategory)) {
          next.delete(oldCategory);
          next.add(trimmed);
        }
        return next;
      });

      setEditingCategory(null);
    } catch (err) {
      console.error(err);
      alert("Error renaming library category.");
    } finally {
      setRenaming(false);
    }
  };

  // Move lecture category handler
  const handleMoveLecture = async (lectureId: number, oldCategory: string, targetCategory: string) => {
    if (targetCategory === oldCategory) return;

    try {
      const response = await fetch(apiUrl(`/api/v1/lectures/${lectureId}/subject-category`), {
        method: "PATCH",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          subject_category: targetCategory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to move lecture category.");
      }

      // Update local state optimistically
      setLectures((prev) =>
        prev.map((l) => (l.id === lectureId ? { ...l, subject_category: targetCategory } : l))
      );

      // Expand the destination group automatically
      setOpenGroups((prev) => {
        const next = new Set(prev);
        next.add(targetCategory);
        return next;
      });
    } catch (err) {
      console.error(err);
      alert("Error moving lecture to target category.");
    }
  };

  // Create empty library handler
  const handleCreateEmptyLibrary = () => {
    setShowCreateModal(true);
  };

  // Confirm creation from Modal
  const handleCreateLibraryConfirm = () => {
    const trimmed = newLibraryName.trim();
    if (!trimmed) {
      alert("Category name cannot be empty.");
      return;
    }

    const exists = genreGroups.some((g) => g.category.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      alert("Maktabaddan mar hore ayay jirtay (This library already exists).");
      return;
    }

    setEmptyCategories((prev) => {
      const next = [...prev, trimmed];
      localStorage.setItem("empty-categories-user", JSON.stringify(next));
      return next;
    });

    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.add(trimmed);
      return next;
    });

    setShowCreateModal(false);
    setNewLibraryName("");
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
          justify-content: space-between;
          align-items: center;
          margin-top: 0.25rem;
          border-top: 1px dashed var(--border-color);
          padding-top: 0.75rem;
          flex-wrap: wrap;
          gap: 0.75rem;
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

        .notes-library-header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .notes-library-create-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          background: var(--user-primary-soft, rgba(42, 42, 114, 0.08));
          border: 1px solid var(--border-color);
          color: var(--primary-color);
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .notes-library-create-btn:hover {
          background: var(--primary-color);
          color: #fff;
          transform: translateY(-1px);
        }

        .notes-library-edit-title-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 4px;
          transition: background-color 0.2s, color 0.2s;
          margin-left: 0.5rem;
        }

        .notes-library-edit-title-btn:hover {
          background-color: var(--border-color);
          color: var(--primary-hover);
        }

        .notes-library-edit-title-form {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
          max-width: 400px;
        }

        .notes-library-edit-title-input {
          flex: 1;
          min-width: 150px;
          border: 1px solid var(--primary-hover);
          border-radius: 6px;
          padding: 4px 8px;
          font: inherit;
          font-size: 1rem;
          font-weight: bold;
          outline: none;
          color: var(--text-color);
          background: var(--bg-color);
        }

        .notes-library-title-control-btn {
          border: none;
          background: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          color: #fff;
          transition: opacity 0.2s;
        }

        .notes-library-title-control-btn.save {
          background-color: #10b981;
        }

        .notes-library-title-control-btn.cancel {
          background-color: #ef4444;
        }

        .notes-library-title-control-btn:hover {
          opacity: 0.85;
        }

        .notes-library-move-wrap {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.85rem;
        }

        .notes-library-move-label {
          color: var(--text-muted);
          font-weight: 500;
        }

        .notes-library-move-select {
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 0.85rem;
          color: var(--text-color);
          background: var(--bg-color);
          outline: none;
          cursor: pointer;
          transition: border-color 0.2s;
          max-width: 180px;
          font-weight: 600;
        }

        .notes-library-move-select:hover {
          border-color: var(--primary-hover);
        }

        .notes-library-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          animation: notes-fade-in 0.2s ease-out;
        }

        .notes-library-modal-card {
          background: var(--bg-color);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 1.5rem;
          width: min(420px, calc(100% - 32px));
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          animation: notes-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes notes-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes notes-slide-up {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .notes-library-modal-card h3 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--text-color);
        }

        .notes-library-modal-card p {
          margin: 0;
          font-size: 0.92rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .notes-library-modal-input {
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 0.95rem;
          outline: none;
          color: var(--text-color);
          background: var(--bg-color);
          transition: border-color 0.2s;
        }

        .notes-library-modal-input:focus {
          border-color: var(--primary-hover);
        }

        .notes-library-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .notes-library-modal-btn {
          border: none;
          border-radius: 8px;
          padding: 8px 16px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s;
        }

        .notes-library-modal-btn.save {
          background-color: var(--primary-color);
          color: #fff;
        }

        .notes-library-modal-btn.cancel {
          background-color: var(--border-color);
          color: var(--text-color);
        }

        .notes-library-modal-btn:hover {
          opacity: 0.9;
        }
      `}</style>
      <div style={{ marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ margin: 0 }}>Notes Library</h1>
          <p style={{ marginTop: "0.75rem", opacity: 0.8, maxWidth: "65ch" }}>
            Generated notes organized by the AI genre assigned during lecture processing.
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateEmptyLibrary}
          className="notes-library-create-btn"
        >
          <MdCreateNewFolder size={18} />
          Abuur Maktabad (Create Library)
        </button>
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
          {filteredGenreGroups.map((group) => {
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
                  <span style={{ minWidth: 0, flex: 1 }} onClick={(e) => e.stopPropagation()}>
                    {editingCategory === group.category ? (
                      <div className="notes-library-edit-title-form">
                        <input
                          type="text"
                          className="notes-library-edit-title-input"
                          value={editCategoryValue}
                          onChange={(e) => setEditCategoryValue(e.target.value)}
                          disabled={renaming}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="notes-library-title-control-btn save"
                          onClick={() => handleRenameCategory(group.category)}
                          disabled={renaming}
                          title="Save"
                        >
                          <MdCheck size={18} />
                        </button>
                        <button
                          type="button"
                          className="notes-library-title-control-btn cancel"
                          onClick={() => setEditingCategory(null)}
                          disabled={renaming}
                          title="Cancel"
                        >
                          <MdClose size={18} />
                        </button>
                      </div>
                    ) : (
                      <span style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ fontWeight: 900, fontSize: "1.08rem" }}>
                          {group.category}
                        </span>
                        <button
                          type="button"
                          className="notes-library-edit-title-btn"
                          title="Rename Category"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategory(group.category);
                            setEditCategoryValue(group.category);
                          }}
                        >
                          <MdEdit size={15} />
                        </button>
                      </span>
                    )}
                    <span style={{ color: "var(--text-muted)", fontSize: "0.9rem", display: "block", marginTop: "2px" }}>
                      {group.lectures.length} lecture{group.lectures.length === 1 ? "" : "s"}
                      {group.lectures.length > 0 && ` | Latest ${formatDate(group.latestAt)}`}
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
                    {group.lectures.length === 0 ? (
                      <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.92rem", fontStyle: "italic" }}>
                        Maktabaddani waa maran tahay. Ka soo wareeji casharrada kale adoo adeegsanaya badhanka "Move". (This library is empty. Move lectures here using the "Move" dropdown.)
                      </div>
                    ) : (
                      group.lectures.map((lecture) => {
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
                              <div className="notes-library-move-wrap">
                                <span className="notes-library-move-label">Maktabadda:</span>
                                <select
                                  className="notes-library-move-select"
                                  value={group.category}
                                  onChange={(e) => handleMoveLecture(lecture.id, group.category, e.target.value)}
                                >
                                  {genreGroups.map((g) => (
                                    <option key={g.category} value={g.category}>
                                      {g.category}
                                    </option>
                                  ))}
                                </select>
                              </div>

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
                      })
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      {showCreateModal && (
        <div className="notes-library-modal-overlay" onClick={() => { setShowCreateModal(false); setNewLibraryName(""); }}>
          <div className="notes-library-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Abuur Maktabad Cusub</h3>
            <p>Geli magaca maktabadda cusub ee aad rabto inaad abuurto:</p>
            <input
              type="text"
              placeholder="Magaca maktabadda (e.g. Speech & Motivation)"
              value={newLibraryName}
              onChange={(e) => setNewLibraryName(e.target.value)}
              className="notes-library-modal-input"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateLibraryConfirm();
                if (e.key === "Escape") {
                  setShowCreateModal(false);
                  setNewLibraryName("");
                }
              }}
            />
            <div className="notes-library-modal-actions">
              <button
                type="button"
                className="notes-library-modal-btn cancel"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewLibraryName("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="notes-library-modal-btn save"
                onClick={handleCreateLibraryConfirm}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
