"use client";

import React from "react";
import Link from "next/link";
import {
  MdAutoFixHigh,
  MdLibraryBooks,
  MdOutlineVideoSettings,
  MdSearch,
  MdSmartToy,
  MdTextSnippet,
  MdTranslate,
} from "react-icons/md";

const principles = [
  {
    icon: MdTranslate,
    title: "Somali-first clarity",
    description:
      "The platform prioritizes readable Somali explanations so students can review difficult lectures with more confidence.",
  },
  {
    icon: MdSearch,
    title: "Searchable memory",
    description:
      "Recorded lessons become reusable resources instead of one-time videos buried in a folder or playlist.",
  },
  {
    icon: MdSmartToy,
    title: "AI that supports study",
    description:
      "Transcription, notes, quizzes, and chat work together around the lecture instead of acting as separate tools.",
  },
];

const stages = [
  { icon: MdOutlineVideoSettings, title: "Prepare media" },
  { icon: MdTextSnippet, title: "Create transcript" },
  { icon: MdAutoFixHigh, title: "Generate notes" },
  { icon: MdLibraryBooks, title: "Save study pack" },
];

const systemAreas = [
  {
    icon: MdLibraryBooks,
    title: "Learner workspace",
    description:
      "A personal, organized hub where you can store all your lecture recordings, generated notes, and study packages.",
  },
  {
    icon: MdSmartToy,
    title: "Interactive AI Chat",
    description:
      "Ask questions directly to your lecture slides or transcript, summarize key concepts, and clarify difficult parts instantly.",
  },
  {
    icon: MdTranslate,
    title: "Smart Somali translation",
    description:
      "Struggling with technical terms? Translate complex academic terminology into clear, contextual Somali explanations.",
  },
  {
    icon: MdAutoFixHigh,
    title: "Auto-generated quizzes",
    description:
      "Test your memory with automatically created multiple-choice questions and active recall flashcards.",
  },
];

export default function AboutPage() {
  return (
    <div className="about-page">
      {/* Section 1: Centered Hero */}
      <section className="public-section page-hero reveal-up">
        <div className="public-container about-hero-container">
          <div className="section-heading center">
            <span className="section-eyebrow">About Baro Platform</span>
            <h1 style={{ maxWidth: "780px" }}>Designed for students who study from lectures.</h1>
            <p style={{ maxWidth: "600px", marginInline: "auto" }}>
              Baro Platform turns long lecture media into Somali study material that
              can be searched, reviewed, questioned, and reused.
            </p>
            <div className="section-actions" style={{ justifyContent: "center" }}>
              <Link href="/sign-up" className="public-btn public-btn-primary">
                Create Account
              </Link>
              <Link href="/contact" className="public-btn public-btn-ghost">
                Talk to Us
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Principles Card Grid with Numbers */}
      <section className="public-section public-section-soft">
        <div className="public-container section-stack">
          <div className="section-heading center reveal-up">
            <span className="section-eyebrow">Why it matters</span>
            <h2>Recorded learning should be easier to return to.</h2>
            <p>
              The system reduces the work of replaying, pausing, translating,
              rewriting, and reorganizing lecture content by creating a
              structured learning pack.
            </p>
          </div>

          <div className="principles-grid">
            {principles.map((item, idx) => {
              const Icon = item.icon;
              return (
                <article className={`principle-card reveal-up delay-${idx + 1}`} key={item.title}>
                  <span className="principle-card-icon">
                    <Icon />
                  </span>
                  <div>
                    <span className="principle-number">PRINCIPLE 0{idx + 1}</span>
                    <h3>{item.title}</h3>
                  </div>
                  <p>{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 3: Horizontal Pipeline Node Roadmap */}
      <section className="public-section">
        <div className="public-container section-stack">
          <div className="section-heading center reveal-up">
            <span className="section-eyebrow">How it works</span>
            <h2>A practical AI pipeline behind a simple learner experience.</h2>
            <p>
              The public pages stay lightweight, while the application tracks
              lecture sources, processing stages, generated content, and the
              student workspace behind the scenes.
            </p>
          </div>

          <div className="pipeline-roadmap">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              return (
                <div className={`pipeline-node reveal-up delay-${index + 1}`} key={stage.title}>
                  <span className="pipeline-node-num">STAGE 0{index + 1}</span>
                  <article className="pipeline-card">
                    <Icon aria-hidden="true" />
                    <h3>{stage.title}</h3>
                    <p>
                      The lecture is analyzed, processed, and structured before transitioning to the next active node.
                    </p>
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section 4: System Areas side-icon List Card Layout */}
      <section className="public-section public-section-soft">
        <div className="public-container about-features-layout">
          <div className="about-features-hero reveal-left">
            <span className="section-eyebrow">Inside the platform</span>
            <h2>More than a transcript generator.</h2>
            <p>
              Baro Platform is a complete study workspace designed to automate the heavy lifting of lecture revision, letting you focus on actual learning.
            </p>
            <div className="features-hero-card">
              <h3>Somali-First Learning</h3>
              <p>Everything is customized for Somali classrooms, helping you understand global curriculum in your local language.</p>
            </div>
          </div>

          <div className="about-features-list reveal-right">
            {systemAreas.map((item, idx) => {
              const Icon = item.icon;
              return (
                <article className="about-feature-item" key={item.title}>
                  <div className="about-feature-icon">
                    <Icon aria-hidden="true" />
                  </div>
                  <div className="about-feature-info">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
