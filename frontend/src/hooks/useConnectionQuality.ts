"use client";

import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/api";

export type ConnectionQualityLevel = "excellent" | "good" | "slow" | "poor";

export type ConnectionQualitySnapshot = {
  level: ConnectionQualityLevel | null;
  label: string;
  latencyMs: number | null;
  isChecking: boolean;
  updatedAt: number | null;
};

type ConnectionQualityMeta = {
  label: string;
  color: string;
  dotClassName: string;
  barClassName: string;
  textClassName: string;
};

type UseConnectionQualityOptions = {
  enabled?: boolean;
  intervalMs?: number;
  timeoutMs?: number;
  probeUrl?: string;
};

export const CONNECTION_QUALITY_META: Record<
  ConnectionQualityLevel,
  ConnectionQualityMeta
> = {
  excellent: {
    label: "Excellent",
    color: "#10b981",
    dotClassName: "bg-emerald-500",
    barClassName: "bg-emerald-500",
    textClassName: "text-emerald-600",
  },
  good: {
    label: "Good",
    color: "#84cc16",
    dotClassName: "bg-lime-500",
    barClassName: "bg-lime-500",
    textClassName: "text-lime-600",
  },
  slow: {
    label: "Slow",
    color: "#f97316",
    dotClassName: "bg-orange-500",
    barClassName: "bg-orange-500",
    textClassName: "text-orange-600",
  },
  poor: {
    label: "Poor",
    color: "#ef4444",
    dotClassName: "bg-red-500",
    barClassName: "bg-red-500",
    textClassName: "text-red-600",
  },
};

const PUBLIC_PROBE_URL = "https://www.gstatic.com/generate_204";

const INITIAL_CONNECTION_QUALITY: ConnectionQualitySnapshot = {
  level: null,
  label: "Checking",
  latencyMs: null,
  isChecking: false,
  updatedAt: null,
};

function getQualityLevel(latencyMs: number | null): ConnectionQualityLevel {
  if (latencyMs === null || latencyMs > 800) {
    return "poor";
  }

  if (latencyMs < 100) {
    return "excellent";
  }

  if (latencyMs <= 300) {
    return "good";
  }

  return "slow";
}

function addCacheBuster(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}_connectionProbe=${Date.now()}`;
}

async function measureFetchLatency(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  requireOkResponse: boolean,
): Promise<number> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(addCacheBuster(url), {
      ...init,
      cache: "no-store",
      signal: controller.signal,
    });

    if (requireOkResponse && !response.ok) {
      throw new Error(`Connection probe failed with ${response.status}`);
    }

    return performance.now() - startedAt;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function measureConnectionLatency(
  probeUrl: string,
  timeoutMs: number,
): Promise<number | null> {
  try {
    return await measureFetchLatency(
      probeUrl,
      {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache",
        },
      },
      timeoutMs,
      true,
    );
  } catch {
    try {
      return await measureFetchLatency(
        PUBLIC_PROBE_URL,
        {
          method: "HEAD",
          mode: "no-cors",
        },
        timeoutMs,
        false,
      );
    } catch {
      return null;
    }
  }
}

export function useConnectionQuality({
  enabled = true,
  intervalMs = 30_000,
  timeoutMs = 5_000,
  probeUrl = apiUrl("/"),
}: UseConnectionQualityOptions = {}): ConnectionQualitySnapshot {
  const [connectionQuality, setConnectionQuality] =
    useState<ConnectionQualitySnapshot>(INITIAL_CONNECTION_QUALITY);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isActive = true;

    const checkConnection = async () => {
      setConnectionQuality((currentQuality) => ({
        ...currentQuality,
        isChecking: true,
      }));

      const latencyMs = await measureConnectionLatency(probeUrl, timeoutMs);

      if (!isActive) {
        return;
      }

      const level = getQualityLevel(latencyMs);

      setConnectionQuality({
        level,
        label: CONNECTION_QUALITY_META[level].label,
        latencyMs,
        isChecking: false,
        updatedAt: Date.now(),
      });
    };

    void checkConnection();

    const intervalId = window.setInterval(() => {
      void checkConnection();
    }, intervalMs);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs, probeUrl, timeoutMs]);

  return enabled ? connectionQuality : INITIAL_CONNECTION_QUALITY;
}
