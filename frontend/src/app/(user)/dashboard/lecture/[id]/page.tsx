"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { FaArrowUp, FaPause, FaPlay } from "react-icons/fa";
import {
  CONNECTION_QUALITY_META,
  type ConnectionQualitySnapshot,
  useConnectionQuality,
} from "@/hooks/useConnectionQuality";
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
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      await getErrorMessage(response, "Failed to load lecture chatbot history."),
    );
  }

  return (await response.json()) as LectureChatMessage[];
}

function getFriendlyErrorMessage(rawMessage: string): string {
  const msg = rawMessage || "";
  
  // 1. Check for 503 / UNAVAILABLE / High Demand
  if (
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("experiencing high demand")
  ) {
    return "The AI tutor is currently busy handling a high volume of student requests. Please wait a few moments and try asking your question again.\n\n" +
           "Macallinka AI-ga wuxuu hadda ku mashquulsan yahay tiro aad u badan oo su'aalo ah. Fadlan cabbaar sug oo dib u tijaabi su'aashaada.";
  }
  
  // 2. Check for 429 / Rate Limit
  if (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("rate limit")
  ) {
    return "The AI tutor is temporarily resting due to high traffic limits. Please take a short 1-minute break and try again.\n\n" +
           "Macallinka AI-ga wuxuu si ku-meel-gaar ah u qaadanayaa nasasho sababo la xiriira culayska su'aalaha. Fadlan sug 1 daqiiqo oo dib u tijaabi.";
  }
  
  // 3. Check for 400 / Invalid Argument / Context Limit
  if (
    msg.includes("400") ||
    msg.includes("INVALID_ARGUMENT") ||
    msg.includes("too large")
  ) {
    return "This lecture transcript or conversation is too long for the tutor to digest at once. Please try asking about a specific part of the lecture.\n\n" +
           "Qoraalka casharkaan ama sheekadaan ayaa aad u dheer oo uusan macallinku hal mar wada fahmi karin. Fadlan isku day inaad weydo su'aal gaar ah.";
  }
  
  // 4. Check for API Credentials / Permission Denied
  if (
    msg.includes("401") ||
    msg.includes("403") ||
    msg.includes("UNAUTHENTICATED") ||
    msg.includes("PERMISSION_DENIED") ||
    msg.includes("GEMINI_API_KEY")
  ) {
    return "There is an AI configuration issue on the server. Please contact support or check if the API key is valid.\n\n" +
           "Waxaa jira cilad habayneed dhinaca AI-ga ee server-ka. Fadlan la xiriir maamulaha si loo hubiyo furaha API-ga.";
  }
  
  // 5. Check for Server Offline / Network Error
  if (
    msg.toLowerCase().includes("failed to fetch") ||
    msg.toLowerCase().includes("network error") ||
    msg.toLowerCase().includes("connection")
  ) {
    return "Unable to connect to the server. Please check your internet connection or verify if the backend service is running.\n\n" +
           "Kuma xirmi karno server-ka dambe. Fadlan hubi khadkaaga internet-ka ama inuu server-ku shaqaynayo.";
  }
  
  // Fallback
  return rawMessage;
}

