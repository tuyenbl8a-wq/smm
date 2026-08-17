import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Phase 1 Skeleton</p>
        <h1>SMM Panel</h1>
        <p>
          Project scaffolding is ready. The next phases will add authentication,
          wallet ledger, payments, services, providers, orders, automation, and dashboards.
        </p>
        <div className="cards">
          <article>
            <strong>API</strong>
            <span>Health endpoint: /health</span>
          </article>
          <article>
            <strong>Database</strong>
            <span>PostgreSQL service in Docker Compose</span>
          </article>
          <article>
            <strong>Queue</strong>
            <span>Redis service prepared for workers</span>
          </article>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
