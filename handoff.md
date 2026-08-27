# Handoff — Richland Cemetery Connected History (v1 Prototype)

Status as of 2026-08-27: **built and deployed, acceptance criteria verified.**

## Live deployment

- URL: https://richland-cemetery-prototype.pages.dev
- Access code: `taproot` (server-side gate in `functions/_middleware.js`, casual protection only — not hardened security, per brief)
- Pages project name: `richland-cemetery-prototype`
- Deployed under Arie's Cloudflare account. Credentials aren't in this repo — whoever
  redeploys needs their own `wrangler login` (or to be added as a collaborator on the
  existing Cloudflare account/project).

To redeploy after changes, from a machine authenticated via `wrangler whoami`:
```zsh
npm run build
npx wrangler pages deploy dist --project-name richland-cemetery-prototype
```
This publishes to a new unique preview URL each time; the stable production alias
(`richland-cemetery-prototype.pages.dev`) always points at the latest deploy.

To stand up a fresh copy under a different Cloudflare account instead, see
"Running it yourself" in `README.md` — same build, different `--project-name`.

## What this is

Built from `brief.md` in this repo (self-contained build spec). Full context/origin
story is in `richland_cemetery_project_background.txt`. Fuses two data sources in the
browser, keyed by `INTERMENT_ID`:

- **WHERE**: live City of Greenville GIS layer (`citygis.greenvillesc.gov`), queried
  through a same-origin proxy — never copied into the app, no build-time snapshot.
- **WHO**: a thin narrative overlay (13-column CSV), bundled locally as
  `public/data/seed-who.csv`, with a config seam (`src/config.js` → `SHEET_CSV_URL`)
  to swap in a published Google Sheet CSV later with zero code changes.

Stack: Vite + React, Leaflet, Papa Parse, `qrcode`. Cloudflare Pages + 2 Pages
Functions (`functions/_middleware.js` access gate, `functions/api/interments.js` GIS
proxy).

## Seed people (real IDs, synthetic bios)

Picked live from the GIS layer per the brief's seed strategy (Section 4). All names,
dates, section/lot, and veteran flags are real City records; bios are synthetic and
labeled `ILLUSTRATIVE`.

| INTERMENT_ID | Name | Themes | Note |
|---|---|---|---|
| 173 | Claude Sullivan | veterans, camp_sevier | **Hero.** Headstone photo (real, City-sourced) literally reads "PVT 156 DEPOT BRIGADE, WORLD WAR I" — corroborates the illustrative WWI narrative by coincidence, not by design. |
| 174 | Ernest McBee | veterans | |
| 76 | Alberta L. Brockman | teachers, families | |
| 11 | J. Pickens Chappell | families | |
| 82 | Mary Seawright | women, families | |
| 600 | Jeanette Seaborn White | women, teachers | |

To add more seeded people: query `/api/interments`, pick a real `INTERMENT_ID`, add a
row to `public/data/seed-who.csv` (or the published Google Sheet once wired up) with
`who_status=ILLUSTRATIVE` and honest, clearly-labeled placeholder content — see the
labeling rule in `brief.md` Section 4.

## File map

```
functions/_middleware.js     access-code gate (edge-checked, cookie-based)
functions/api/interments.js  same-origin proxy to City GIS, edge-cached 1h
src/config.js                SHEET_CSV_URL (empty = bundled CSV), CF_PROJECT_NAME
src/lib/interments.js        GIS fetch + name/date resolution (BR_ > GPS_ > NAME_FOR_SEARCH) + retry
src/lib/who.js                WHO CSV loader (Sheet or bundled), Papa Parse
src/components/MapView.jsx   Leaflet map, marker styling, theme highlighting
src/components/TopBar.jsx    search + theme chips
src/components/RecordPanel.jsx  seeded-person slide-in panel, QR generation
src/components/Footer.jsx    persistent two-source disclaimer
src/App.jsx                  data loading, join, deep-link handling, state
public/data/seed-who.csv     the WHO overlay fallback (6 seeded records)
```

## Known issues / fixes already applied

- **Leaflet tile fade-in can stick at opacity 0** if `requestAnimationFrame` stalls
  (backgrounded tabs, low-power mode, some automation contexts) — tiles never appear
  even though they loaded successfully. Fixed by setting `fadeAnimation: false` on the
  map (`MapView.jsx`). Confirmed via browser inspection before the fix (tiles loaded,
  `opacity: 0` inline style stuck permanently) and after (renders immediately).
- **Transient 521 from `/api/interments`** was reported once in production. Root
  cause: the City of Greenville's own GIS origin was briefly unreachable — outside our
  control, and it recovered on its own (verified with repeated 200s afterward).
  Hardened anyway: `loadInterments()` now retries twice with a 1.5s backoff, and the
  error screen has a "Try again" button instead of requiring a manual reload.

## Not yet done

- `SHEET_CSV_URL` in `src/config.js` is empty — the app runs on the bundled
  `seed-who.csv`. To make WHO content live-editable: new Google Sheet → paste the CSV
  → File > Share > Publish to web > CSV → paste that URL into `SHEET_CSV_URL` →
  rebuild → redeploy.
- No CI — every deploy is manual (`npm run build && wrangler pages deploy dist`).
- No monitoring/alerting on the City GIS origin's availability.

## Explicitly out of scope for v1 (do not build without a new brief)

Turn-by-turn/multi-stop tour routing; the full ~50-field relational data model
(consultant deliverable); real researched biographies; an evidence/document layer
(documents, certificates, photos with provenance — the panel's "Historical Records"
section is a placeholder seam for this); NFC/physical hardware; write-back/editing;
user accounts; Springwood cemetery. Full detail in `brief.md` Sections 1 and 10.

## Suggested next steps

1. Show this to the "Taproot" consultants / VISTA team per the project background —
   the access code is literally their name, not a coincidence.
2. Decide whether to wire up the Google Sheet now so non-technical volunteers can
   edit WHO content without a redeploy.
3. If this moves toward the real relational data model, treat the current
   `seed-who.csv` schema as disposable scaffolding, not a foundation to extend.
