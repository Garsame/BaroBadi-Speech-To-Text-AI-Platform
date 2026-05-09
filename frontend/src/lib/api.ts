import { getSessionToken } from "@/lib/session";

const DEFAULT_API_BASE_URL = "http://localhost:8000";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL;

export interface AuthenticatedUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  profile_picture_url?: string | null;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export function authHeaders(
  headers: Record<string, string> = {},
): Record<string, string> {
  const token = getSessionToken();

  if (!token) {
    return headers;
  }

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  };
}

export async function getErrorMessage(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: string };

    if (payload.detail) {
      return payload.detail;
    }
  } catch {
    return fallbackMessage;
  }

  return fallbackMessage;
}

export async function fetchCurrentUser(
  token?: string,
): Promise<AuthenticatedUser> {
  const resolvedToken = token ?? getSessionToken();

  if (!resolvedToken) {
    throw new ApiError("Not authenticated", 401);
  }

  const response = await fetch(apiUrl("/api/v1/auth/me"), {
    headers: {
      Authorization: `Bearer ${resolvedToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ApiError(
      await getErrorMessage(response, "Not authenticated"),
      response.status,
    );
  }

  return (await response.json()) as AuthenticatedUser;
}
