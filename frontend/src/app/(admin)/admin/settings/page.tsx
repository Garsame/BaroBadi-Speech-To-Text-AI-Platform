export default function AdminSettingsPage() {
  return (
    <div style={{ maxWidth: "720px" }}>
      <h1>System Settings</h1>
      <p style={{ marginTop: "0.75rem", opacity: 0.8 }}>
        This route now resolves correctly and can be used for environment,
        queue, or feature-flag controls when you are ready to expand the admin
        tools.
      </p>

      <section className="card" style={{ marginTop: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Recommended next settings</h2>
        <p style={{ opacity: 0.8 }}>
          API base URL, worker concurrency, allowed upload formats, and model
          configuration.
        </p>
      </section>
    </div>
  );
}
