"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { FaPause, FaPlay } from "react-icons/fa";
import { apiUrl, authHeaders, getErrorMessage } from "@/lib/api";
import { getSessionToken } from "@/lib/session";

type LectureDetail = {
  id: number;
  title: string;
  source_type: string;
  source_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  transcript?: {
    raw_text: string;
    cleaned_text?: string | null;
    metadata_json?: {
      analysis?: {
        confidence_score?: number;
        confidence_label?: string;
        valuation_summary?: string;
        genre_label?: string;
        genre_explanation?: string;
      };
    } | null;
  } | null;
  notes?: {
    structured_content: string;
    summary?: string | null;
    key_points?: string[] | null;
  } | null;
  job?: {
    status: string;
    stage: string;
    progress_percent: number;
    error_message?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
  } | null;
  media_asset?: {
    file_path: string;
    media_type?: string | null;
    duration_seconds?: number | null;
  } | null;
};

type LectureLog = {
  id: number;
  level: string;
  message: string;
  created_at: string;
  metadata_json?: {
    failed_stage?: string;
    [key: string]: unknown;
  } | null;
};

type LectureChatMessage = {
  id: number;
  role: string;
  content: string;
  created_at: string;
};

type LectureChatAskResponse = {
  user_message: LectureChatMessage;
  assistant_message: LectureChatMessage;
};

type TranscriptSegment = {
  startSecond: number;
  endSecond: number;
  timeRange: string;
  text: string;
};

const tabs = [
  "overview",
  "transcript",
  "somali-notes",
  "chatbot",
  "processing-log",
] as const;

async function fetchLectureResources(id: string): Promise<{
  detail: LectureDetail;
  lectureLogs: LectureLog[];
}> {
  const [lectureRes, logsRes] = await Promise.all([
    fetch(apiUrl(`/api/v1/lectures/${id}`), {
      headers: authHeaders(),
    }),
    fetch(apiUrl(`/api/v1/lectures/${id}/logs`), {
      headers: authHeaders(),
    }),
  ]);

  if (!lectureRes.ok) {
    throw new Error(
      await getErrorMessage(lectureRes, "Failed to load lecture details."),
    );
  }

  return {
    detail: (await lectureRes.json()) as LectureDetail,
    lectureLogs: logsRes.ok ? ((await logsRes.json()) as LectureLog[]) : [],
  };
}

async function fetchLectureChatMessages(
  id: string,
): Promise<LectureChatMessage[]> {
  const response = await fetch(apiUrl(`/api/v1/lectures/${id}/chat/messages`), {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "Failed to load lecture chatbot history."),
    );
  }

  return (await response.json()) as LectureChatMessage[];
}

function formatDate(dateValue?: string | null): string {
  if (!dateValue) {
    return "Not available yet";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString();
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) {
    return "Not available yet";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function formatTranscriptTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((part) => part.toString().padStart(2, "0"))
      .join(":");
  }

  return [minutes, seconds]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function splitTranscriptIntoChunks(text: string): string[] {
  const sentenceChunks =
    text
      .match(/[^.!?]+[.!?]*/g)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];

  const sourceChunks =
    sentenceChunks.length > 0
      ? sentenceChunks
      : text
          .split(/\n+/)
          .map((line) => line.trim())
          .filter(Boolean);

  if (sourceChunks.length === 0) {
    return [];
  }

  const groupedChunks: string[] = [];
  let currentGroup: string[] = [];
  let currentWordCount = 0;

  for (const chunk of sourceChunks) {
    currentGroup.push(chunk);
    currentWordCount += countWords(chunk);

    if (currentGroup.length >= 3 || currentWordCount >= 55) {
      groupedChunks.push(currentGroup.join(" "));
      currentGroup = [];
      currentWordCount = 0;
    }
  }

  if (currentGroup.length > 0) {
    groupedChunks.push(currentGroup.join(" "));
  }

  return groupedChunks;
}

function buildTranscriptSegments(
  text: string,
  durationSeconds?: number | null,
): TranscriptSegment[] {
  const chunks = splitTranscriptIntoChunks(text);

  if (chunks.length === 0) {
    return [];
  }

  const wordCounts = chunks.map((chunk) => Math.max(1, countWords(chunk)));
  const totalWords = wordCounts.reduce((sum, wordCount) => sum + wordCount, 0);
  const estimatedDurationSeconds = Math.max(
    chunks.length,
    Math.ceil(totalWords / 2.5),
  );
  const timelineSeconds = Math.max(
    chunks.length,
    durationSeconds && durationSeconds > 0
      ? Math.ceil(durationSeconds) + 1
      : estimatedDurationSeconds + 1,
  );

  const boundaries: number[] = [0];
  let cumulativeWords = 0;

  for (let index = 0; index < wordCounts.length; index += 1) {
    cumulativeWords += wordCounts[index];

    if (index === wordCounts.length - 1) {
      boundaries.push(timelineSeconds);
      continue;
    }

    const rawBoundary = Math.round(
      (cumulativeWords / totalWords) * timelineSeconds,
    );
    const minBoundary = boundaries[index] + 1;
    const maxBoundary = timelineSeconds - (wordCounts.length - (index + 1));
    boundaries.push(Math.min(maxBoundary, Math.max(minBoundary, rawBoundary)));
  }

  return chunks.map((chunk, index) => {
    const startSecond = boundaries[index];
    const endSecond = Math.max(startSecond + 1, boundaries[index + 1]);
    const displayEndSecond = Math.max(startSecond, endSecond - 1);

    return {
      startSecond,
      endSecond,
      timeRange: `${formatTranscriptTimestamp(startSecond)} - ${formatTranscriptTimestamp(displayEndSecond)}`,
      text: chunk,
    };
  });
}

function findTranscriptSegmentIndex(
  segments: TranscriptSegment[],
  currentSecond: number,
): number {
  if (segments.length === 0) {
    return -1;
  }

  const activeIndex = segments.findIndex(
    (segment) =>
      currentSecond >= segment.startSecond && currentSecond < segment.endSecond,
  );

  if (activeIndex >= 0) {
    return activeIndex;
  }

  const lastIndex = segments.length - 1;
  return currentSecond >= segments[lastIndex].startSecond ? lastIndex : -1;
}

function isRemoteMediaPath(filePath?: string | null): boolean {
  return Boolean(filePath?.startsWith("http://") || filePath?.startsWith("https://"));
}

