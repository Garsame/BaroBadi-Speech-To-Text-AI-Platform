"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MdAdminPanelSettings,
  MdArrowForward,
  MdEmail,
  MdGroups,
  MdSupportAgent,
} from "react-icons/md";
import { apiUrl } from "@/lib/api";

const contactReasons = [
  {
    icon: MdSupportAgent,
    title: "Student support",
    description:
      "Account access, lecture processing, generated notes, quizzes, or dashboard questions.",
  },
  {
    icon: MdGroups,
    title: "Educator interest",
    description:
      "Using Baro Platform with recorded classes, course material, or revision support.",
  },
  {
    icon: MdAdminPanelSettings,
    title: "System setup",
    description:
      "Deployment, administration, monitoring, and operational support questions.",
  },
];

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">(
    "idle",
  );
  const [errorText, setErrorText] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");
    setErrorText("");

    try {
      const response = await fetch(apiUrl("/api/v1/contact/"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, topic, message }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message. Please try again later.");
      }

      setSubmitStatus("success");
      setName("");
      setEmail("");
      setTopic("");
      setMessage("");
    } catch (error: unknown) {
      setSubmitStatus("error");
      setErrorText(
        error instanceof Error ? error.message : "An unexpected error occurred.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-page">
      <section className="public-section page-hero compact">
        <div className="public-container">
          <div className="section-heading center">
            <span className="section-eyebrow">Contact</span>
            <h1>Talk to the Baro Platform team.</h1>
            <p>
              Send a message about support, classroom use, deployment, or ideas
              that can make lecture revision better for Somali learners.
            </p>
          </div>
        </div>
      </section>

      <section className="public-section">
        <div className="public-container contact-layout">
          <aside className="contact-panel" style={{ border: "1px solid var(--public-border)", padding: "32px", borderRadius: "var(--public-radius)", background: "var(--public-surface)", boxShadow: "var(--public-soft-shadow)" }}>
            <div className="contact-panel-heading">
              <span className="section-eyebrow" style={{ width: "fit-content" }}>Choose a topic</span>
              <h2>We will route your message to the right place.</h2>
            </div>

            <div className="contact-list">
              {contactReasons.map((item) => {
                const Icon = item.icon;
                return (
                  <article className="contact-item" key={item.title} style={{ borderRadius: "var(--public-radius-sm)" }}>
                    <span className="contact-icon" style={{ background: "var(--public-soft)", color: "var(--public-primary)", borderRadius: "var(--public-radius-full)" }}>
                      <Icon />
                    </span>
                    <div>
                      <h3 style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>{item.title}</h3>
                      <p>{item.description}</p>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="contact-email-card" style={{ borderRadius: "var(--public-radius-sm)", background: "var(--public-soft)", border: "1px solid var(--public-border)", display: "flex", gap: "16px", padding: "20px" }}>
              <MdEmail aria-hidden="true" style={{ fontSize: "1.5rem", color: "var(--public-primary)", marginTop: "2px" }} />
              <div>
                <strong style={{ display: "block", color: "var(--public-text)", fontFamily: "var(--public-font-title)" }}>Email Address</strong>
                <a href="mailto:hello@baroplatform.ai" style={{ color: "var(--public-primary)", fontWeight: 500 }}>hello@baroplatform.ai</a>
              </div>
            </div>
          </aside>

          <section className="form-card contact-form-card" aria-label="Contact form" style={{ border: "1px solid var(--public-border)", padding: "40px", borderRadius: "var(--public-radius)", background: "var(--public-surface)", boxShadow: "var(--public-soft-shadow)" }}>
            {submitStatus === "success" ? (
              <div className="success-state">
                <span className="success-icon" style={{ background: "var(--public-soft)", color: "var(--public-primary)", borderRadius: "var(--public-radius-full)", width: "64px", height: "64px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "1.25rem", fontWeight: "bold" }}>OK</span>
                <h2>Message sent</h2>
                <p>
                  Your message has been saved. The team can follow up through
                  the email address you provided.
                </p>
                <button
                  type="button"
                  className="public-btn public-btn-primary"
                  onClick={() => setSubmitStatus("idle")}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <div className="form-heading">
                  <h2 style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Send a message</h2>
                  <p>Share a few details and the team will respond by email.</p>
                </div>

                {submitStatus === "error" && (
                  <div className="alert alert-error" role="alert">
                    {errorText}
                  </div>
                )}

                <form className="public-form" onSubmit={handleSubmit}>
                  <div className="form-field">
                    <label htmlFor="contact-name" style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Full name</label>
                    <input
                      id="contact-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      placeholder="Your full name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="contact-email" style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Email address</label>
                    <input
                      id="contact-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="contact-topic" style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Topic</label>
                    <input
                      id="contact-topic"
                      name="topic"
                      type="text"
                      placeholder="Support, partnership, or setup"
                      value={topic}
                      onChange={(event) => setTopic(event.target.value)}
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="contact-message" style={{ fontFamily: "var(--public-font-title)", fontWeight: 500 }}>Message</label>
                    <textarea
                      id="contact-message"
                      name="message"
                      placeholder="Tell us what you need help with"
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="public-btn public-btn-primary"
                    disabled={isSubmitting}
                    style={{ marginTop: "8px" }}
                  >
                    {isSubmitting ? "Sending..." : "Send message"}
                    {!isSubmitting && <MdArrowForward aria-hidden="true" />}
                  </button>
                </form>

                <p className="auth-switch" style={{ marginTop: "24px" }}>
                  Ready to study? <Link href="/sign-up" style={{ color: "var(--public-primary)", fontWeight: 500 }}>Create an account</Link>
                </p>
              </>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
