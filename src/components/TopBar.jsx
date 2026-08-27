import { useMemo, useState } from "react";

const THEME_CHIPS = [
  { key: "veterans", label: "Veterans", live: true },
  { key: "families", label: "Families" },
  { key: "teachers", label: "Teachers" },
  { key: "women", label: "Women" },
  { key: "camp_sevier", label: "Camp Sevier" },
];

function matches(rec, query) {
  const q = query.toLowerCase();
  return (
    rec.nameForSearch.toLowerCase().includes(q) ||
    rec.gpsFullname.toLowerCase().includes(q) ||
    rec.brFullname.toLowerCase().includes(q) ||
    rec.name.toLowerCase().includes(q)
  );
}

export default function TopBar({ records, activeTheme, onToggleTheme, onPickResult }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    return records.filter((r) => matches(r, query.trim())).slice(0, 20);
  }, [records, query]);

  return (
    <div className="topbar">
      <h1>
        Richland Cemetery
        <small>Connected History — Prototype</small>
      </h1>

      <div className="search-box">
        <input
          type="text"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query.trim().length >= 2 && (
          <div className="search-results">
            {results.length === 0 && <div className="muted">No matches.</div>}
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onPickResult(r.id);
                  setQuery("");
                }}
              >
                {r.name}
                {r.who ? " ★" : ""}
                {[r.birthDisplay, r.deathDisplay].filter(Boolean).length > 0 && (
                  <span style={{ color: "#6b6455" }}>
                    {" "}
                    ({[r.birthDisplay, r.deathDisplay].filter(Boolean).join("–")})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="chips">
        {THEME_CHIPS.map((chip) => (
          <button
            key={chip.key}
            className={`chip${chip.live ? " live" : ""}${activeTheme === chip.key ? " active" : ""}`}
            onClick={() => onToggleTheme(chip.key)}
            title={chip.live ? "Live — derived from the City's real military flag" : undefined}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
