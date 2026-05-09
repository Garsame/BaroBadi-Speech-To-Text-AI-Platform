import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "./src/lib/session";

type SessionUser = {
  role: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

const PUBLIC_AUTH_ROUTES = new Set([
  "/sign-in",
  "/sign-up",
  "/admin-login",
  "/admin-signup",
]);

function isUserRoute(pathname: string): boolean {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function isAdminRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function applyNoStore(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

function redirectTo(
  request: NextRequest,
  pathname: string,
  clearSession = false,
): NextResponse {
  const response = NextResponse.redirect(new URL(pathname, request.url));

  if (clearSession) {
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
  }

  return applyNoStore(response);
}

async function resolveSessionUser(token: string): Promise<SessionUser | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as SessionUser;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userRoute = isUserRoute(pathname);
  const adminRoute = isAdminRoute(pathname);
  const publicAuthRoute = PUBLIC_AUTH_ROUTES.has(pathname);
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    if (userRoute) {
      return redirectTo(request, "/sign-in", true);
    }

    if (adminRoute) {
      return redirectTo(request, "/admin-login", true);
    }

    return applyNoStore(NextResponse.next());
  }

  const sessionUser = await resolveSessionUser(token);

  if (!sessionUser) {
    if (userRoute) {
      return redirectTo(request, "/sign-in", true);
    }

    if (adminRoute) {
      return redirectTo(request, "/admin-login", true);
    }

    const response = NextResponse.next();
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
    return applyNoStore(response);
  }

  if (publicAuthRoute) {
    return redirectTo(
      request,
      sessionUser.role === "admin" ? "/admin/dashboard" : "/dashboard",
    );
  }

  if (adminRoute && sessionUser.role !== "admin") {
    return redirectTo(request, "/dashboard");
  }

  if (userRoute && sessionUser.role === "admin") {
    return redirectTo(request, "/admin/dashboard");
  }

  return applyNoStore(NextResponse.next());
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/sign-in",
    "/sign-up",
    "/admin-login",
    "/admin-signup",
  ],
};