function getChatMessageTimestamp(message: LectureChatMessage): number {
  const timestamp = new Date(message.created_at).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function mergeLectureChatMessages(
  currentMessages: LectureChatMessage[],
  nextMessages: LectureChatMessage[],
): LectureChatMessage[] {
  const messagesById = new Map<number, LectureChatMessage>();

  currentMessages.forEach((message) => messagesById.set(message.id, message));
  nextMessages.forEach((message) => messagesById.set(message.id, message));

  return Array.from(messagesById.values()).sort((left, right) => {
    const timestampDifference =
      getChatMessageTimestamp(left) - getChatMessageTimestamp(right);

    return timestampDifference || left.id - right.id;
  });
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

function renderChatMessageContent(text: string): React.ReactNode {
  const lines = text.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    elements.push(
      <ul
        key={`chat-list-${elements.length}`}
        className="lecture-chat-markdown-list"
      >
        {listItems.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineFormattedText(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushList();
      return;
    }

    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      elements.push(
        <strong
          key={`chat-heading-${elements.length}`}
          className="lecture-chat-markdown-heading"
        >
          {renderInlineFormattedText(headingMatch[2].trim())}
        </strong>,
      );
      return;
    }

    const bulletMatch = trimmedLine.match(/^[-*•]\s+(.*)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1].trim());
      return;
    }

    flushList();
    elements.push(
      <p key={`chat-paragraph-${elements.length}`} className="lecture-chat-markdown-paragraph">
        {renderInlineFormattedText(trimmedLine)}
      </p>,
    );
  });

  flushList();

  return (
    <div className="lecture-chat-markdown">
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

function isSlowConnectionLevel(
  level: ConnectionQualitySnapshot["level"],
): boolean {
  return level === "slow" || level === "poor";
}

function ConnectionQualityIndicator({
  quality,
}: {
  quality: ConnectionQualitySnapshot;
}) {
  const meta = quality.level
    ? CONNECTION_QUALITY_META[quality.level]
    : {
        label: "Checking",
        color: "#64748b",
        dotClassName: "bg-slate-400",
        barClassName: "bg-slate-400",
        textClassName: "text-slate-500",
      };
  const latencyLabel =
    typeof quality.latencyMs === "number"
      ? `${Math.round(quality.latencyMs)}ms`
      : "Measuring";

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-semibold shadow-sm"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.45rem",
        border: "1px solid var(--border-color)",
        borderRadius: "999px",
        background: "var(--bg-color)",
        padding: "0.25rem 0.6rem",
        fontSize: "0.75rem",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden="true"
        className={`h-2 w-2 rounded-full ${meta.dotClassName}`}
        style={{
          width: "0.5rem",
          height: "0.5rem",
          borderRadius: "999px",
          backgroundColor: meta.color,
          flexShrink: 0,
        }}
      />
      <span style={{ opacity: 0.72 }}>Connection</span>
      <span className={meta.textClassName} style={{ color: meta.color }}>
        {meta.label}
      </span>
      <span
        aria-hidden="true"
        className={`h-1 w-7 rounded-full ${meta.barClassName}`}
        style={{
          width: "1.75rem",
          height: "0.25rem",
          borderRadius: "999px",
          backgroundColor: meta.color,
          opacity: quality.level ? 1 : 0.5,
        }}
      />
      <span style={{ opacity: 0.55 }}>{latencyLabel}</span>
    </div>
  );
}

