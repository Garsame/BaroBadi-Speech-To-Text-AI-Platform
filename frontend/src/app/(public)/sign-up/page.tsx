"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  MdArrowForward,
  MdCheckCircle,
  MdLibraryBooks,
  MdOutlineVideoSettings,
} from "react-icons/md";
import { apiUrl, getErrorMessage } from "@/lib/api";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(apiUrl("/api/v1/auth/signup"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response, "Signup failed"));
      }

      setSuccess("Account created successfully. Redirecting to sign in...");
      router.push("/sign-in?registered=true");
    } catch (caughtError: unknown) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "An unexpected error occurred.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="auth-page" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "75vh" }}>
      <div className="public-container" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
        <div className="form-card auth-card" style={{ width: "100%", maxWidth: "480px", border: "1px solid var(--public-border)", padding: "40px", borderRadius: "var(--public-radius)", background: "var(--public-surface)", boxShadow: "var(--public-shadow)" }}>
          <div className="form-heading">
            <h2 style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Create account</h2>
            <p>Enter your details to open a Baro Platform workspace.</p>
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

          <form onSubmit={handleSubmit} className="public-form">
            <div className="form-field">
              <label htmlFor="signup-name" style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Full name</label>
              <input
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="signup-email" style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Email address</label>
              <input
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="signup-password" style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Password</label>
              <input
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="Create at least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <small>Use at least 8 characters.</small>
            </div>

            <button
              type="submit"
              className="public-btn public-btn-primary"
              disabled={isLoading}
              style={{ marginTop: "8px" }}
            >
              {isLoading ? "Creating account..." : "Create account"}
              {!isLoading && <MdArrowForward aria-hidden="true" />}
            </button>
          </form>

          <p className="auth-switch" style={{ marginTop: "24px" }}>
            Already have an account? <Link href="/sign-in" style={{ color: "var(--public-primary)", fontWeight: 500 }}>Sign in</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
