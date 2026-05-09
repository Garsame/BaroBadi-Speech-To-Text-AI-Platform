const TOKEN_STORAGE_KEY = "token";
export const SESSION_COOKIE_NAME = "speech-to-text-session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 8;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readCookieValue(name: string, cookieSource: string): string | null {
  const target = `${name}=`;
  const cookie = cookieSource
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(target));

  if (!cookie) {
    return null;
  }

  return decodeURIComponent(cookie.slice(target.length));
}

export function getCookieValue(
  name: string,
  cookieSource?: string,
): string | null {
  if (cookieSource !== undefined) {
    return readCookieValue(name, cookieSource);
  }

  if (!isBrowser()) {
    return null;
  }

  return readCookieValue(name, document.cookie);
}

export function persistSession(token: string): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  document.cookie = `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearSession(): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  document.cookie = `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getSessionToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  const cookieToken = getCookieValue(SESSION_COOKIE_NAME);

  if (!cookieToken) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return null;
  }

  if (window.localStorage.getItem(TOKEN_STORAGE_KEY) !== cookieToken) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, cookieToken);
  }

  return cookieToken;
}
