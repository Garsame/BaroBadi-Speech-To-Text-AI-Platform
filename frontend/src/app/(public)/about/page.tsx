import Link from "next/link";

const workflow = [
  {
    title: "Ingest lecture media",
    description:
      "Students can submit a YouTube link or upload a local lecture recording.",
  },
  {
    title: "Transcribe the audio",
    description:
      "The backend extracts audio, prepares it for speech recognition, and creates an English transcript.",
  },
  {
    title: "Generate Somali notes",
    description:
      "The note service transforms the transcript into structured Somali study notes and summaries.",
  },
];

export default function AboutPage() {
  return (
    <div style={{ display: "grid", gap: "2rem" }}>
      <section className="card">
        <h1 style={{ marginBottom: "1rem" }}>About SomaliNotes Platform</h1>
        <p style={{ opacity: 0.85, maxWidth: "70ch" }}>
          This project turns lecture videos into readable Somali learning
          materials. The frontend is built with Next.js, the backend runs on
          FastAPI, and long-running processing tasks move through a background
          worker pipeline.
        </p>
      </section>

      <section
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        {workflow.map((item) => (
          <article className="card" key={item.title}>
            <h2 style={{ marginBottom: "0.75rem", fontSize: "1.15rem" }}>
              {item.title}
            </h2>
            <p style={{ opacity: 0.8 }}>{item.description}</p>
          </article>
        ))}
      </section>

      <section className="card">
        <h2 style={{ marginBottom: "1rem" }}>Core stack</h2>
        <p style={{ opacity: 0.8, marginBottom: "1rem" }}>
          Next.js powers the UI, FastAPI handles API requests, SQLite stores
          app data locally, and Celery tracks background processing status.
        </p>
        <Link href="/sign-up" className="btn" style={{ display: "inline-block" }}>
          Create an account
        </Link>
      </section>
    </div>
  );
}
