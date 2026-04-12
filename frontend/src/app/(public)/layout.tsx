import React from "react";
import Link from "next/link";
import "./public.css";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="public-layout">
      <header className="glass">
        <div className="container header-container">
          <Link href="/" className="logo">
            <h1>SomaliNotes Platform</h1>
          </Link>
          <nav>
            <Link href="/about">About</Link>
            <Link href="/sign-in" className="btn-outline">
              Sign In
            </Link>
            <Link href="/sign-up" className="btn">
              Sign Up
            </Link>
          </nav>
        </div>
      </header>
      <main className="container main-content">{children}</main>
      <footer>
        <div className="container">
          <p>(c) 2026 Somali Notes Generation. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
