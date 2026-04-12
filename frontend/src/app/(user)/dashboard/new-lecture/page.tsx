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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (sourceType === "youtube") {
        const payload = {
          title: title || "",
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

        const formData = new FormData();
        formData.append("title", title || "");
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
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <h1>Add New Lecture</h1>
      <p style={{ marginBottom: "2rem" }}>
        Provide a lecture video or YouTube link to generate Somali notes.
      </p>

      {error && (
        <div
          style={{
            marginBottom: "1rem",
            color: "var(--danger-color)",
            backgroundColor: "#fee2e2",
            padding: "1rem",
            borderRadius: "8px",
          }}
        >
          {error}
        </div>
      )}

      <form
        className="card"
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
      >
        <div>
          <label
            style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}
          >
            Lecture Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Introduction to Physics"
            required
            style={{
              width: "100%",
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--bg-color)",
              color: "var(--text-color)",
            }}
          />
        </div>

        <div>
          <label
            style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}
          >
            Source Type
          </label>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
            >
              <input
                type="radio"
                name="source"
                value="youtube"
                checked={sourceType === "youtube"}
                onChange={() => setSourceType("youtube")}
              />
              YouTube Link
            </label>
            <label
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}
            >
              <input
                type="radio"
                name="source"
                value="upload"
                checked={sourceType === "upload"}
                onChange={() => setSourceType("upload")}
              />
              Video Upload
            </label>
          </div>
        </div>

        {sourceType === "youtube" ? (
          <div>
            <label
              style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}
            >
              YouTube URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-color)",
                color: "var(--text-color)",
              }}
            />
          </div>
        ) : (
          <div>
            <label
              style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}
            >
              Video File
            </label>
            <input
              type="file"
              accept="video/*"
              onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-color)",
                color: "var(--text-color)",
              }}
            />
          </div>
        )}

        <button type="submit" className="btn" style={{ marginTop: "1rem" }} disabled={isLoading}>
          {isLoading
            ? "Submitting to Processing Pipeline..."
            : "Submit Lecture for Processing"}
        </button>
      </form>
    </div>
  );
}
