"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  MdCheckCircle,
  MdCloudUpload,
  MdLink,
  MdOutlineOndemandVideo,
  MdUploadFile,
  MdWarning,
} from "react-icons/md";
import { apiUrl, authHeaders, getErrorMessage } from "@/lib/api";
import "./new-lecture.css";

const validateVideoSignature = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      if (!e.target || !e.target.result) {
        resolve(false);
        return;
      }
      const arr = new Uint8Array(e.target.result as ArrayBuffer);
      if (arr.length < 12) {
        resolve(false);
        return;
      }
      // EBML (MKV, WEBM): 1A 45 DF A3
      if (arr[0] === 0x1A && arr[1] === 0x45 && arr[2] === 0xDF && arr[3] === 0xA3) {
        resolve(true);
        return;
      }
      // AVI: RIFF (52 49 46 46) ... AVI (41 56 49 20)
      if (
        arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46 &&
        arr[8] === 0x41 && arr[9] === 0x56 && arr[10] === 0x49 && arr[11] === 0x20
      ) {
        resolve(true);
        return;
      }
      // FLV: FLV\x01 (46 4c 56 01)
      if (arr[0] === 0x46 && arr[1] === 0x4c && arr[2] === 0x56 && arr[3] === 0x01) {
        resolve(true);
        return;
      }
      // MPEG: 00 00 01 ba or 00 00 01 b3
      if (arr[0] === 0x00 && arr[1] === 0x00 && arr[2] === 0x01 && (arr[3] === 0xba || arr[3] === 0xb3)) {
        resolve(true);
        return;
      }
      // MP4 / MOV: ftyp (66 74 79 70) starting at offset 4 (bytes 4-7)
      let hasFtyp = false;
      for (let i = 0; i <= arr.length - 4 && i < 20; i++) {
        if (
          arr[i] === 0x66 && // f
          arr[i + 1] === 0x74 && // t
          arr[i + 2] === 0x79 && // y
          arr[i + 3] === 0x70    // p
        ) {
          hasFtyp = true;
          break;
        }
      }
      if (hasFtyp) {
        resolve(true);
        return;
      }

      resolve(false);
    };
    reader.readAsArrayBuffer(file.slice(0, 256));
  });
};

type CurrentUserVerification = {
  is_email_verified?: boolean;
};

