import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const COUNTS = [
  { key: "categories", label: "Categories", table: "categories", note: "Portfolio groups" },
  { key: "videos", label: "Videos", table: "videos", note: "Video records" },
  { key: "experience", label: "Experience", table: "experience", note: "Career entries" },
  { key: "tools", label: "Tools", table: "tools", note: "Software tools" },
];

export default function Overview() {
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadCounts() {
      const results = await Promise.all(COUNTS.map(async ({ key, table }) => {
        const { count, error: queryError } = await supabase.from(table).select("id", { count: "exact", head: true });
        return [key, { count, error: queryError }];
      }));
      if (!active) return;
      const nextCounts = Object.fromEntries(results.map(([key, result]) => [key, result.count]));
      setCounts(nextCounts);
      const unavailable = results.filter(([, result]) => result.error).map(([key]) => key);
      if (unavailable.length) setError(`Some counts are unavailable (${unavailable.join(", ")}). Confirm the Phase 1 migration is applied.`);
    }
    void loadCounts().catch(() => {
      if (active) setError("Counts could not be loaded. Check your Supabase connection and database migration.");
    });
    return () => { active = false; };
  }, []);

  return (
    <section className="admin-overview" aria-labelledby="admin-overview-title">
      <div className="admin-page-heading">
        <div><p className="admin-page-heading__eyebrow">DASHBOARD / CONTENT STATUS</p><h1 id="admin-overview-title">Good to see you.<br /><em>Here’s the snapshot.</em></h1></div>
        <span className="admin-page-heading__folio">01 — 09</span>
      </div>

      {error && <p className="admin-alert admin-alert--dashboard" role="status">{error}</p>}

      <div className="admin-stat-grid">
        {COUNTS.map((item, index) => (
          <article className="admin-stat-card" key={item.key}>
            <div className="admin-stat-card__top"><span>{String(index + 1).padStart(2, "0")}</span><span className="admin-stat-card__mark">↗</span></div>
            <strong>{counts ? (counts[item.key] ?? "—") : <span className="admin-stat-card__loading" aria-label="Loading count">—</span>}</strong>
            <h2>{item.label}</h2>
            <p>{item.note}</p>
          </article>
        ))}
      </div>

      <div className="admin-overview__note"><span>CONTENT</span><p>Choose a page from the menu to update its content, images, or design. Changes stay private until you save or publish them.</p></div>
    </section>
  );
}
