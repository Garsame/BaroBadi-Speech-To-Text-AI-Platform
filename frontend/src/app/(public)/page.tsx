"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MdArrowForward,
  MdAutoFixHigh,
  MdCheckCircle,
  MdCloudUpload,
  MdAdd,
  MdRemove,
  MdLibraryBooks,
  MdOutlineChat,
  MdQuiz,
  MdSpeed,
  MdTranslate,
  MdWarning,
} from "react-icons/md";
import "./landing.css";

const stats = [
  { value: "4", label: "Study outputs" },
  { value: "99.2%", label: "Accuracy" },
  { value: "Somali", label: "First design" },
];

const productHighlights = [
  {
    icon: MdCloudUpload,
    title: "Upload or paste link",
    description:
      "Start with any lecture recording or YouTube video, keeping it connected to your workspace.",
  },
  {
    icon: MdTranslate,
    title: "Somali-first AI",
    description:
      "Get clear Somali transcripts, summaries, and revision notes tailored for local education.",
  },
  {
    icon: MdQuiz,
    title: "Practice built in",
    description:
      "Turn passive video watching into active revision with automatically generated quizzes.",
  },
];

const studyOutputs = [
  { icon: MdTranslate, title: "Somali Notes", label: "Structured revision guides" },
  { icon: MdQuiz, title: "Interactive Quizzes", label: "Recall and self-test checks" },
  { icon: MdOutlineChat, title: "AI Study Assistant", label: "Ask follow-up questions" },
  { icon: MdSpeed, title: "Searchable Transcript", label: "Scan key words quickly" },
];

const workflow = [
  {
    title: "Submit media",
    description: "Upload your audio/video recorded lesson or paste a YouTube lecture link.",
  },
  {
    title: "Extract & transcribe",
    description: "Our AI processes the speech, transcribing it in high fidelity.",
  },
  {
    title: "Generate study guides",
    description: "The system writes structured Somali notes, key summaries, and self-tests.",
  },
  {
    title: "Interactive review",
    description: "Access your package, take generated quizzes, and chat with the lecture.",
  },
];



const faqs = [
  {
    question: "How accurate is the Somali speech transcription?",
    answer: "Our specialized speech-to-text models are trained specifically on Somali dialects and educational terminology, delivering high accuracy for local academic lectures and presentations.",
  },
  {
    question: "Can I paste YouTube links directly?",
    answer: "Yes! Simply paste any public YouTube lecture link, and Baro Platform will automatically fetch, extract the audio, transcribe the speech, and write your study notes.",
  },
  {
    question: "How does the AI interactive chat work?",
    answer: "Once a lecture is transcribed, you can click 'Chat' to ask follow-up questions. The AI references the exact transcript details, acting as a virtual tutor that is fully aware of the lesson content.",
  },
  {
    question: "Is there a limit on file upload size?",
    answer: "Free plan accounts support up to 50MB files. Pro plan users can upload media files up to 500MB, accommodating long university classes and extensive review series.",
  },
  {
    question: "Can I download my notes and quizzes?",
    answer: "Absolutely. You can export any generated notes, transcripts, or review sheets as PDFs, making it easy to print or revise offline during study sessions.",
  },
];