function SlowConnectionToast({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-50 flex max-w-sm items-start gap-3 rounded-lg border border-orange-200 bg-white p-4 text-sm shadow-lg"
      style={{
        position: "fixed",
        right: "1.25rem",
        bottom: "1.25rem",
        zIndex: 50,
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        maxWidth: "24rem",
        border: "1px solid #fed7aa",
        borderRadius: "0.75rem",
        background: "var(--bg-color)",
        color: "var(--text-color)",
        padding: "1rem",
        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.22)",
      }}
    >
      <span
        aria-hidden="true"
        className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-500"
        style={{
          width: "0.65rem",
          height: "0.65rem",
          marginTop: "0.25rem",
          borderRadius: "999px",
          backgroundColor: "#f97316",
          flexShrink: 0,
        }}
      />
      <p style={{ margin: 0, lineHeight: 1.45 }}>
        Your internet connection is slow. This may affect how long your lecture
        takes to process. The app is still working.
      </p>
      <button
        type="button"
        aria-label="Dismiss slow connection alert"
        className="ml-1 rounded p-1 text-slate-500 hover:bg-slate-100"
        onClick={onClose}
        style={{
          marginLeft: "0.25rem",
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        X
      </button>
    </div>
  );
}

export default function LectureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldStickToChatBottomRef = useRef(true);
  const transcriptAudioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptScrollContainerRef = useRef<HTMLDivElement | null>(null);
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
  const [pendingChatQuestion, setPendingChatQuestion] = useState<string | null>(
    null,
  );
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
  const [showSlowConnectionToast, setShowSlowConnectionToast] =
    useState(false);
  const [hasShownSlowConnectionToast, setHasShownSlowConnectionToast] =
    useState(false);
  const isProcessingLecture =
    lecture?.status?.toLowerCase() === "processing";
  const connectionQuality = useConnectionQuality({
    enabled: isProcessingLecture,
  });

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
  const canLoadLectureChat =
    lecture?.id === Number(id) &&
    lecture?.status?.toLowerCase() === "completed" &&
    (Boolean(lecture.transcript) || Boolean(lecture.notes));

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
    const status = lecture?.status?.toLowerCase();
    const isTerminal = ["completed", "failed", "canceled"].includes(status || "");
    if (!status || isTerminal) return;

    let isActive = true;

    const refreshPollingLecture = async () => {
      try {
        const { detail, lectureLogs } = await fetchLectureResources(id);
        if (!isActive) return;

        setLecture(detail);
        setLogs(lectureLogs);
        setLoadError(null);
      } catch (err: unknown) {
        if (!isActive) return;

        setLoadError(
          err instanceof Error ? err.message : "Failed to load lecture details.",
        );
      }
    };

    const interval = window.setInterval(() => {
      void refreshPollingLecture();
    }, 3000);

    return () => {
      isActive = false;
      window.clearInterval(interval);
    };
  }, [id, lecture?.status]);

  useEffect(() => {
    setShowSlowConnectionToast(false);
    setHasShownSlowConnectionToast(false);
  }, [id]);

  useEffect(() => {
    if (isProcessingLecture) {
      return;
    }

    setShowSlowConnectionToast(false);
    setHasShownSlowConnectionToast(false);
  }, [isProcessingLecture]);

  useEffect(() => {
    if (
      !isProcessingLecture ||
      hasShownSlowConnectionToast ||
      !isSlowConnectionLevel(connectionQuality.level)
    ) {
      return;
    }

    setShowSlowConnectionToast(true);
    setHasShownSlowConnectionToast(true);
  }, [
    connectionQuality.level,
    hasShownSlowConnectionToast,
    isProcessingLecture,
  ]);

  useEffect(() => {
    if (!showSlowConnectionToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setShowSlowConnectionToast(false);
    }, 8000);

    return () => window.clearTimeout(timeoutId);
  }, [showSlowConnectionToast]);

  useEffect(() => {
    setChatMessages([]);
    setChatLoaded(false);
    setChatLoading(false);
    setChatError(null);
    setChatDraft("");
    setChatSending(false);
    setPendingChatQuestion(null);
  }, [id]);

  useEffect(() => {
    if (!canLoadLectureChat || chatLoaded || chatLoading) {
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

        setChatMessages((currentMessages) =>
          mergeLectureChatMessages(currentMessages, messages),
        );
        setChatError(null);
        setChatLoaded(true);
      } catch (err: any) {
        if (!isActive) {
          return;
        }

        setChatError(
          err instanceof Error ? err.message : String(err),
        );
        setChatLoaded(true);
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
  }, [canLoadLectureChat, chatLoaded, chatLoading, id]);

  useEffect(() => {
    if (activeTab !== "chatbot") {
      return;
    }

    if (!shouldStickToChatBottomRef.current) {
      return;
    }

    window.requestAnimationFrame(() => {
      chatEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    });
  }, [
    activeTab,
    chatError,
    chatMessages,
    chatSending,
    pendingChatQuestion,
  ]);

  useEffect(() => {
    const textarea = chatTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const lineHeight = Number.parseFloat(
      window.getComputedStyle(textarea).lineHeight,
    ) || 24;
    const maxHeight = lineHeight * 5 + 20;
    const nextHeight = Math.min(textarea.scrollHeight, maxHeight);

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [chatDraft]);

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

    const container = transcriptScrollContainerRef.current;
    const activeSegment =
      transcriptSegmentRefs.current[activeTranscriptSegmentIndex];

    if (!container || !activeSegment) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const activeSegmentRect = activeSegment.getBoundingClientRect();
    const activeSegmentTop =
      activeSegmentRect.top - containerRect.top + container.scrollTop;
    const centeredScrollTop =
      activeSegmentTop - (container.clientHeight - activeSegmentRect.height) / 2;
    const topAlignedScrollTop = activeSegmentTop - 16;
    const maxScrollTop = container.scrollHeight - container.clientHeight;
    const nextScrollTop = Math.min(
      Math.max(
        activeSegmentRect.height > container.clientHeight
          ? topAlignedScrollTop
          : centeredScrollTop,
        0,
      ),
      Math.max(maxScrollTop, 0),
    );

    container.scrollTo({
      top: nextScrollTop,
      behavior: "smooth",
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
    setPendingChatQuestion(trimmedDraft);
    setChatError(null);
    setChatDraft("");

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
      setChatMessages((currentMessages) =>
        mergeLectureChatMessages(currentMessages, [
          payload.user_message,
          payload.assistant_message,
        ]),
      );
      setChatLoaded(true);
    } catch (err: any) {
      setChatError(
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setPendingChatQuestion(null);
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

  const handleChatScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const distanceFromBottom =
      target.scrollHeight - target.scrollTop - target.clientHeight;

    shouldStickToChatBottomRef.current = distanceFromBottom < 80;
  };

  const handleChatDraftChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setChatDraft(event.target.value);
  };

  const handleChatKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (chatDraft.trim() && chatbotAvailable && !chatSending) {
      void handleAskChatbot();
    }
  };

  const renderChatBubble = ({
    label,
    content,
    role,
    variant = "default",
  }: {
    label: "You" | "Assistant";
    content: React.ReactNode;
    role: "user" | "assistant";
    variant?: "default" | "error";
  }) => {
    const isUser = role === "user";
    const rowClassName = isUser
      ? "lecture-chat-row lecture-chat-row-user"
      : "lecture-chat-row lecture-chat-row-assistant";
    const groupClassName = isUser
      ? "lecture-chat-group lecture-chat-group-user"
      : "lecture-chat-group lecture-chat-group-assistant";
    const bubbleClassName = [
      "lecture-chat-bubble",
      isUser ? "lecture-chat-bubble-user" : "lecture-chat-bubble-assistant",
      variant === "error" ? "lecture-chat-bubble-error" : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={rowClassName}>
        <div className={groupClassName}>
          <span className="lecture-chat-label">{label}</span>
          <div className={bubbleClassName}>{content}</div>
        </div>
      </div>
    );
  };

  const renderWelcomeBubble = () =>
    renderChatBubble({
      label: "Assistant",
      role: "assistant",
      content: (
        <div className="lecture-chat-markdown">
          <p className="lecture-chat-markdown-paragraph">
            Salaan! Waxaan kaa caawin karaa su&apos;aalaha ku saabsan
            muhadaran. Weydii wax kasta oo ku saabsan qoraalka ama
            xusuus-qorka Soomaaliga.
          </p>
          <p className="lecture-chat-markdown-paragraph lecture-chat-note">
            Note: This chat is not saved and may occasionally make mistakes.
          </p>
        </div>
      ),
    });

  const renderTypingIndicator = () =>
    renderChatBubble({
      label: "Assistant",
      role: "assistant",
      content: (
        <div className="lecture-chat-typing" aria-label="Assistant is typing">
          <span />
          <span />
          <span />
        </div>
      ),
    });

  const renderChatComposer = () => {
    const sendDisabled =
      !chatbotAvailable || chatSending || chatDraft.trim().length === 0;

    return (
      <div className="lecture-chat-composer-shell">
        <div className="lecture-chat-input-box">
          <textarea
            ref={chatTextareaRef}
            value={chatDraft}
            onChange={handleChatDraftChange}
            onKeyDown={handleChatKeyDown}
            rows={1}
            placeholder="Ask anything about this lecture..."
            disabled={!chatbotAvailable || chatSending}
            className="lecture-chat-textarea"
          />
          <button
            type="button"
            aria-label="Send chat message"
            className="lecture-chat-send-button"
            disabled={sendDisabled}
            onClick={() => void handleAskChatbot()}
          >
            <FaArrowUp aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  };



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

        .chatbot-container {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 350px);
          min-height: 550px;
          overflow: hidden;
          background: var(--secondary-bg);
          border-radius: 12px;
          border: 1px solid var(--border-color);
          box-shadow: var(--card-shadow);
          position: relative;
        }

        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding-top: 1.5rem;
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
        }

        .input-bar {
          flex-shrink: 0;
          width: 100%;
          border-top: 1px solid var(--border-color);
          background: var(--bg-color);
          padding: 1.25rem 0;
          box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.03);
        }

        .content-column {
          max-width: 48rem; /* 768px */
          margin: 0 auto;
          padding: 0 1.5rem;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.35rem;
        }

        .messages-area .content-column {
          padding-bottom: 80px; /* calculated bottom padding */
        }

        .lecture-chat-textarea::-webkit-scrollbar {
          width: 7px;
        }

        .lecture-chat-textarea::-webkit-scrollbar-track {
          background: transparent;
        }

        .lecture-chat-textarea::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.35);
          border-radius: 999px;
        }

        .lecture-chat-row {
          display: flex;
          width: 100%;
          animation: lecture-chat-fade-in 0.22s ease-out;
        }

        .lecture-chat-row-user {
          justify-content: flex-end;
        }

        .lecture-chat-row-assistant {
          justify-content: flex-start;
        }

        .lecture-chat-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          width: 100%;
        }

        .lecture-chat-group-user {
          align-items: flex-end;
          max-width: 80%;
          margin-left: auto;
        }

        .lecture-chat-group-assistant {
          align-items: flex-start;
          max-width: 100%;
        }

        .lecture-chat-label {
          padding: 0 0.35rem;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--text-muted, #64748b);
          opacity: 0.72;
        }

        .lecture-chat-group-assistant .lecture-chat-label {
          padding: 0;
        }

        .lecture-chat-group-user .lecture-chat-label {
          text-align: right;
          width: 100%;
        }

        .lecture-chat-bubble {
          max-width: 100%;
          padding: 0.85rem 1rem;
          border-radius: 18px;
          line-height: 1.7;
          font-size: 0.98rem;
          word-break: break-word;
          transition:
            background-color 0.2s ease,
            border-color 0.2s ease,
            transform 0.2s ease;
        }

        .lecture-chat-bubble-user {
          color: #fff;
          background: linear-gradient(135deg, var(--primary-color), #7c3aed);
          border-bottom-right-radius: 6px;
          box-shadow: 0 12px 28px rgba(99, 102, 241, 0.24);
        }

        .lecture-chat-bubble-assistant {
          color: var(--text-color);
          background: transparent;
          border: none;
          padding: 0;
          box-shadow: none;
          border-radius: 0;
        }

        .lecture-chat-bubble-error {
          color: #dc2626;
          background: rgba(239, 68, 68, 0.1) !important;
          border: 1px solid rgba(239, 68, 68, 0.3) !important;
          padding: 0.85rem 1rem !important;
          border-radius: 12px !important;
        }

        .lecture-chat-user-text {
          white-space: pre-wrap;
        }

        .lecture-chat-markdown {
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
        }

        .lecture-chat-markdown-paragraph {
          margin: 0;
        }

        .lecture-chat-markdown-heading {
          display: block;
          font-weight: 800;
          font-size: 1rem;
          line-height: 1.5;
        }

        .lecture-chat-markdown-list {
          margin: 0;
          padding-left: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .lecture-chat-note {
          color: var(--text-muted, #64748b);
          font-size: 0.9rem;
        }

        .lecture-chat-composer-shell {
          width: 100%;
        }

        .lecture-chat-input-box {
          position: relative;
          width: 100%;
          border: 1px solid var(--border-color);
          border-radius: 22px;
          background: var(--secondary-bg);
          padding: 1rem 3.75rem 1rem 1.1rem;
          box-shadow: 0 8px 32px rgba(15, 23, 42, 0.08);
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            background-color 0.2s ease;
        }

        .lecture-chat-input-box:focus-within {
          border-color: rgba(99, 102, 241, 0.65);
          box-shadow:
            0 8px 32px rgba(15, 23, 42, 0.1),
            0 0 0 3px rgba(99, 102, 241, 0.16);
        }

        .lecture-chat-textarea {
          display: block;
          width: 100%;
          min-height: 2.35rem;
          max-height: calc(1.6rem * 5 + 24px);
          border: none;
          outline: none;
          resize: none;
          background: transparent;
          color: var(--text-color);
          font: inherit;
          line-height: 1.6;
          padding: 0.2rem 0;
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.35) transparent;
        }

        .lecture-chat-textarea::placeholder {
          color: var(--text-muted, #64748b);
          opacity: 0.78;
        }

        .lecture-chat-textarea:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .lecture-chat-send-button {
          position: absolute;
          right: 0.75rem;
          bottom: 0.9rem;
          width: 2.35rem;
          height: 2.35rem;
          border: none;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          background: linear-gradient(135deg, var(--primary-color), #7c3aed);
          cursor: pointer;
          transition:
            transform 0.18s ease,
            opacity 0.18s ease,
            background-color 0.18s ease;
        }

        .lecture-chat-send-button:hover:not(:disabled) {
          transform: translateY(-1px);
        }

        .lecture-chat-send-button:disabled {
          background: #64748b;
          cursor: not-allowed;
          opacity: 0.45;
          transform: none;
        }

        .lecture-chat-typing {
          display: inline-flex;
          align-items: center;
          gap: 0.38rem;
          min-width: 3.2rem;
          min-height: 1.3rem;
          background: rgba(148, 163, 184, 0.08);
          border: 1px solid rgba(148, 163, 184, 0.16);
          padding: 0.5rem 0.75rem;
          border-radius: 12px;
        }

        .lecture-chat-typing span {
          width: 0.42rem;
          height: 0.42rem;
          border-radius: 999px;
          background: var(--primary-color);
          opacity: 0.45;
          animation: lecture-chat-dot 1s ease-in-out infinite;
        }

        .lecture-chat-typing span:nth-child(2) {
          animation-delay: 0.16s;
        }

        .lecture-chat-typing span:nth-child(3) {
          animation-delay: 0.32s;
        }

        @keyframes lecture-chat-dot {
          0%, 100% {
            opacity: 0.35;
            transform: translateY(0);
          }
          50% {
            opacity: 1;
            transform: translateY(-3px);
          }
        }

        @keyframes lecture-chat-fade-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-color-scheme: dark) {
          .lecture-chat-bubble-assistant {
            background: transparent;
            border: none;
          }

          .lecture-chat-input-box {
            background: rgba(15, 23, 42, 0.78);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.22);
          }

          .lecture-chat-bubble-error {
            color: #fecaca;
          }

          .lecture-chat-typing {
            background: rgba(30, 41, 59, 0.62);
            border-color: rgba(148, 163, 184, 0.12);
          }
        }

        @media (max-width: 720px) {
          .chatbot-container {
            height: calc(100vh - 280px);
            min-height: 400px;
          }

          .lecture-chat-group-user {
            max-width: 90%;
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
        {isProcessingLecture && (
          <div style={{ marginTop: "0.65rem" }}>
            <ConnectionQualityIndicator quality={connectionQuality} />
          </div>
        )}

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

      <div
        className={activeTab === "chatbot" ? undefined : "card"}
        style={
          activeTab === "chatbot"
            ? {
                background: "transparent",
                border: "none",
                boxShadow: "none",
                padding: 0,
              }
            : activeTab === "transcript"
            ? {
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                transform: "none",
              }
            : undefined
        }
      >
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
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
                margin: "-0.25rem -0.25rem 1rem",
                padding: "0.25rem 0.25rem 1rem",
                position: "sticky",
                top: 0,
                zIndex: 3,
                background: "var(--secondary-bg)",
                borderBottom: "1px solid var(--border-color)",
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
              <div className="alert alert-info" style={{ marginBottom: "1rem" }}>
                {mediaPlaybackError || mediaUnavailableMessage}
              </div>
            )}
            <div
              ref={transcriptScrollContainerRef}
              style={{
                background: "var(--bg-color)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                maxHeight: "min(650px, calc(100vh - 390px))",
                minHeight: "320px",
                overflowY: "auto",
                overscrollBehavior: "contain",
                overflowAnchor: "none",
                padding: "1rem",
                scrollBehavior: "smooth",
                scrollbarGutter: "stable",
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
          <div className="chatbot-container">
            <div
              ref={chatScrollContainerRef}
              className="messages-area"
              onScroll={handleChatScroll}
            >
              <div className="content-column">
                {chatMessages.length === 0 &&
                  !pendingChatQuestion &&
                  !chatSending &&
                  !chatError &&
                  renderWelcomeBubble()}

                {chatMessages.map((message) => {
                  const isUser = message.role.toLowerCase() === "user";

                  return (
                    <React.Fragment key={message.id}>
                      {renderChatBubble({
                        label: isUser ? "You" : "Assistant",
                        role: isUser ? "user" : "assistant",
                        content: isUser ? (
                          <div className="lecture-chat-user-text">
                            {message.content}
                          </div>
                        ) : (
                          renderChatMessageContent(message.content)
                        ),
                      })}
                    </React.Fragment>
                  );
                })}

                {pendingChatQuestion &&
                  renderChatBubble({
                    label: "You",
                    role: "user",
                    content: (
                      <div className="lecture-chat-user-text">
                        {pendingChatQuestion}
                      </div>
                    ),
                  })}

                {chatSending && renderTypingIndicator()}

                {chatError &&
                  renderChatBubble({
                    label: "Assistant",
                    role: "assistant",
                    variant: "error",
                    content: (
                      <div className="lecture-chat-user-text">
                        {getFriendlyErrorMessage(chatError)}
                      </div>
                    ),
                  })}

                <div ref={chatEndRef} />
              </div>
            </div>

            <div className="input-bar">
              <div className="content-column">
                {renderChatComposer()}
              </div>
            </div>
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
      {showSlowConnectionToast && (
        <SlowConnectionToast
          onClose={() => setShowSlowConnectionToast(false)}
        />
      )}
    </div>
  );
}