export default function NewLecturePage() {
  const router = useRouter();
  const [sourceType, setSourceType] = useState<"youtube" | "upload">("youtube");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userVerified, setUserVerified] = useState<boolean | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/v1/auth/me"), { headers: authHeaders() })
      .then((r) => r.json())
      .then((d: CurrentUserVerification) => {
        setUserVerified(d.is_email_verified === true);
      })
      .catch(() => {
        setUserVerified(false);
      });
  }, []);

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

        const allowedTypes = [
          "video/mp4", "video/x-msvideo", "video/quicktime", "video/x-matroska", "video/webm"
        ];
        const allowedExts = ["mp4", "avi", "mov", "mkv", "webm"];
        const ext = file.name.split(".").pop()?.toLowerCase() || "";
        if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
          throw new Error("Invalid media type. Only MP4, MOV, WEBM, MKV, and AVI video files are supported.");
        }

        const isValidSignature = await validateVideoSignature(file);
        if (!isValidSignature) {
          throw new Error("Invalid file signature. The selected file is not a valid video file.");
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

  if (userVerified === null) {
    return (
      <div className="new-lecture-page">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
          <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "var(--public-muted)" }}>
            Loading account details...
          </div>
        </div>
      </div>
    );
  }

  if (userVerified === false) {
    return (
      <div className="new-lecture-page">
        <div className="new-lecture-heading">
          <div>
            <h1>Add New Lecture</h1>
            <p>Submit a YouTube lecture or upload a local file for Somali note generation.</p>
          </div>
        </div>
        <div style={{
          background: "var(--public-surface)",
          border: "1px solid var(--public-border)",
          borderRadius: "16px",
          padding: "3rem 2rem",
          textAlign: "center",
          maxWidth: "600px",
          margin: "3rem auto",
          boxShadow: "var(--public-shadow)"
        }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "rgba(217, 119, 6, 0.1)",
            color: "#d97706",
            marginBottom: "1.5rem"
          }}>
            <MdWarning size={36} />
          </div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "1rem", color: "var(--public-text)" }}>
            Email Verification Required
          </h2>
          <p style={{ color: "var(--public-muted)", lineHeight: "1.6", marginBottom: "2rem" }}>
            To generate lectures and AI notes, your email address must be verified. 
            Please verify your existing email address in your profile, or update it to a new one to receive a verification code.
          </p>
          <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
            <Link
              href="/dashboard/profile"
              style={{
                background: "var(--public-primary)",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "12px",
                fontWeight: "700",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                transition: "background 0.2s"
              }}
            >
              Go to Profile Settings
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="new-lecture-page">
      <div className="new-lecture-heading">
        <div>
          <h1>Add New Lecture</h1>
          <p>Submit a YouTube lecture or upload a local file for Somali note generation.</p>
        </div>
      </div>

      <div className="new-lecture-layout">
        <aside className="new-lecture-guide">
          <span className="new-lecture-guide-icon">
            <MdOutlineOndemandVideo />
          </span>
          <h2>Lecture processing flow</h2>
          <p>
            Baro Platform validates the source, prepares the media, creates transcript text,
            and generates Somali study notes for your dashboard.
          </p>
          <div className="new-lecture-guide-list">
            <span>
              <MdCheckCircle /> Source validation
            </span>
            <span>
              <MdCheckCircle /> AI transcription
            </span>
            <span>
              <MdCheckCircle /> Somali notes and quiz material
            </span>
          </div>
        </aside>

        <section className="new-lecture-card">
          <div className="new-lecture-card-header">
            <div>
              <h2>Lecture source</h2>
              <p>Choose the input type that matches your lecture material.</p>
            </div>
          </div>

          {error && <div className="new-lecture-error">{error}</div>}

          <form className="new-lecture-form" onSubmit={handleSubmit}>
            <div className="new-lecture-tabs" role="tablist" aria-label="Lecture source type">
              <button
                type="button"
                onClick={() => setSourceType("youtube")}
                className={sourceType === "youtube" ? "active" : ""}
              >
                <MdLink /> YouTube Link
              </button>
              <button
                type="button"
                onClick={() => setSourceType("upload")}
                className={sourceType === "upload" ? "active" : ""}
              >
                <MdCloudUpload /> Video Upload
              </button>
            </div>

            {sourceType === "youtube" ? (
              <div className="new-lecture-fields">
                <label className="new-lecture-field">
                  <span>YouTube URL</span>
                  <input
                    type="url"
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                  />
                </label>
                <div className="new-lecture-note">
                  The lecture title is detected from YouTube automatically.
                </div>
              </div>
            ) : (
              <div className="new-lecture-fields">
                {/* Upload Instructions */}
                <div style={{
                  background: "rgba(66, 133, 244, 0.05)",
                  border: "1px solid rgba(66, 133, 244, 0.15)",
                  borderRadius: "12px",
                  padding: "1rem 1.25rem",
                  fontSize: "0.88rem",
                  color: "var(--public-text)",
                  marginBottom: "1.25rem"
                }}>
                  <strong style={{ display: "block", marginBottom: "6px", color: "var(--public-primary)" }}>
                    Video Upload Instructions:
                  </strong>
                  <ul style={{ margin: 0, paddingLeft: "1.2rem", lineHeight: "1.5", color: "var(--public-muted)" }}>
                    <li><strong>Supported formats:</strong> MP4, MOV, WEBM, MKV, AVI</li>
                    <li>Only valid video data is permitted (raw binary chunks or renamed files will be rejected by signature checks)</li>
                    <li><strong>Size limits:</strong> Max file size is 500MB</li>
                  </ul>
                </div>

                <label className="new-lecture-field">
                  <span>Lecture Title</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. Introduction to Physics"
                    required
                  />
                </label>

                <label className="new-lecture-upload">
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo"
                    onChange={async (event) => {
                      const selected = event.target.files ? event.target.files[0] : null;
                      if (selected) {
                        const allowedTypes = [
                          "video/mp4", "video/x-msvideo", "video/quicktime", "video/x-matroska", "video/webm"
                        ];
                        const allowedExts = ["mp4", "avi", "mov", "mkv", "webm"];
                        const ext = selected.name.split(".").pop()?.toLowerCase() || "";
                        if (!allowedTypes.includes(selected.type) && !allowedExts.includes(ext)) {
                          setError("Unsupported file format. Please choose a valid video file.");
                          setFile(null);
                          return;
                        }
                        setError("Validating file signature...");
                        const isValid = await validateVideoSignature(selected);
                        if (!isValid) {
                          setError("Invalid file signature. The file is corrupted, a renamed archive/chunk, or not a valid video.");
                          setFile(null);
                          return;
                        }
                        setError(null);
                      }
                      setFile(selected);
                    }}
                    required
                  />
                  <span className="new-lecture-upload-icon">
                    <MdUploadFile />
                  </span>
                  <strong>{file ? file.name : "Choose a video file"}</strong>
                  <small>
                    {file
                      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB selected`
                      : "MP4, MOV, WEBM, MKV, or AVI (Max 500MB)"}
                  </small>
                </label>
              </div>
            )}

            <button type="submit" className="new-lecture-submit" disabled={isLoading}>
              {isLoading ? "Submitting to Processing Pipeline..." : "Submit Lecture"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