export default function LandingPage() {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="landing-hero">
        <div className="public-container hero-container">
          <div className="hero-content">
            <div className="hero-badge-wrap">
              <span className="hero-badge-new">New</span>
              <span className="hero-badge-text">Somali-First AI Lecture Platform</span>
            </div>
            <h1 className="hero-title">
              Turn long lectures into organized Somali study material.
            </h1>
            <p className="hero-description">
              Baro Platform converts recorded lessons into searchable transcripts, summaries,
              structured study notes, quizzes, and chat support so you can revise with ease.
            </p>
            <div className="hero-actions">
              <Link href="/sign-up" className="public-btn public-btn-primary">
                Get Started
                <MdArrowForward aria-hidden="true" />
              </Link>
              <Link href="/about" className="public-btn public-btn-ghost">
                See How It Works
              </Link>
            </div>

            <div className="hero-stats">
              {stats.map((stat, idx) => (
                <div className="hero-stat-item" key={idx}>
                  <h3>{stat.value}</h3>
                  <p>{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>



      {/* Features Section */}
      <section className="features-section">
        <div className="public-container">
          <div className="section-header-centered">
            <span className="section-eyebrow">Features</span>
            <h2 className="section-title">One unified platform to manage your studies</h2>
            <p className="section-subtitle">
              Stop rewatching long videos. Get straight to the key ideas with our suite of Somali study tools.
            </p>
          </div>

          <div className="features-grid">
            {productHighlights.map((feat, idx) => {
              const Icon = feat.icon;
              return (
                <div className={`feature-card reveal-up delay-${(idx % 4) + 1}`} key={idx}>
                  <div className="feature-card-icon">
                    <Icon />
                  </div>
                  <h3>{feat.title}</h3>
                  <p>{feat.description}</p>
                </div>
              );
            })}
          </div>

          {/* Splitted Feature Sections */}
          <div className="feature-split-layout">
            <div className="split-side-content reveal-left">
              <span className="section-eyebrow">Smart Outputs</span>
              <h2>Every processed lecture becomes a personalized revision workspace</h2>
              <p>
                Browse generated Somali notes, scan key transcription terms, take practice quizzes, and ask questions - all within a single unified view.
              </p>
              <div className="split-action-link">
                <Link href="/sign-up" className="public-btn public-btn-primary">
                  Create Free Account
                  <MdArrowForward />
                </Link>
              </div>
            </div>
            <div className="split-side-cards reveal-right">
              {studyOutputs.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <div className="study-output-card" key={idx}>
                    <div className="study-output-icon">
                      <Icon />
                    </div>
                    <div className="study-output-info">
                      <h3>{item.title}</h3>
                      <p>{item.label}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Workflow Section */}
      <section className="workflow-section">
        <div className="public-container">
          <div className="section-header-centered">
            <span className="section-eyebrow">Workflow</span>
            <h2 className="section-title">From recording to revision in four simple steps</h2>
            <p className="section-subtitle">
              Baro Platform automates the heavy processing, saving you hours of manual note-taking and revision prep.
            </p>
          </div>

          <div className="workflow-grid-horizontal">
            {workflow.map((step, idx) => (
              <div className={`workflow-step-card reveal-up delay-${(idx % 4) + 1}`} key={idx}>
                <div className="workflow-step-num">0{idx + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* FAQ Section */}
      <section className="faq-section">
        <div className="public-container">
          <div className="section-header-centered">
            <span className="section-eyebrow">FAQ</span>
            <h2 className="section-title">Everything you need to know</h2>
            <p className="section-subtitle">
              Quick answers to common questions about our transcription, AI study packs, and platform pricing.
            </p>
          </div>

          <div className="faq-accordion">
            {faqs.map((faq, idx) => (
              <div className={`faq-item ${activeFaq === idx ? "active" : ""}`} key={idx} onClick={() => toggleFaq(idx)}>
                <button className="faq-trigger" type="button" aria-expanded={activeFaq === idx}>
                  <span>{faq.question}</span>
                  {activeFaq === idx
                    ? <MdRemove className="accordion-chevron" />
                    : <MdAdd className="accordion-chevron" />}
                </button>
                <div className="faq-content">
                  <div className="faq-content-inner">
                    <p>{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="cta-banner-section">
        <div className="public-container">
          <div className="cta-banner-card reveal-scale">
            <div className="cta-banner-content">
              <h2>Smarter revision starts here.</h2>
              <p>
                Create your account and convert your next recorded lecture into structured Somali notes, transcript, and study tools.
              </p>
            </div>
            <div className="cta-banner-actions">
              <Link href="/sign-up" className="public-btn public-btn-primary">
                Get Started Free
              </Link>
              <Link href="/sign-in" className="public-btn public-btn-ghost">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
