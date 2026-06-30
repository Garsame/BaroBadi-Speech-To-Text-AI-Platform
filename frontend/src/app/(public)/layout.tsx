"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import PublicHeader from "./PublicHeader";
import "./public.css";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    // Fade out preloader
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 600);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: "0px -20px",
      threshold: 0.02,
    };

    const scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("reveal-active");
        }
      });
    }, observerOptions);

    const observeAll = () => {
      const elements = document.querySelectorAll(
        ".reveal-left, .reveal-right, .reveal-up, .reveal-scale"
      );
      elements.forEach((el) => {
        scrollObserver.observe(el);
      });
    };

    // Run initially
    observeAll();

    // Reactive MutationObserver handles client-side page transitions dynamically
    const mutationObserver = new MutationObserver(() => {
      observeAll();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      scrollObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [children]);

  return (
    <div className="public-layout">
      {isPageLoading && (
        <div className="page-preloader" role="status" aria-busy="true">
          <div className="preloader-logo">
            <Image
              src="/barobadi-logo.png"
              alt="Baro Platform Logo"
              width={120}
              height={38}
              className="logo-light"
              priority
            />
            <Image
              src="/barobadi-logo-dark.png"
              alt="Baro Platform Logo"
              width={120}
              height={38}
              className="logo-dark"
              priority
            />
            <div className="preloader-bar-container">
              <div className="preloader-bar"></div>
            </div>
          </div>
        </div>
      )}

      <PublicHeader />
      <main className="public-main">{children}</main>
      <footer className="public-footer">
        <div className="public-container footer-shell">
          <div className="footer-brand">
            <Link href="/" className="brand-lockup footer-logo">
              <Image
                src="/barobadi-logo.png"
                alt="Baro Platform"
                width={120}
                height={38}
                className="logo-light"
              />
              <Image
                src="/barobadi-logo-dark.png"
                alt="Baro Platform"
                width={120}
                height={38}
                className="logo-dark"
              />
            </Link>
            <p>
              Somali-first AI study tools for turning recorded lectures into
              searchable notes, summaries, quizzes, and review material.
            </p>
          </div>

          <div className="footer-column">
            <h2>Pages</h2>
            <Link href="/">Home</Link>
            <Link href="/about">About</Link>
            <Link href="/contact">Contact</Link>
          </div>

          <div className="footer-column">
            <h2>Access</h2>
            <Link href="/sign-in">Sign in</Link>
            <Link href="/sign-up">Create account</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>

          <div className="footer-column">
            <h2>Platform</h2>
            <span>Transcript generation</span>
            <span>Somali study notes</span>
            <span>Lecture quizzes</span>
          </div>
        </div>

        <div className="public-container footer-bottom">
          <p>Copyright 2026 Baro Platform. All rights reserved.</p>
          <p>Built for focused lecture revision.</p>
        </div>
      </footer>
    </div>
  );
}
