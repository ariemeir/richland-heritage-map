import Papa from "papaparse";
import { SHEET_CSV_URL } from "../config.js";

const BUNDLED_WHO_URL = "/data/seed-who.csv";

function parseCsvText(text) {
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  const map = new Map();
  for (const row of data) {
    const id = Number(row.interment_id);
    if (!Number.isFinite(id)) continue;
    map.set(id, {
      intermentId: id,
      displayName: (row.display_name || "").trim(),
      themes: (row.themes || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      birthDisplay: (row.birth_display || "").trim(),
      deathDisplay: (row.death_display || "").trim(),
      bio: (row.bio || "").trim(),
      family: (row.family || "").trim(),
      occupation: (row.occupation || "").trim(),
      community: (row.community || "").trim(),
      militaryDetail: (row.military_detail || "").trim(),
      portraitUrl: (row.portrait_url || "").trim(),
      isHero: String(row.is_hero || "").trim().toUpperCase() === "TRUE",
      whoStatus: (row.who_status || "").trim(),
    });
  }
  return map;
}

async function fetchCsv(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`WHO CSV fetch failed: ${res.status}`);
  return res.text();
}

// Loads the WHO overlay: the published Google Sheet CSV if configured, falling
// back to the bundled seed CSV on any failure (missing config, network error,
// bad parse). This keeps the app runnable before a Sheet is wired up.
export async function loadWho() {
  if (SHEET_CSV_URL) {
    try {
      const text = await fetchCsv(SHEET_CSV_URL);
      return parseCsvText(text);
    } catch (err) {
      console.warn("SHEET_CSV_URL fetch failed, falling back to bundled seed-who.csv:", err);
    }
  }
  const text = await fetchCsv(BUNDLED_WHO_URL);
  return parseCsvText(text);
}
