import React from 'react';
import Link from 'next/link';
import './landing.css';

export default function LandingPage() {
  return (
    <div className="landing-page">
      <section className="hero">
        <div className="hero-content">
          <h1>Transform Lectures into <span className="highlight">Somali Notes</span> using AI</h1>
          <p>
            Upload your lecture videos or submit YouTube links, and our AI pipeline will transcribe,
            analyze, and generate structured, easy-to-read educational study notes in Somali.
          </p>
          <div className="hero-actions">
            <Link href="/sign-up" className="btn btn-lg">Get Started</Link>
            <Link href="/about" className="btn-outline btn-lg">Learn More</Link>
          </div>
        </div>
      </section>
      
      <section className="features">
        <div className="feature-card card">
          <h3>1. Upload or Link</h3>
          <p>Provide a video file or a YouTube link to the educational lecture you want to digest.</p>
        </div>
        <div className="feature-card card">
          <h3>2. AI Transcription</h3>
          <p>We extract the audio and precisely transcribe it into clean text quickly.</p>
        </div>
        <div className="feature-card card">
          <h3>3. Generate Notes</h3>
          <p>Our language model translates and structures the text into rich Somali study notes.</p>
        </div>
      </section>
    </div>
  );
}
