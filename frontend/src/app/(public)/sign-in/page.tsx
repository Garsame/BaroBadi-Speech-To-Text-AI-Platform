"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  MdArrowForward,
  MdCheckCircle,
  MdLibraryBooks,
  MdVisibility,
  MdVisibilityOff,
} from "react-icons/md";
import { apiUrl, fetchCurrentUser, getErrorMessage } from "@/lib/api";
import { clearSession, persistSession } from "@/lib/session";

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdentityServices = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
      }) => void;
      renderButton: (
        element: HTMLElement,
        options: {
          theme: "outline";
          size: "large";
          width: number;
          text: "continue_with";
          logo_alignment: "left";
          shape: "pill";
        },
      ) => void;
    };
  };
};

declare global {
  interface Window {
    google?: GoogleIdentityServices;
  }
}

const GoogleIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.47h4.84c-.21 1.12-.84 2.07-1.79 2.7v2.25h2.9c1.69-1.55 2.69-3.85 2.69-6.58z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.47-.8 5.96-2.2l-2.9-2.25c-.8.54-1.83.87-3.06.87-2.35 0-4.34-1.58-5.05-3.72H.93v2.33C2.42 16.02 5.48 18 9 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.95 10.7c-.18-.54-.28-1.11-.28-1.7s.1-1.16.28-1.7V4.97H.93A8.99 8.99 0 0 0 0 9c0 1.45.35 2.82.93 4.03l3.02-2.33z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.47.9 11.43 0 9 0 5.48 0 2.42 1.98.93 4.97l3.02 2.33C4.66 5.16 6.65 3.58 9 3.58z"
    />
  </svg>
);

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasGoogleClientId, setHasGoogleClientId] = useState(false);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const handleGoogleLogin = useCallback(
    async (googleToken: string) => {
      setIsLoading(true);
      setError(null);
      setSuccess(null);

      try {
        const response = await fetch(apiUrl("/api/v1/auth/google-login"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: googleToken }),
        });

        if (!response.ok) {
          throw new Error(await getErrorMessage(response, "Google login failed"));
        }

        const data = (await response.json()) as { access_token: string };
        const currentUser = await fetchCurrentUser(data.access_token);

        persistSession(data.access_token);
        router.replace(
          currentUser.role === "admin" ? "/admin/dashboard" : "/dashboard",
        );
      } catch (caughtError: unknown) {
        clearSession();
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "An unexpected error occurred.",
        );
      } finally {
        setIsLoading(false);
      }
    },
    [router],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    if (params.get("registered") === "true") {
      setSuccess("Account created successfully. You can sign in now.");
      router.replace("/sign-in");
    }
  }, [router]);

  useEffect(() => {
    if (!hasGoogleClientId) return;

    const container = document.getElementById("g_id_signin_btn");
    if (!container) return;

    const initialWidth = container.getBoundingClientRect().width;
    if (initialWidth > 0) {
      setContainerWidth(Math.min(Math.max(initialWidth, 200), 400));
    }

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const measuredWidth = entry.contentRect.width;
      if (measuredWidth > 0) {
        setContainerWidth(Math.min(Math.max(measuredWidth, 200), 400));
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [hasGoogleClientId]);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setHasGoogleClientId(false);
      return;
    }

    setHasGoogleClientId(true);
    if (!containerWidth) return;

    const initAndRenderGoogleButton = () => {
      if (!window.google) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response.credential) {
            handleGoogleLogin(response.credential);
          }
        },
      });

      const buttonContainer = document.getElementById("g_id_signin_btn");
      if (buttonContainer) {
        buttonContainer.innerHTML = "";
        window.google.accounts.id.renderButton(buttonContainer, {
          theme: "outline",
          size: "large",
          width: containerWidth,
          text: "continue_with",
          logo_alignment: "left",
          shape: "pill",
        });
      }
    };

    if (window.google) {
      initAndRenderGoogleButton();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initAndRenderGoogleButton;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, [containerWidth, handleGoogleLogin]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data && event.data.type === "google-login-success") {
        handleGoogleLogin(event.data.token);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleGoogleLogin]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const response = await fetch(apiUrl("/api/v1/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Login failed"));
      }

      const data = (await response.json()) as { access_token: string };
      const currentUser = await fetchCurrentUser(data.access_token);

      persistSession(data.access_token);
      router.replace(
        currentUser.role === "admin" ? "/admin/dashboard" : "/dashboard",
      );
    } catch (caughtError: unknown) {
      clearSession();
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "An unexpected error occurred.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const openGooglePopup = () => {
    const width = 500;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;

    window.open(
      "/google-chooser",
      "GoogleSignOn",
      `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`,
    );
  };

  return (
    <section className="auth-page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "75vh" }}>
      <div className="public-container" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
        <div className="form-card auth-card" style={{ width: "100%", maxWidth: "480px", border: "1px solid var(--public-border)", padding: "40px", borderRadius: "var(--public-radius)", background: "var(--public-surface)", boxShadow: "var(--public-shadow)" }}>
          <div className="form-heading">
            <h2 style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Sign in</h2>
            <p>Use your account details to enter Baro Platform.</p>
          </div>

          {success && (
            <div className="alert alert-success" role="status">
              {success}
            </div>
          )}
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <div className="google-button-slot">
            {hasGoogleClientId ? (
              <div id="g_id_signin_btn" className="google-native-slot">
                <button type="button" className="google-signin-btn">
                  <GoogleIcon />
                  Continue with Google
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openGooglePopup}
                className="google-signin-btn"
              >
                <GoogleIcon />
                Continue with Google
              </button>
            )}
          </div>

          <div className="auth-divider">
            <span>or</span>
          </div>

          <form onSubmit={handleSubmit} className="public-form">
            <div className="form-field">
              <label htmlFor="signin-email" style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Email address</label>
              <input
                id="signin-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <div className="field-label-row">
                <label htmlFor="signin-password" style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Password</label>
                <Link href="/contact" style={{ color: "var(--public-primary)", fontWeight: 500 }}>Forgot password?</Link>
              </div>
              <div className="password-field">
                <input
                  id="signin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="public-btn public-btn-primary"
              disabled={isLoading}
              style={{ marginTop: "8px" }}
            >
              {isLoading ? "Signing in..." : "Sign in"}
              {!isLoading && <MdArrowForward aria-hidden="true" />}
            </button>
          </form>

          <p className="auth-switch" style={{ marginTop: "24px" }}>
            New to Baro Platform? <Link href="/sign-up" style={{ color: "var(--public-primary)", fontWeight: 500 }}>Create an account</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