function getLectureMediaPlaybackUrl(
  lecture: LectureDetail | null,
  lectureId: string,
  sessionToken: string | null,
): string | null {
  if (!lecture?.media_asset?.file_path || !sessionToken) {
    return null;
  }

  if (isRemoteMediaPath(lecture.media_asset.file_path)) {
    return null;
  }

  return apiUrl(
    `/api/v1/lectures/${lectureId}/media?token=${encodeURIComponent(
      sessionToken,
    )}`,
  );
}

function getMediaUnavailableMessage(lecture: LectureDetail | null): string | null {
  if (!lecture) {
    return null;
  }

  if (!lecture.media_asset?.file_path) {
    return "Original lecture audio is not ready for playback yet.";
  }

  if (isRemoteMediaPath(lecture.media_asset.file_path)) {
    return "This lecture does not have a local audio file available for playback.";
  }

  return null;
}

function renderInlineFormattedText(text: string): React.ReactNode[] {
  return text
    .split(/(\*\*.*?\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      const boldMatch = part.match(/^\*\*(.*?)\*\*$/);

      if (boldMatch) {
        return (
          <strong key={`${part}-${index}`} style={{ fontWeight: 700 }}>
            {boldMatch[1]}
          </strong>
        );
      }

      return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    });
}

function renderStructuredNotes(text: string): React.ReactNode {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line, index, array) => !(line === "" && array[index - 1] === ""));

  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    elements.push(
      <ul
        key={`list-${elements.length}`}
        style={{
          paddingLeft: "1.4rem",
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
        }}
      >
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`} style={{ lineHeight: 1.8 }}>
            {renderInlineFormattedText(item)}
          </li>
        ))}
      </ul>,
    );

    listItems = [];
  };

  for (const line of lines) {
    if (!line) {
      flushList();
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const headingLevel = headingMatch[1].length;
      const headingText = headingMatch[2].trim();

      elements.push(
        <div
          key={`heading-${elements.length}`}
          style={{
            fontWeight: 800,
            fontSize:
              headingLevel <= 2
                ? "1.3rem"
                : headingLevel === 3
                  ? "1.1rem"
                  : "1rem",
            marginTop: elements.length === 0 ? 0 : "0.5rem",
            color: "var(--text-color)",
          }}
        >
          {renderInlineFormattedText(headingText)}
        </div>,
      );
      continue;
    }

    const bulletMatch = line.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1].trim());
      continue;
    }

    flushList();

    const fullyBoldLineMatch = line.match(/^\*\*(.*?)\*\*$/);
    if (fullyBoldLineMatch) {
      elements.push(
        <div
          key={`subheading-${elements.length}`}
          style={{
            fontWeight: 700,
            fontSize: "1rem",
            marginTop: "0.35rem",
            color: "var(--text-color)",
          }}
        >
          {fullyBoldLineMatch[1]}
        </div>,
      );
      continue;
    }

    elements.push(
      <p
        key={`paragraph-${elements.length}`}
        style={{
          margin: 0,
          lineHeight: 1.85,
          color: "var(--text-color)",
        }}
      >
        {renderInlineFormattedText(line)}
      </p>,
    );
  }

  flushList();

  if (elements.length === 0) {
    return <p style={{ margin: 0 }}>No generated notes available yet.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
      {elements}
    </div>
  );
}

function getAccentColor(status?: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
    case "success":
      return "var(--success-color)";
    case "processing":
    case "running":
      return "var(--warning-color)";
    case "warning":
      return "var(--warning-color)";
    case "failed":
    case "error":
      return "var(--danger-color)";
    case "canceled":
      return "#6b7280";
    default:
      return "var(--primary-color)";
  }
}

function formatStageLabel(stage?: string | null): string {
  if (!stage) {
    return "Not started";
  }

  const cleanedStage = stage.includes(".")
    ? stage.split(".").at(-1) ?? stage
    : stage;

  return cleanedStage.replace(/_/g, " ");
}

function formatOperationLabel(stage?: string | null): string {
  const cleanedStage = stage?.includes(".")
    ? stage.split(".").at(-1) ?? stage
    : stage;

  switch (cleanedStage) {
    case "generating_notes":
      return "Somali note generation";
    case "transcribing":
      return "Audio transcription";
    case "preparing_media":
      return "Media preparation";
    case "extracting_audio":
      return "Audio extraction";
    case "preparing_audio":
      return "Audio preparation";
    case "cleaning_transcript":
      return "Transcript cleanup";
    case "saving_results":
      return "Saving lecture results";
    default:
      return formatStageLabel(stage || "Lecture processing");
  }
}

function getRawProviderErrorParts(message: string): {
  code?: string;
  status?: string;
  providerMessage?: string;
} | null {
  const headerMatch = message.match(/\b(\d{3})\s+([A-Z_]+)\b/);
  const codeMatch = message.match(/['"]code['"]:\s*(\d{3})/);
  const statusMatch = message.match(/['"]status['"]:\s*['"]([^'"]+)['"]/);
  const providerMessageMatch = message.match(/['"]message['"]:\s*['"]([^'"]+)['"]/);

  const code = codeMatch?.[1] || headerMatch?.[1];
  const status = statusMatch?.[1] || headerMatch?.[2];
  const providerMessage = providerMessageMatch?.[1];

  if (!code && !status && !providerMessage) {
    return null;
  }

  return { code, status, providerMessage };
}

function humanizeProcessingError(message: string, failedStage?: string | null): string {
  const cleanedMessage = message.trim();
  const providerError = getRawProviderErrorParts(cleanedMessage);

  if (!providerError) {
    return cleanedMessage;
  }

  const code = providerError.code || "unknown";
  const status = providerError.status || "UNKNOWN";
  const operation = formatOperationLabel(failedStage);
  const providerMessage =
    providerError.providerMessage?.replace(/[.\s]+$/, "") ||
    "The provider did not return more details";

  let reason = "the AI provider returned an error";
  let nextStep = "Retry this lecture or check the backend logs for more detail.";

  if (["500", "502", "503", "504"].includes(code) || ["INTERNAL", "UNAVAILABLE", "DEADLINE_EXCEEDED"].includes(status)) {
    reason = "the external AI provider returned a temporary server error";
    nextStep = "Retry the lecture. If it fails again, wait a few minutes or try a shorter lecture.";
  } else if (code === "429" || status === "RESOURCE_EXHAUSTED") {
    reason = "the AI provider rate limit or quota was reached";
    nextStep = "Wait for the quota to reset, reduce repeated retries, or check API billing/quota settings.";
  } else if (["401", "403"].includes(code) || ["UNAUTHENTICATED", "PERMISSION_DENIED"].includes(status)) {
    reason = "the AI provider rejected the API credentials or permissions";
    nextStep = "Check GEMINI_API_KEY, billing access, and model permissions.";
  } else if (code === "400" || status === "INVALID_ARGUMENT") {
    reason = "the AI provider rejected the request";
    nextStep = "The transcript or prompt may be too large or invalid for the configured model.";
  }

  const stageContext =
    failedStage?.includes("generating_notes") || operation === "Somali note generation"
      ? " The transcript was already prepared, but the model failed while creating the Somali notes."
      : "";

  return `${operation} failed because ${reason} (HTTP ${code} / ${status}).${stageContext} Provider message: ${providerMessage}. ${nextStep}`;
}

function getConfidenceColor(score?: number): string {
  if (typeof score !== "number") {
    return "var(--warning-color)";
  }

  if (score >= 85) {
    return "var(--success-color)";
  }

  if (score >= 70) {
    return "var(--warning-color)";
  }

  return "var(--danger-color)";
}

export default function LectureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const transcriptAudioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptSegmentRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [activeTab, setActiveTab] =
    useState<(typeof tabs)[number]>("overview");
  const [lecture, setLecture] = useState<LectureDetail | null>(null);
  const [logs, setLogs] = useState<LectureLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [chatMessages, setChatMessages] = useState<LectureChatMessage[]>([]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isTranscriptPlaying, setIsTranscriptPlaying] = useState(false);
  const [hasTranscriptPlaybackStarted, setHasTranscriptPlaybackStarted] =
    useState(false);
  const [currentTranscriptTime, setCurrentTranscriptTime] = useState(0);
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<
    number | null
  >(null);
  const [mediaPlaybackError, setMediaPlaybackError] = useState<string | null>(
    null,
  );
  const [isNotesPlaying, setIsNotesPlaying] = useState(false);

  const transcriptText =
    lecture?.transcript?.cleaned_text || lecture?.transcript?.raw_text || "";
  const transcriptSegments = buildTranscriptSegments(
    transcriptText,
    lecture?.media_asset?.duration_seconds,
  );
  const activeTranscriptSegmentIndex = hasTranscriptPlaybackStarted
    ? findTranscriptSegmentIndex(transcriptSegments, currentTranscriptTime)
    : -1;
  const mediaPlaybackUrl = getLectureMediaPlaybackUrl(
    lecture,
    id,
    sessionToken,
  );
  const mediaUnavailableMessage = getMediaUnavailableMessage(lecture);
  const displayAudioDuration =
    audioDurationSeconds ||
    lecture?.media_asset?.duration_seconds ||
    transcriptSegments.at(-1)?.endSecond ||
    0;
  const playbackProgressPercent =
    displayAudioDuration > 0
      ? Math.min(100, (currentTranscriptTime / displayAudioDuration) * 100)
      : 0;

  useEffect(() => {
    let isActive = true;

    const loadLecture = async (showInitialLoading = false) => {
      if (showInitialLoading) setLoading(true);
      try {
        const { detail, lectureLogs } = await fetchLectureResources(id);
        if (!isActive) return;
        setLecture(detail);
        setLogs(lectureLogs);
        setLoadError(null);
      } catch (err: unknown) {
        if (!isActive) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load lecture details.");
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void loadLecture(true);

    return () => {
      isActive = false;
    };
  }, [id]);

  useEffect(() => {
    if (!lecture) return;

    const status = lecture.status?.toLowerCase();
    const isTerminal = ["completed", "failed", "canceled"].includes(status || "");
    if (isTerminal) return;

    const interval = window.setInterval(() => {
      void refreshLecture();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [lecture?.status]);

  useEffect(() => {
    setChatMessages([]);
    setChatLoaded(false);
    setChatLoading(false);
    setChatError(null);
    setChatDraft("");
    setChatSending(false);
  }, [id]);

  useEffect(() => {
    if (activeTab !== "chatbot" || chatLoaded || chatLoading) {
      return;
    }

    let isActive = true;

    const loadChatMessages = async () => {
      setChatLoading(true);
      try {
        const messages = await fetchLectureChatMessages(id);
        if (!isActive) {
          return;
        }

        setChatMessages(messages);
        setChatError(null);
        setChatLoaded(true);
      } catch (err: unknown) {
        if (!isActive) {
          return;
        }

        setChatError(
          err instanceof Error
            ? err.message
            : "Failed to load lecture chatbot history.",
        );
      } finally {
        if (isActive) {
          setChatLoading(false);
        }
      }
    };

    void loadChatMessages();

    return () => {
      isActive = false;
    };
  }, [activeTab, chatLoaded, chatLoading, id]);

  useEffect(() => {
    if (activeTab !== "chatbot") {
      return;
    }

    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [activeTab, chatMessages, chatSending]);

  useEffect(() => {
    setSessionToken(getSessionToken());
  }, [id]);

  useEffect(() => {
    const audio = transcriptAudioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    setIsTranscriptPlaying(false);
    setHasTranscriptPlaybackStarted(false);
    setCurrentTranscriptTime(0);
    setAudioDurationSeconds(null);
    setMediaPlaybackError(null);
  }, [id, mediaPlaybackUrl]);

  useEffect(() => {
    if (activeTab === "transcript") {
      return;
    }

    transcriptAudioRef.current?.pause();
  }, [activeTab]);

  useEffect(() => {
    if (
      activeTab !== "transcript" ||
      activeTranscriptSegmentIndex < 0 ||
      !hasTranscriptPlaybackStarted
    ) {
      return;
    }

    transcriptSegmentRefs.current[activeTranscriptSegmentIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }, [
    activeTab,
    activeTranscriptSegmentIndex,
    hasTranscriptPlaybackStarted,
  ]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggleSomaliNotesAudio = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Your browser does not support text-to-speech playback.");
      return;
    }

    if (isNotesPlaying) {
      window.speechSynthesis.cancel();
      setIsNotesPlaying(false);
      return;
    }

    setIsNotesPlaying(true);

    const rawNotes = `
      Fahamka Guud ahaan.
      ${noteSummary || ""}

      Qodobbada Muhiimka ah.
      ${keyPoints.join(". ")}

      Faahfaahin.
      ${(structuredNotes || "").replace(/[*#`]/g, "")}
    `;

    const utterance = new SpeechSynthesisUtterance(rawNotes);
    utterance.lang = "so-SO";
    utterance.rate = 0.85; // Slow down slightly for better clarity
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();

    // 1. Try to find a premium "Natural" or "Online" Somali voice (usually provided by Microsoft Edge)
    let bestVoice = voices.find(
      (v) => v.lang.startsWith("so") && (v.name.includes("Natural") || v.name.includes("Online"))
    );

    // 2. Fallback to any generic Somali voice (Google Chrome Android, etc)
    if (!bestVoice) {
      bestVoice = voices.find((v) => v.lang.startsWith("so") || v.name.toLowerCase().includes("somali"));
    }

    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    utterance.onend = () => {
      setIsNotesPlaying(false);
    };

    utterance.onerror = () => {
      setIsNotesPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const downloadNotesAsWord = () => {
    if (!window.confirm("Are you sure you want to download the Somali notes as a Word document?")) {
      return;
    }

    const title = lecture?.title || "Somali_Study_Notes";

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; padding: 20px; }
          h1 { text-align: center; color: #2c3e50; font-size: 24pt; margin-bottom: 20px; }
          h2 { color: #2980b9; font-size: 16pt; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
          p, li { font-size: 12pt; margin-bottom: 10px; }
          .container { max-width: 800px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>${title} - Somali Study Notes</h1>

          <h2>Fahamka Guud ahaan (Summary)</h2>
          <p>${noteSummary || "Not available"}</p>

          <h2>Qodobbada Muhiimka ah (Key Points)</h2>
          <ul>
            ${(keyPoints || []).map(pt => `<li>${pt}</li>`).join("")}
          </ul>

          <h2>Faahfaahin (Detailed Notes)</h2>
          <div>
            ${(structuredNotes || "").split('\\n').map(line => {
              line = line.replace(/^### (.*$)/gim, '<h3>$1</h3>');
              line = line.replace(/^## (.*$)/gim, '<h2>$1</h2>');
              line = line.replace(/^\*\*([^*]+)\*\*/gim, '<strong>$1</strong>');
              return `<p>${line}</p>`;
            }).join("")}
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: "application/msword"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_");
    link.download = `${safeTitle}_Somali_Notes.doc`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadNotesAsPdf = async () => {
    if (!window.confirm("Are you sure you want to download the Somali notes as a PDF?")) {
      return;
    }

    const title = lecture?.title || "Somali_Study_Notes";
    const safeTitle = title.replace(/[^a-zA-Z0-9]/g, "_");

    const htmlContent = `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333;">
        <h1 style="text-align: center; color: #2c3e50; font-size: 24px; margin-bottom: 20px;">${title} - Somali Study Notes</h1>

        <h2 style="color: #2980b9; font-size: 18px; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Fahamka Guud ahaan (Summary)</h2>
        <p style="font-size: 14px; margin-bottom: 10px;">${noteSummary || "Not available"}</p>

        <h2 style="color: #2980b9; font-size: 18px; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Qodobbada Muhiimka ah (Key Points)</h2>
        <ul style="padding-left: 20px;">
          ${(keyPoints || []).map(pt => `<li style="font-size: 14px; margin-bottom: 5px;">${pt}</li>`).join("")}
        </ul>

        <h2 style="color: #2980b9; font-size: 18px; margin-top: 20px; border-bottom: 1px solid #eee; padding-bottom: 5px;">Faahfaahin (Detailed Notes)</h2>
        <div>
          ${(structuredNotes || "").split('\n').map(line => {
            line = line.replace(/^### (.*$)/gim, '<h3 style="font-size: 16px; color: #34495e; margin-top: 15px;">$1</h3>');
            line = line.replace(/^## (.*$)/gim, '<h2 style="font-size: 18px; color: #2980b9; margin-top: 20px;">$1</h2>');
            line = line.replace(/^\*\*([^*]+)\*\*/gim, '<strong>$1</strong>');
            return `<p style="font-size: 14px; margin-bottom: 10px;">${line}</p>`;
          }).join("")}
        </div>
      </div>
    `;

    const element = document.createElement("div");
    element.innerHTML = htmlContent;

    try {
      // Dynamically import html2pdf.js only on the client side
      const html2pdf = (await import("html2pdf.js")).default;

      const opt = {
        margin:       0.5,
        filename:     `${safeTitle}_Somali_Notes.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in' as const, format: 'letter' as const, orientation: 'portrait' as const }
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("Failed to generate the PDF file.");
    }
  };

  if (loading) {
    return <p>Loading lecture details...</p>;
  }

  if (loadError) {
    return <div className="alert alert-error">{loadError}</div>;
  }

  if (!lecture) {
    return (
      <div className="alert alert-info">
        Lecture details are not available yet.
      </div>
    );
  }

  const noteSummary =
    lecture.notes?.summary || "Somali notes are not ready yet.";
  const keyPoints = lecture.notes?.key_points || [];
  const structuredNotes =
    lecture.notes?.structured_content || "No generated notes available yet.";
  const analysis = lecture.transcript?.metadata_json?.analysis;
  const genreLabel = analysis?.genre_label || "AI analysis pending";
  const genreExplanation =
    analysis?.genre_explanation ||
    "A more specific genre explanation will appear once AI analysis has been completed for this lecture.";
  const confidenceScore =
    typeof analysis?.confidence_score === "number"
      ? Number(analysis.confidence_score.toFixed(1))
      : null;
  const confidenceLabel = analysis?.confidence_label || "Analysis pending";
  const valuationSummary =
    analysis?.valuation_summary ||
    "The transcript-to-notes confidence evaluation will appear after AI completes its comparison.";
  const lectureStatus = lecture.status.toLowerCase();
  const jobStatus = lecture.job?.status?.toLowerCase() || "";
  const latestErrorLog = logs.find((logEntry) => logEntry.level === "ERROR");
  const failedStageFromLogs = latestErrorLog?.metadata_json?.failed_stage;
  const displayStage =
    lecture.job?.stage?.toLowerCase() === "failed" && failedStageFromLogs
      ? formatStageLabel(failedStageFromLogs)
      : formatStageLabel(lecture.job?.stage || lecture.status);
  const jobErrorMessage = lecture.job?.error_message
    ? humanizeProcessingError(
        lecture.job.error_message,
        failedStageFromLogs || lecture.job?.stage,
      )
    : null;
  const isCancelable =
    lectureStatus === "processing" ||
    jobStatus === "running" ||
    jobStatus === "pending";
  const canRetry = !isCancelable;
  const isCanceled = lectureStatus === "canceled";
  const isLectureComplete = lectureStatus === "completed";
  const pipelineProgressPercent = Math.max(
    0,
    Math.min(100, lecture.job?.progress_percent ?? 0),
  );
  const isPipelineMoving =
    Boolean(lecture.job) &&
    !["completed", "failed", "canceled"].includes(lectureStatus);
  const chatbotAvailable =
    isLectureComplete &&
    (Boolean(lecture.transcript) || Boolean(lecture.notes));
  const suggestedPrompts = [
    "Sharax mowduucan si fudud oo kooban.",
    "I sii 5 su'aalood oo imtixaan ah oo ku saabsan casharkan.",
    "Waa maxay farqiga ugu muhiimsan ee fikradaha casharku sheegay?",
  ];

  const refreshLecture = async () => {
    const { detail, lectureLogs } = await fetchLectureResources(id);
    setLecture(detail);
    setLogs(lectureLogs);
    setLoadError(null);
  };

  const handleRetry = async () => {
    setRetrying(true);
    setActionError(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/lectures/${id}/retry`), {
        method: "POST",
        headers: authHeaders(),
      });

      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Failed to reprocess lecture."),
        );
      }

      await refreshLecture();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to reprocess lecture.",
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = window.confirm(
      "Cancel this lecture processing? You can reprocess it again later.",
    );

    if (!confirmed) {
      return;
    }

    setCanceling(true);
    setActionError(null);
    try {
      const res = await fetch(apiUrl(`/api/v1/lectures/${id}/cancel`), {
        method: "POST",
        headers: authHeaders(),
      });

      if (!res.ok) {
        throw new Error(
          await getErrorMessage(res, "Failed to cancel lecture processing."),
        );
      }

      await refreshLecture();
    } catch (err: unknown) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Failed to cancel lecture processing.",
      );
    } finally {
      setCanceling(false);
    }
  };

  const handleAskChatbot = async () => {
    const trimmedDraft = chatDraft.trim();
    if (!trimmedDraft || chatSending) {
      return;
    }

    setChatSending(true);
    setChatError(null);

    try {
      const response = await fetch(apiUrl(`/api/v1/lectures/${id}/chat/ask`), {
        method: "POST",
        headers: authHeaders({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          message: trimmedDraft,
        }),
      });

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            "Failed to get a response from the lecture chatbot.",
          ),
        );
      }

      const payload = (await response.json()) as LectureChatAskResponse;
      setChatMessages((currentMessages) => [
        ...currentMessages,
        payload.user_message,
        payload.assistant_message,
      ]);
      setChatLoaded(true);
      setChatDraft("");
    } catch (err: unknown) {
      setChatError(
        err instanceof Error
          ? err.message
          : "Failed to get a response from the lecture chatbot.",
      );
    } finally {
      setChatSending(false);
    }
  };

  const handleTranscriptPlayPause = async () => {
    const audio = transcriptAudioRef.current;
    if (!audio || !mediaPlaybackUrl) {
      return;
    }

    if (isTranscriptPlaying) {
      audio.pause();
      return;
    }

    try {
      setMediaPlaybackError(null);
      await audio.play();
    } catch {
      setIsTranscriptPlaying(false);
      setMediaPlaybackError(
        "Could not start the original lecture audio in this browser.",
      );
    }
  };

  const renderFormattedTranscript = (text: string, segments: TranscriptSegment[]) => {
    if (!text) return <p>Transcript is not ready yet.</p>;

    if (segments.length === 0) {
      return <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>{text}</div>;
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
           {segments.map((segment, idx) => {
             const isActiveSegment = idx === activeTranscriptSegmentIndex;

             return (
               <div
                 key={`${segment.startSecond}-${idx}`}
                 ref={(element) => {
                   transcriptSegmentRefs.current[idx] = element;
                 }}
                 aria-current={isActiveSegment ? "true" : undefined}
                 style={{
                   display: "flex",
                   gap: "1.5rem",
                   padding: "1.25rem",
                   background: isActiveSegment
                     ? "rgba(99, 102, 241, 0.08)"
                     : "var(--bg-color)",
                   borderRadius: "12px",
                   border: isActiveSegment
                     ? "2px solid var(--primary-color)"
                     : "2px solid var(--border-color)",
                   boxShadow: isActiveSegment
                     ? "0 0 0 4px rgba(99, 102, 241, 0.14)"
                     : "none",
                   transition:
                     "border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease",
                 }}
                 className="hover:shadow-md"
               >
                   <div style={{ fontWeight: "bold", color: isActiveSegment ? "var(--primary-hover)" : "var(--primary-color)", flexShrink: 0, width: "145px", fontFamily: "monospace", fontSize: "1.05rem", borderRight: "2px solid var(--border-color)", paddingRight: "10px" }}>
                       {segment.timeRange}
                   </div>
                   <div style={{ lineHeight: "1.8", color: "var(--text-color)", flex: 1, fontSize: "1.05rem" }}>
                       {segment.text}
                   </div>
               </div>
             );
           })}
        </div>
    );
  };

  const renderChatComposer = (centered = false) => (
    <div
      style={{
        width: "100%",
        maxWidth: "850px",
        margin: centered ? "0 auto" : "1.5rem auto 0 auto",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {centered && (
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "80px",
              height: "80px",
              borderRadius: "24px",
              background: "linear-gradient(135deg, var(--primary-color), #818cf8)",
              color: "#fff",
              fontSize: "2.2rem",
              fontWeight: 800,
              marginBottom: "1.5rem",
              boxShadow: "0 8px 16px rgba(99, 102, 241, 0.2)",
            }}
          >
            BB
          </div>
          <h2 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: "1rem", letterSpacing: "-0.03em", color: "var(--text-color)" }}>
            How can I help with this lecture?
          </h2>
          <p
            style={{
              margin: "0 auto",
              maxWidth: "52ch",
              color: "var(--text-muted)",
              lineHeight: 1.7,
              fontSize: "1.1rem",
            }}
          >
            Ask me to explain concepts from the transcript, generate Somali notes, or quiz you on the lecture content.
          </p>
        </div>
      )}

      <div
        style={{
          background: "#1e1e1e",
          borderRadius: "24px",
          padding: "1.25rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
          border: "1px solid #333",
        }}
      >
        <textarea
          value={chatDraft}
          onChange={(event) => setChatDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleAskChatbot();
            }
          }}
          placeholder="Ask anything..."
          disabled={!chatbotAvailable || chatSending}
          style={{
            minHeight: centered ? "160px" : "100px",
            maxHeight: "350px",
            width: "100%",
            border: "none",
            padding: "0.5rem 0",
            fontSize: "1.1rem",
            lineHeight: 1.6,
            resize: "none",
            backgroundColor: "transparent",
            color: "#e2e2e2",
            outline: "none",
            fontFamily: "inherit",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "0.5rem",
          }}
        >
          <div style={{ display: "flex", gap: "1.25rem", alignItems: "center", opacity: 0.6 }}>
             <button style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: 0 }} aria-label="Add attachment">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
             </button>

             <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#fff", fontSize: "0.9rem", cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                <span>Fast</span>
             </div>

             <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#fff", fontSize: "0.9rem", cursor: "pointer" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                <span>Gemma 2B</span>
             </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
             <button style={{ background: "none", border: "none", color: "#fff", opacity: 0.6, cursor: "pointer" }} aria-label="Voice input">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
             </button>

             <button
                type="button"
                onClick={() => void handleAskChatbot()}
                disabled={!chatbotAvailable || chatSending || !chatDraft.trim()}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: !chatDraft.trim() ? "#444" : "#0084ff",
                  color: "#fff",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: (!chatDraft.trim() || chatSending) ? "default" : "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {chatSending ? (
                   <span style={{ fontSize: "0.7rem" }}>...</span>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                )}
              </button>
          </div>
        </div>
      </div>

      {!centered && (
        <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", textAlign: "center", marginTop: "0.85rem", opacity: 0.6 }}>
          AI-generated Somali notes can occasionally include inaccuracies.
        </p>
      )}
    </div>
  );



  return (
    <div>
      <style>{`
        .lecture-progress-fill {
          position: relative;
          overflow: hidden;
          transition: width 0.35s ease, background-color 0.25s ease;
        }

        .lecture-progress-fill.is-moving::after {
          content: "";
          position: absolute;
          inset: 0;
          width: 45%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.58),
            transparent
          );
          animation: lecture-progress-sweep 1.25s ease-in-out infinite;
        }

        @keyframes lecture-progress-sweep {
          from {
            transform: translateX(-130%);
          }
          to {
            transform: translateX(260%);
          }
        }
      `}</style>
      <div style={{ marginBottom: "2rem" }}>
        <h1>{lecture.title}</h1>
        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginTop: "0.5rem",
            opacity: 0.8,
            flexWrap: "wrap",
          }}
        >
          <span>
            Status:{" "}
            <strong style={{ color: getAccentColor(lecture.status) }}>
              {lecture.status}
            </strong>
          </span>
          <span>|</span>
          <span>Lecture ID: {lecture.id}</span>
          <span>|</span>
          <span>Submitted: {formatDate(lecture.created_at)}</span>
        </div>

        {isCancelable ? (
          <div style={{ marginTop: "1.5rem" }}>
            <button
              type="button"
              onClick={handleCancel}
              disabled={canceling || retrying}
              style={{
                backgroundColor: "var(--danger-color)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                padding: "0.75rem 1.2rem",
                fontWeight: 700,
                cursor: canceling || retrying ? "not-allowed" : "pointer",
                opacity: canceling || retrying ? 0.7 : 1,
              }}
            >
              {canceling ? "Canceling..." : "Cancel Processing"}
            </button>
          </div>
        ) : canRetry ? (
          <div style={{ marginTop: "1.5rem" }}>
            <button
              type="button"
              className="btn-outline"
              onClick={handleRetry}
              disabled={retrying || canceling}
            >
              {retrying ? "Reprocessing..." : "Reprocess Lecture"}
            </button>
          </div>
        ) : null}

        {actionError && (
          <div className="alert alert-error" style={{ marginTop: "1rem" }}>
            {actionError}
          </div>
        )}

        {isCanceled && !actionError && (
          <div className="alert alert-info" style={{ marginTop: "1rem" }}>
            Processing was canceled. You can reprocess this lecture whenever you
            want.
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          padding: "0.5rem",
          backgroundColor: "var(--bg-color)",
          border: "1px solid var(--border-color)",
          borderRadius: "12px",
          marginBottom: "2.5rem",
          flexWrap: "wrap",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: "1 1 0px",
              minWidth: "120px",
              background: activeTab === tab ? "var(--primary-color)" : "transparent",
              border: "none",
              padding: "0.85rem 1.5rem",
              borderRadius: "8px",
              cursor: "pointer",
              color: activeTab === tab ? "white" : "inherit",
              fontWeight: activeTab === tab ? "bold" : "600",
              textTransform: "capitalize",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              textAlign: "center",
            }}
          >
            {tab.replace("-", " ")}
          </button>
        ))}
      </div>

      <div className="card">
        {activeTab === "overview" && (
          <div>
            <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>Lecture Overview</h2>
            <p style={{ marginTop: "0.5rem", color: "var(--text-muted)" }}>
              Detailed metrics and AI metadata extracted during processing.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.5rem", marginTop: "2rem" }}>
               <div style={{ background: "var(--bg-color)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--border-color)", borderLeft: "4px solid #38bdf8" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: "bold", letterSpacing: "1px" }}>Source Details</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: "bold", textTransform: "capitalize" }}>{lecture.source_type}</div>
                  <div style={{ color: "var(--primary-color)", marginTop: "0.5rem", wordBreak: "break-all", fontSize: "0.95rem" }}>
                     {lecture.source_url ? <a href={lecture.source_url} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>View Original Source</a> : "Uploaded File Asset"}
                  </div>
               </div>

               <div style={{ background: "var(--bg-color)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--border-color)", borderLeft: "4px solid #8b5cf6" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: "bold", letterSpacing: "1px" }}>Detected Genre</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: "#8b5cf6" }}>{genreLabel}</div>
                  <div style={{ color: "var(--text-muted)", marginTop: "0.65rem", fontSize: "0.92rem", lineHeight: 1.65 }}>
                    {genreExplanation}
                  </div>
               </div>

               <div style={{ background: "var(--bg-color)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--border-color)", borderLeft: "4px solid var(--success-color)" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: "bold", letterSpacing: "1px" }}>AI Valuation & Accuracy</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: getConfidenceColor(confidenceScore ?? undefined) }}>
                     {confidenceScore !== null ? `${confidenceScore}% ${confidenceLabel}` : "Calculating..."}
                  </div>
                  <div style={{ color: "var(--text-muted)", marginTop: "0.65rem", fontSize: "0.92rem", lineHeight: 1.65 }}>
                    {valuationSummary}
                  </div>
               </div>

               <div style={{ background: "var(--bg-color)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--border-color)", borderLeft: "4px solid #f59e0b" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: "bold", letterSpacing: "1px" }}>Duration & Length</div>
                  <div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{formatDuration(lecture.media_asset?.duration_seconds)}</div>
                  <div style={{ color: "var(--text-muted)", marginTop: "0.5rem", fontSize: "0.9rem" }}>Identified media playtime</div>
               </div>

               <div style={{ background: "var(--bg-color)", padding: "1.5rem", borderRadius: "12px", border: "1px solid var(--border-color)", borderLeft: `4px solid ${getAccentColor(lecture.status)}` }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "0.5rem", textTransform: "uppercase", fontWeight: "bold", letterSpacing: "1px" }}>Processing Status</div>
                  <div style={{ fontSize: "1.3rem", fontWeight: "bold", color: getAccentColor(lecture.status), textTransform: "capitalize" }}>{displayStage}</div>
                  <div style={{ color: "var(--text-muted)", marginTop: "0.5rem", fontSize: "0.9rem" }}>{pipelineProgressPercent}% Pipeline Progress</div>
               </div>
            </div>

            {lecture.job && (
              <div
                style={{
                  marginTop: "2.5rem",
                  background: "var(--border-color)",
                  height: "14px",
                  borderRadius: "999px",
                  overflow: "hidden",
                }}
              >
                <div
                  className={`lecture-progress-fill${isPipelineMoving ? " is-moving" : ""}`}
                  style={{
                    width: `${pipelineProgressPercent}%`,
                    height: "100%",
                    background: getAccentColor(lecture.status),
                  }}
                />
              </div>
            )}

            {jobErrorMessage && (
              <div
                className={lectureStatus === "canceled" ? "alert alert-info" : "alert alert-error"}
                style={{ marginTop: "1rem" }}
              >
                {jobErrorMessage}
              </div>
            )}
          </div>
        )}

        {activeTab === "transcript" && (
          <div>
            {isLectureComplete && mediaPlaybackUrl && (
              <audio
                ref={transcriptAudioRef}
                src={mediaPlaybackUrl}
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const duration = event.currentTarget.duration;
                  if (Number.isFinite(duration) && duration > 0) {
                    setAudioDurationSeconds(duration);
                  }
                }}
                onPlay={() => {
                  setIsTranscriptPlaying(true);
                  setHasTranscriptPlaybackStarted(true);
                }}
                onPause={() => {
                  setIsTranscriptPlaying(false);
                }}
                onEnded={() => {
                  setIsTranscriptPlaying(false);
                  setHasTranscriptPlaybackStarted(false);
                }}
                onTimeUpdate={(event) => {
                  setCurrentTranscriptTime(event.currentTarget.currentTime);
                }}
                onError={(e) => {
                  setIsTranscriptPlaying(false);
                  const audioError = e.currentTarget.error;
                  setMediaPlaybackError(
                    `Original lecture audio could not be loaded for playback. (Error Code: ${audioError?.code || 'Unknown'}, Message: ${audioError?.message || 'None'})`,
                  );
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "flex-start",
                flexWrap: "wrap",
                marginBottom: "1.5rem",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>
                  English Transcript
                </h2>
                <p
                  style={{
                    marginTop: "0.5rem",
                    color: "var(--text-muted)",
                  }}
                >
                  Source audio matched to the current transcript segment.
                </p>
              </div>

              {isLectureComplete && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.85rem",
                    background: "var(--bg-color)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    padding: "0.85rem 1rem",
                    minWidth: "280px",
                    maxWidth: "100%",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => void handleTranscriptPlayPause()}
                    disabled={!mediaPlaybackUrl}
                    aria-label={
                      isTranscriptPlaying
                        ? "Pause transcript audio"
                        : "Play transcript audio"
                    }
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "999px",
                      border: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: mediaPlaybackUrl
                        ? "var(--primary-color)"
                        : "var(--border-color)",
                      color: mediaPlaybackUrl ? "#fff" : "var(--text-muted)",
                      cursor: mediaPlaybackUrl ? "pointer" : "not-allowed",
                      flexShrink: 0,
                    }}
                  >
                    {isTranscriptPlaying ? <FaPause /> : <FaPlay />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "0.75rem",
                        fontSize: "0.88rem",
                        color: "var(--text-muted)",
                        marginBottom: "0.45rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>{isTranscriptPlaying ? "Playing" : "Paused"}</span>
                      <span>
                        {formatTranscriptTimestamp(currentTranscriptTime)} /{" "}
                        {formatTranscriptTimestamp(displayAudioDuration)}
                      </span>
                    </div>
                    <div
                      style={{
                        height: "6px",
                        borderRadius: "999px",
                        background: "var(--border-color)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${playbackProgressPercent}%`,
                          height: "100%",
                          background: "var(--primary-color)",
                          transition: "width 0.15s linear",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            {isLectureComplete && (mediaUnavailableMessage || mediaPlaybackError) && (
              <div className="alert alert-info">
                {mediaPlaybackError || mediaUnavailableMessage}
              </div>
            )}
            <div
              style={{
                borderRadius: "8px",
                maxHeight: "650px",
                overflowY: "auto",
                paddingRight: "10px"
              }}
            >
              {renderFormattedTranscript(transcriptText, transcriptSegments)}
            </div>
          </div>
        )}

        {activeTab === "somali-notes" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <h2 style={{ fontSize: "1.8rem", margin: 0 }}>
                Somali Study Notes
              </h2>
              {isLectureComplete && (
              <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={toggleSomaliNotesAudio}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 1rem",
                  backgroundColor: isNotesPlaying ? "var(--danger-color)" : "var(--primary-color)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  transition: "background-color 0.2s",
                }}
              >
                {isNotesPlaying ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="6" y="4" width="4" height="16"></rect>
                      <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                    Stop Reading
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    Listen to Notes
                  </>
                )}
              </button>

              <button
                onClick={downloadNotesAsWord}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 1rem",
                  backgroundColor: "#2b579a", // Word Blue
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  transition: "opacity 0.2s",
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = "0.85"}
                onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                Word
              </button>

              <button
                onClick={downloadNotesAsPdf}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 1rem",
                  backgroundColor: "#df2a2a", // PDF Red
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  transition: "opacity 0.2s",
                }}
                onMouseOver={(e) => e.currentTarget.style.opacity = "0.85"}
                onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                PDF
              </button>
              </div>
              )}
            </div>
            <div
              style={{
                padding: "1.75rem",
                backgroundColor: "var(--bg-color)",
                borderRadius: "14px",
                borderLeft: "4px solid var(--primary-color)",
                marginTop: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.75rem",
              }}
            >
              <section>
                <h3 style={{ marginBottom: "0.75rem", fontSize: "1.15rem" }}>
                  Fahamka Guud ahaan (Summary)
                </h3>
                <div style={{ lineHeight: 1.85 }}>
                  {renderInlineFormattedText(noteSummary)}
                </div>
              </section>

              <section>
                <h3 style={{ marginBottom: "0.75rem", fontSize: "1.15rem" }}>
                  Qodobbada Muhiimka ah (Key Points)
                </h3>
                {keyPoints.length > 0 ? (
                  <ul
                    style={{
                      paddingLeft: "1.4rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                      margin: 0,
                    }}
                  >
                    {keyPoints.map((point, index) => (
                      <li key={`${point}-${index}`} style={{ lineHeight: 1.8 }}>
                        {renderInlineFormattedText(point)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ margin: 0, lineHeight: 1.8 }}>
                    Key points are not available yet.
                  </p>
                )}
              </section>

              <section>
                <h3 style={{ marginBottom: "0.75rem", fontSize: "1.15rem" }}>
                  Detailed Notes
                </h3>
                <div style={{ marginTop: "0.75rem" }}>
                  {renderStructuredNotes(structuredNotes)}
                </div>
              </section>
            </div>
          </div>
        )}

        {activeTab === "chatbot" && (
          <div style={{ display: "flex", flexDirection: "column", minHeight: "650px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
                alignItems: "center",
                marginBottom: "2rem",
                paddingBottom: "1rem",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <div>
                <h2 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.01em" }}>
                  Somali Study Coach
                </h2>
              </div>
              {chatMessages.length > 0 && (
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary-color)",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: "0.95rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem"
                  }}
                  onClick={() => {
                    setChatMessages([]);
                    setChatLoaded(false);
                    setChatError(null);
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path></svg>
                  New Conversation
                </button>
              )}
            </div>

            {!chatbotAvailable ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "1.5rem",
                  padding: "4rem 2rem",
                  textAlign: "center"
                }}
              >
                <div style={{ fontSize: "3rem" }}>⏳</div>
                <div style={{ maxWidth: "400px" }}>
                  <h3 style={{ marginBottom: "0.5rem" }}>Coach is getting ready...</h3>
                  <p style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                    The lecture chatbot becomes available after the transcript
                    and study notes have been fully processed.
                  </p>
                </div>
              </div>
            ) : (chatMessages.length === 0) ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  padding: "2rem 0",
                }}
              >
                {renderChatComposer(true)}
                {chatLoading && (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "1rem", opacity: 0.6 }}>
                    Checking for previous conversations...
                  </p>
                )}
              </div>
            ) : (


              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "1.5rem",
                    maxHeight: "500px",
                    minHeight: "400px",
                    overflowY: "auto",
                    paddingRight: "1rem",
                    marginBottom: "2rem",
                  }}
                >
                  {chatMessages.map((message) => {
                    const isUser = message.role.toLowerCase() === "user";

                    return (
                      <div
                        key={message.id}
                        style={{
                          display: "flex",
                          justifyContent: isUser ? "flex-end" : "flex-start",
                          width: "100%",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "85%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: isUser ? "flex-end" : "flex-start",
                          }}
                        >
                          <div
                            style={{
                              padding: "1rem 1.25rem",
                              borderRadius: isUser
                                ? "24px 24px 4px 24px"
                                : "24px 24px 24px 4px",
                              backgroundColor: isUser
                                ? "var(--primary-color)"
                                : "var(--secondary-bg)",
                              color: isUser ? "white" : "var(--text-color)",
                              border: isUser ? "none" : "1px solid var(--border-color)",
                              boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                              lineHeight: 1.7,
                              fontSize: "1.05rem",
                            }}
                          >
                            <div style={{ whiteSpace: "pre-wrap" }}>
                              {message.content}
                            </div>
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem", padding: "0 0.5rem" }}>
                            {isUser ? "Hadda" : "Coach"} • {formatDate(message.created_at).split(',')[1]?.trim() || "Just now"}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {chatSending && (
                    <div style={{ display: "flex", justifyContent: "flex-start" }}>
                      <div
                        style={{
                          padding: "1.25rem",
                          borderRadius: "24px 24px 24px 4px",
                          backgroundColor: "var(--secondary-bg)",
                          border: "1px solid var(--border-color)",
                          display: "flex",
                          gap: "0.5rem",
                          alignItems: "center"
                        }}
                      >
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginLeft: "0.5rem" }}>Designing a response...</span>
                      </div>
                    </div>
                  )}


                  <div ref={chatEndRef} />
                </div>

                <div
                  style={{
                    position: "sticky",
                    bottom: 0,
                    backgroundColor: "var(--secondary-bg)",
                    padding: "1rem 0",
                    borderTop: "1px solid var(--border-color)",
                    margin: "0 -1.5rem -1.5rem -1.5rem",
                    paddingBottom: "1.5rem"
                  }}
                >
                  <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 1.5rem" }}>
                    {renderChatComposer(false)}
                  </div>
                </div>
              </div>
            )}

            {chatError && (
              <div className="alert alert-error" style={{ marginTop: "1rem" }}>
                {chatError}
              </div>
            )}
          </div>
        )}


        {activeTab === "processing-log" && (
          <div>
            <h2>Processing Timeline</h2>
            <ul style={{ listStyle: "none", padding: 0, marginTop: "1rem" }}>
              {logs.length > 0 ? logs.map((logEntry) => {
                const logMessage =
                  logEntry.level === "ERROR"
                    ? humanizeProcessingError(
                        logEntry.message,
                        logEntry.metadata_json?.failed_stage,
                      )
                    : logEntry.message;

                return (
                  <li
                    key={logEntry.id}
                    style={{
                      padding: "0.75rem 0",
                      borderBottom: "1px solid var(--border-color)",
                      display: "flex",
                      gap: "1rem",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ display: "flex", gap: "1rem" }}>
                      <span style={{ color: getAccentColor(logEntry.level) }}>
                        {logEntry.level}
                      </span>
                      <span style={{ fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                        {logMessage}
                      </span>
                    </div>
                    <span style={{ opacity: 0.7, whiteSpace: "nowrap" }}>
                      {formatDate(logEntry.created_at)}
                    </span>
                  </li>
                );
              }) : (
                <li style={{ padding: "0.75rem 0" }}>
                  No processing logs yet.
                </li>
              )}
            </ul>

            <div style={{ marginTop: "1rem", opacity: 0.8 }}>
              <p>Started: {formatDate(lecture.job?.started_at)}</p>
              <p>Completed: {formatDate(lecture.job?.completed_at)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
