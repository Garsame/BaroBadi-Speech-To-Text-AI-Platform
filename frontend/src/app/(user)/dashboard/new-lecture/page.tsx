"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl, authHeaders, getErrorMessage } from "@/lib/api";

export default function NewLecturePage() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"youtube" | "upload">("youtube");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (sourceType === "youtube") {
        const payload = {
          source_type: "youtube",
          source_url: url || "",
        };

        const res = await fetch(apiUrl("/api/v1/lectures/"), {
          method: "POST",
          headers: authHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(
            await getErrorMessage(res, "Failed to submit YouTube lecture."),
          );
        }
      } else {
        if (!file) {
          throw new Error("Please select a file to upload.");
        }

        if (!title.trim()) {
          throw new Error("Please enter a lecture title for the uploaded video.");
        }

        const formData = new FormData();
        formData.append("title", title.trim());
        formData.append("file", file);

        const res = await fetch(apiUrl("/api/v1/lectures/upload"), {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        });

        if (!res.ok) {
          throw new Error(
            await getErrorMessage(
              res,
              "Upload failed. Unsupported format or server error.",
            ),
          );
        }
      }

      router.push("/dashboard/my-lectures");
    } catch (err: unknown) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred during submission.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "0 1rem" }}>
      <style>{`
        .segmented-control {
          display: flex;
          background: var(--secondary-bg);
          padding: 0.3rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
          position: relative;
        }

        .segmented-tab {
          flex: 1;
          padding: 0.75rem 1rem;
          border: none;
          background: transparent;
          color: var(--text-color);
          font-weight: 700;
          font-size: 0.95rem;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: center;
        }

        .segmented-tab.active {
          background: var(--bg-color);
          color: var(--primary-color);
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
        }

        .text-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-color);
          color: var(--text-color);
          font-size: 0.95rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .text-input:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
          outline: none;
        }

        .custom-file-input-wrapper {
          width: 100%;
        }

        .custom-file-label {
          display: flex;
          align-items: center;
          gap: 1rem;
          width: 100%;
          padding: 0.6rem;
          border: 1px solid var(--border-color);
          border-radius: 10px;
          background: var(--bg-color);
          cursor: pointer;
          transition: border-color 0.2s, box-shadow 0.2s;
          overflow: hidden;
        }

        .custom-file-label:hover {
          border-color: var(--primary-color);
        }

        .file-btn {
          background-color: var(--secondary-bg);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 0.5rem 1rem;
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-color);
          transition: background-color 0.2s;
          white-space: nowrap;
        }

        .custom-file-label:hover .file-btn {
          background-color: var(--active-bg, rgba(99, 102, 241, 0.08));
          border-color: var(--primary-color);
        }

        .file-name-text {
          font-size: 0.9rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }

        .hidden-file-input {
          display: none !important;
        }

        .alert-error-custom {
          margin-bottom: 1.5rem;
          color: var(--danger-color);
          background-color: #fee2e2;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid #fca5a5;
        }
      `}</style>

      <h1>Add New Lecture</h1>
      <p style={{ marginBottom: "2rem", opacity: 0.8 }}>
        Choose how you want to submit the lecture for Somali note generation.
      </p>

      {error && (
        <div className="alert-error-custom">
          {error}
        </div>
      )}

      <form
        className="card"
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "2rem" }}
      >
        <div>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.75rem" }}>
            Source Type
          </label>
          <div className="segmented-control">
            <button
              type="button"
              onClick={() => setSourceType("youtube")}
              className={`segmented-tab ${sourceType === "youtube" ? "active" : ""}`}
            >
              YouTube Link
            </button>
            <button
              type="button"
              onClick={() => setSourceType("upload")}
              className={`segmented-tab ${sourceType === "upload" ? "active" : ""}`}
            >
              Video Upload
            </button>
          </div>
        </div>

        {sourceType === "youtube" ? (
          <>
            <div>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>
                YouTube URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                required
                className="text-input"
              />
            </div>

            <div
              style={{
                padding: "0.9rem 1rem",
                borderRadius: "8px",
                background: "var(--active-bg, rgba(99, 102, 241, 0.08))",
                color: "var(--text-muted)",
                lineHeight: 1.7,
                fontSize: "0.88rem",
              }}
            >
              The lecture title will be filled automatically from the YouTube
              video title, so you do not need to enter it manually.
            </div>
          </>
        ) : (
          <>
            <div>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>
                Lecture Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. Introduction to Physics"
                required
                className="text-input"
              />
            </div>

            <div>
              <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>
                Video File
              </label>
              <div className="custom-file-input-wrapper">
                <label className="custom-file-label">
                  <span className="file-btn">Choose Video File</span>
                  <span className="file-name-text">
                    {file ? `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)` : "No file chosen"}
                  </span>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(event) =>
                      setFile(event.target.files ? event.target.files[0] : null)
                    }
                    required
                    className="hidden-file-input"
                  />
                </label>
              </div>
            </div>
          </>
        )}

        <button
          type="submit"
          className="btn"
          style={{ marginTop: "1rem" }}
          disabled={isLoading}
        >
          {isLoading
            ? "Submitting to Processing Pipeline..."
            : "Submit Lecture for Processing"}
        </button>
      </form>
    </div>
  );
}
