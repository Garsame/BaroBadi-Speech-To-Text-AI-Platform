const noteSections = [
  "Latest generated Somali summaries",
  "Pinned study guides",
  "Notes grouped by lecture subject",
];

export default function NotesLibraryPage() {
  return (
    <div>
      <h1>Notes Library</h1>
      <p style={{ marginTop: "0.75rem", opacity: 0.8, maxWidth: "65ch" }}>
        This section is ready for the generated notes archive. It can be wired
        to the backend once note records are exposed directly in the dashboard
        API.
      </p>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          marginTop: "2rem",
        }}
      >
        {noteSections.map((item) => (
          <div className="card" key={item}>
            <h2 style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>{item}</h2>
            <p style={{ opacity: 0.75 }}>
              Placeholder panel for the next round of dashboard work.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
