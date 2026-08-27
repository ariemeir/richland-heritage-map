# Richland Cemetery Connected History, v1 Prototype
## Technical build brief for Claude Code

This brief is self-contained. It gives you the exact data endpoint, field schema,
app behavior, deployment steps, and access-gate code needed to build and publicly
deploy a working prototype without further input. Follow the build sequence at the
end in order. Where a real value must be discovered at runtime (seed records, photo
reachability), the brief tells you how to discover it.

Target runtime for you (the agent): Sonnet is sufficient. Do not over-engineer.
Prefer the simplest thing that satisfies each requirement.

---

## 1. What this prototype proves

Historic Richland Cemetery in Greenville, South Carolina has a strong geographic
foundation already: the City of Greenville publishes grave locations, names, dates,
and section/lot codes through a public GIS service. What it lacks is the "who": the
reconstructed lives, families, and stories of the people buried there.

v1 proves one thesis and nothing more: that the City's real "WHERE" can be fused with
a lightweight "WHO" layer into a single experience where a visitor searches a topic,
sees real graves on a real map, taps one, and reads that person's story. That single
loop (search, map, pin, record) is the entire point of the demo.

This is a pitch-quality prototype, not a production system. Polish the surface a
viewer sees. Keep the plumbing honest and basic.

### In scope for v1
- A real map of Richland Cemetery with real grave points pulled live from the City GIS.
- A search box that finds people by name.
- Theme chips that highlight thematic groups. One theme ("Veterans") is computed live
  from a real City field, not from seed data.
- A rich record panel for a small set of seeded people, styled after the project deck.
- A basic popup for every other real grave showing City data only.
- Per-record QR codes and deep links, to demonstrate the future scan-at-grave flow.
- Public deployment behind a shared access code.

### Explicitly out of scope for v1 (do not build)
- Turn-by-turn or multi-stop walking-tour routing.
- The full ~50-field relational data model (that is the eventual consultant deliverable).
- Real researched biographies (v1 biographies are synthetic and labeled as such).
- An evidence/document layer (that is v2, with synthetic evidence).
- NFC, physical hardware, editing/write-back, user accounts, Springwood cemetery.

---

## 2. Architecture at a glance

Two data sources with different roles, joined in the browser by a stable key:

- WHERE: the live City of Greenville GIS layer. Never copied into the app. Queried at
  runtime. Provides coordinates, real names, dates, section/lot, veteran flag, headstone
  photo reference, and a match-confidence field. Join key: `INTERMENT_ID`.
- WHO: a thin overlay keyed by `INTERMENT_ID`. Holds only the narrative the City does
  not have (bio, family, occupation, community, themes). Sourced from a Google Sheet
  published as CSV, with a bundled local CSV fallback so the app runs before the Sheet
  is wired up.

Stack: Vite + React, Leaflet for mapping, Papa Parse for CSV. Hosted on Cloudflare
Pages. Two Pages Functions: an auth-gate middleware and an ArcGIS proxy. The proxy
makes the GIS call same-origin so there are no CORS surprises and the response can be
edge-cached.

```
Browser (gated by access code)
  -> GET /api/interments      (Pages Function proxies City GIS, returns GeoJSON)
  -> GET WHO CSV              (Google Sheet published CSV, or bundled local CSV)
  -> join by INTERMENT_ID, render map + records
```

---

## 3. The GIS data source (this is the spine, use it exactly)

Service (public, no token required, confirmed reachable):

```
https://citygis.greenvillesc.gov/arcgis/rest/services/Cemetery/CemeteryVectorCacheWGS/MapServer
```

Layers in that service:
- 0: Richland Cemetery (boundary)
- 1: Richland Interments (POINT features, ~836 records) <- primary layer, use this
- 2: Richland Plots (polygons, optional context)
- 3: Richland Sections (polygons, optional context)
- 4-8: Springwood cemetery (ignore for v1)
- 9: CemeteryBoundaries

Primary layer for v1:

```
https://citygis.greenvillesc.gov/arcgis/rest/services/Cemetery/CemeteryVectorCacheWGS/MapServer/1
```

Key facts confirmed from the layer metadata:
- Geometry: points, spatial reference 4326 (WGS84 lon/lat), so coordinates drop
  straight into Leaflet with no reprojection. Request `outSR=4326` to be safe.
- MaxRecordCount is 1000 and there are ~836 Richland interments, so a single query
  returns every grave. No paging needed.
- Supported formats include GeoJSON. Request `f=geojson` and you get standard GeoJSON
  FeatureCollection with `geometry` (Point, [lon, lat]) and `properties`.
- No authentication. The query endpoint is publicly accessible.

### The one query you need

Full interments pull as GeoJSON, all records, WGS84:

```
https://citygis.greenvillesc.gov/arcgis/rest/services/Cemetery/CemeteryVectorCacheWGS/MapServer/1/query?where=1%3D1&outFields=INTERMENT_ID%2CNAME_FOR_SEARCH%2CGPS_FULLNAME%2CBR_FULLNAME%2CGPS_BIRTHDATE%2CGPS_DEATHDATE%2CBR_DEATH_DATE%2CBR_BURIAL_DATE%2CGPS_SECTIONNUM%2CGPS_LOTNUM%2CBR_SECTION_NO%2CBR_LOT_PLOTNUM%2CBR_GRAVE%2CGPS_MILITARY%2CBR_MILITARY%2CBR_GENDER%2CBR_RACE%2CGPS_SPOUSENAME%2CPHOTOPATH%2CPHOTOLINK%2CGPS_PHOTOLINK%2CBR_MATCHTYPE&returnGeometry=true&outSR=4326&f=geojson
```

Serve this through the proxy function (Section 6) so the browser calls `/api/interments`.

### Field reference (the fields that matter)

| Field | Meaning | Use |
|---|---|---|
| INTERMENT_ID | Stable integer id per grave | Join key to the WHO layer; deep-link id |
| NAME_FOR_SEARCH | City's own search/display name | Primary display + search target |
| GPS_FULLNAME / BR_FULLNAME | Full name (headstone survey / burial record) | Prefer BR_FULLNAME, fall back to GPS_FULLNAME, then NAME_FOR_SEARCH |
| GPS_BIRTHDATE / GPS_DEATHDATE | Date strings from headstone | Display dates |
| BR_DEATH_DATE / BR_BURIAL_DATE | Date strings from burial record | Display dates when GPS blank |
| GPS_SECTIONNUM + GPS_LOTNUM | Section and lot (survey) | Location label |
| BR_SECTION_NO + BR_LOT_PLOTNUM + BR_GRAVE | Section, lot, grave (record) | Location label when GPS blank |
| GPS_MILITARY / BR_MILITARY | 'YES' / 'NO' veteran flag | Drives the live "Veterans" theme |
| BR_GENDER | M / F / U | Optional display |
| BR_RACE | Race string | Optional display |
| GPS_SPOUSENAME | Spouse name | Optional display |
| PHOTOPATH / PHOTOLINK / GPS_PHOTOLINK | Headstone photo references | Headstone image if reachable (probe first, Section 5) |
| BR_MATCHTYPE | GPS ONLY / GPS_AND_BR / SECTION AND LOT | Show as a small "data source" tag; demonstrates provenance |

Name/date resolution rule: for any displayed name or date, prefer the BR_ (burial
record) value, fall back to the GPS_ (survey) value, then to NAME_FOR_SEARCH. Never
show an empty field; hide the row if all sources are blank.

Optional context layers (only if trivial): layer 3 (Richland Sections) polygons can be
drawn as faint outlines to give the map structure. Skip if it adds friction.

---

## 4. The WHO data (thin overlay, keyed by INTERMENT_ID)

The WHO layer is deliberately not the 50-field model. It is a flat table of narrative
fields that overlay the City's structured WHERE. Building the full relational schema now
would be building the very thing the consultant is meant to design later.

### WHO CSV schema (these are the exact column headers)

```
interment_id,display_name,themes,birth_display,death_display,bio,family,occupation,community,military_detail,portrait_url,is_hero,who_status
```

Column notes:
- interment_id: real integer from the City layer. This is the join key.
- display_name: the real name from the City data (do not invent names).
- themes: comma-separated, from this controlled set: veterans, families, teachers,
  women, camp_sevier. Drives the non-live theme chips.
- birth_display, death_display: human-friendly dates.
- bio: one narrative paragraph. SYNTHETIC in v1. See labeling rule below.
- family, occupation, community, military_detail: short strings, synthetic, may be blank.
- portrait_url: optional; leave blank and let the UI fall back to the headstone photo
  or a neutral placeholder.
- is_hero: TRUE for exactly one record (the showcase), FALSE otherwise.
- who_status: for v1 always the literal string `ILLUSTRATIVE` so the UI can render a
  clear badge.

### Seed strategy (do this, do not fabricate names)

1. After you can query the layer, pull the interments once.
2. Pick a hero: prefer a record where GPS_MILITARY or BR_MILITARY is 'YES' and, if the
   photo probe succeeds, one with a reachable headstone photo. This echoes the veteran
   hero in the project deck. Use that person's real INTERMENT_ID, real name, real dates,
   real section/lot, and real coordinates.
3. Pick about five more real records spread across themes: another veteran or two (real,
   via the military flag), and a few non-veterans with clean names and dates. Record
   their real INTERMENT_IDs.
4. Generate `public/data/seed-who.csv` with those real INTERMENT_IDs and synthetic,
   clearly-labeled WHO content (`who_status=ILLUSTRATIVE`). Assign themes per person.

### Labeling rule (important, non-negotiable)

This is a real cemetery of real people, and a historically significant African American
cemetery specifically. Names, dates, coordinates, section/lot, and veteran flags are
real City records and may be shown as fact. Biographies in v1 are invented and must
never read as verified history. Every record panel that shows a synthetic bio must
display a clear badge, for example: "Illustrative profile. Biographical narrative is
placeholder content for this prototype and is not verified history. Grave location and
identity are real City of Greenville records." A persistent footer must carry the same
two-source disclaimer. The "Veterans" theme uses only the real military flag, so it
involves no fabrication.

### Google Sheet wiring (the intended v1 database)

The app reads WHO from a Google Sheet published as CSV when a URL is configured, and
otherwise from the bundled `public/data/seed-who.csv`. Provide a single config value
`SHEET_CSV_URL` in `src/config.js`:

```js
// src/config.js
export const SHEET_CSV_URL = ""; // paste the Google Sheet "publish to web" CSV URL here; empty = use bundled seed-who.csv
export const CF_PROJECT_NAME = "richland-cemetery-prototype";
```

Loader behavior: if `SHEET_CSV_URL` is non-empty, fetch and parse it; on any failure,
log a warning and fall back to the bundled CSV. This lets the app run immediately and
lets Arie later swap in a live-editable Sheet by pasting one URL. To create the Sheet:
new Sheet, paste the generated CSV, File > Share > Publish to web > CSV, copy the URL
into `SHEET_CSV_URL`.

---

## 5. Photo strategy (probe, do not block)

The interment records carry headstone photo references (PHOTOPATH, PHOTOLINK,
GPS_PHOTOLINK). It is not yet known whether these resolve to publicly reachable image
URLs or need a base-path prefix.

Step: after the first successful interments pull, take one record with a non-empty
photo field, construct the most likely URL, and test whether it returns an image. If it
resolves, use headstone photos in popups and record panels. If it does not resolve
after one reasonable attempt, use a neutral headstone silhouette placeholder and move on.
Do not spend build time chasing this; the demo works either way.

---

## 6. Cloudflare deployment (Pages + Functions)

Target: a publicly reachable URL, gated by a shared access code. Deploy with wrangler
using the auth already present in this environment.

### Project layout

```
richland-cemetery-prototype/
  functions/
    _middleware.js          # access-code gate for ALL routes
    api/
      interments.js         # server-side proxy to the City GIS
  public/
    data/
      seed-who.csv          # generated WHO fallback
  src/                      # Vite React app
  index.html
  package.json
  vite.config.js
```

Vite builds to `dist/`. Deploy `dist/` as the Pages static output; the `functions/`
directory is picked up by Pages automatically when you deploy the project root, so use
`wrangler pages deploy dist` with the functions directory present at the root (Pages
reads `./functions` relative to the project). If your wrangler version requires it, add
a minimal `wrangler.toml` with `pages_build_output_dir = "dist"`.

### Access gate: functions/_middleware.js (verbatim)

Server-side gate. The code is checked at the edge, not shipped in the client bundle.
This is casual protection appropriate for a pitch, not hardened security.

```js
const ACCESS_CODE = "taproot";
const COOKIE = "rc_auth";

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  // Login submission
  if (request.method === "POST" && url.pathname === "/__auth") {
    const form = await request.formData();
    const code = (form.get("code") || "").toString().trim().toLowerCase();
    if (code === ACCESS_CODE) {
      return new Response(null, {
        status: 302,
        headers: {
          "Set-Cookie": `${COOKIE}=ok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,
          "Location": "/",
        },
      });
    }
    return gate("That code was not recognized. Please try again.");
  }

  const cookie = request.headers.get("Cookie") || "";
  if (cookie.split(";").some((c) => c.trim() === `${COOKIE}=ok`)) {
    return next();
  }
  return gate();
}

function gate(message = "") {
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Richland Connected History</title>
<style>
  body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:Georgia,serif;background:#1f3a2e;color:#f3ead6}
  .card{background:#f3ead6;color:#1f3a2e;padding:2.2rem 2rem;border-radius:10px;
    width:320px;box-shadow:0 10px 40px rgba(0,0,0,.35);text-align:center}
  h1{font-size:1.2rem;margin:.2rem 0 1rem}
  input{width:100%;padding:.6rem;border:1px solid #b7a97f;border-radius:6px;
    font-size:1rem;box-sizing:border-box}
  button{margin-top:.9rem;width:100%;padding:.6rem;border:0;border-radius:6px;
    background:#c8a028;color:#1f3a2e;font-weight:bold;font-size:1rem;cursor:pointer}
  .msg{color:#8a2b2b;font-size:.85rem;margin-top:.6rem;min-height:1rem}
</style></head><body>
  <form class="card" method="POST" action="/__auth">
    <h1>Richland Connected History</h1>
    <input name="code" type="password" placeholder="Access code" autofocus>
    <button type="submit">Enter</button>
    <div class="msg">${message}</div>
  </form>
</body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
```

### ArcGIS proxy: functions/api/interments.js (verbatim)

Same-origin to the browser, server-side to the City GIS, edge-cached one hour.

```js
export async function onRequest() {
  const base =
    "https://citygis.greenvillesc.gov/arcgis/rest/services/Cemetery/CemeteryVectorCacheWGS/MapServer/1/query";
  const params = new URLSearchParams({
    where: "1=1",
    outFields: [
      "INTERMENT_ID","NAME_FOR_SEARCH","GPS_FULLNAME","BR_FULLNAME",
      "GPS_BIRTHDATE","GPS_DEATHDATE","BR_DEATH_DATE","BR_BURIAL_DATE",
      "GPS_SECTIONNUM","GPS_LOTNUM","BR_SECTION_NO","BR_LOT_PLOTNUM","BR_GRAVE",
      "GPS_MILITARY","BR_MILITARY","BR_GENDER","BR_RACE","GPS_SPOUSENAME",
      "PHOTOPATH","PHOTOLINK","GPS_PHOTOLINK","BR_MATCHTYPE",
    ].join(","),
    returnGeometry: "true",
    outSR: "4326",
    f: "geojson",
  });
  const r = await fetch(`${base}?${params.toString()}`);
  const body = await r.text();
  return new Response(body, {
    status: r.status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
```

### Deploy commands (zsh)

Run from the project root. Confirm auth first; do not assume it.

```zsh
node -v
wrangler whoami   # if this errors, run: wrangler login  (or export CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID)

npm install
npm run build     # produces ./dist

# First deploy creates the Pages project if it does not exist
wrangler pages deploy dist --project-name richland-cemetery-prototype
```

The command prints the public URL. That URL, plus the code `taproot`, is the deliverable.

---

## 7. App behavior (UX spec)

Look and feel: echo the project deck. Dark green and gold, serif headings, a parchment
record panel. Aim for "convincing pitch artifact," not a rough stub.

Map:
- Full-window Leaflet map centered on Richland Cemetery. Center approximately
  lon -82.3869, lat 34.8567; initial zoom about 18. The layer extent is roughly
  lon -82.3883 to -82.3855, lat 34.8559 to 34.8574; fit to the returned features.
- Basemap: Esri World Imagery tiles for the aerial look of the deck:
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
  Include the required Esri attribution.
- Every interment renders as a small, low-opacity circle marker. This faint layer is the
  visual argument that WHERE exists for hundreds of graves while WHO is still pending.
- Seeded interments (those present in the WHO data) render as larger, gold, prominent
  markers: the "connected" layer.

Top bar:
- Title, a search box, and theme chips: Veterans (live), Families, Teachers, Women,
  Camp Sevier.

Search:
- Matches against NAME_FOR_SEARCH and the full-name fields, case-insensitive substring.
- On match, pan and zoom to the result and highlight it. If it is a seeded person, open
  the record panel.

Themes:
- Veterans chip is LIVE: it highlights every real grave where GPS_MILITARY or BR_MILITARY
  is 'YES'. This demonstrates that the City's structured data already supports thematic
  tours with no extra research.
- Other chips filter the seeded WHO records by their `themes` column.

Record panel (seeded people):
- Slides in from the right. Parchment/gold, styled after the deck's person card.
- Sections mirroring the deck where data exists: name and dates header, Family, Military
  Service, Residence/Occupation, Community, and a "Historical Records" placeholder area.
- Portrait if `portrait_url` is set, else the headstone photo if reachable, else a neutral
  placeholder.
- A small "data source" tag from BR_MATCHTYPE.
- The prominent ILLUSTRATIVE badge and disclaimer text (Section 4 labeling rule).
- A QR code (generate client-side) encoding the deep link to this record; caption it
  "Scan at the grave" to convey the future flow.

Basic popup (every non-seeded grave):
- A small Leaflet popup with City data only: resolved name, dates, section/lot, and a
  line "Historical profile not yet researched." This honest default is itself part of the
  story: most graves have a WHERE and await a WHO.

Deep linking:
- `?id=<INTERMENT_ID>` opens the app focused on that grave and, if seeded, opens its
  record panel. This is exactly what the QR encodes.

Footer/legend:
- Persistent, small. Explains the two sources (City of Greenville GIS for locations and
  identities; prototype WHO overlay for narrative) and carries the synthetic-content
  disclaimer.

---

## 8. Build sequence (do in this order)

1. Preflight. `node -v`; `wrangler whoami` (if unauthenticated, stop and tell the user to
   run `wrangler login` or set `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`). Sanity-
   check the GIS: curl the Section 3 query URL and confirm a FeatureCollection with a few
   hundred features comes back.
2. Scaffold the Vite React app; add Leaflet and Papa Parse; add `src/config.js`.
3. Render the map at the Richland extent with the Esri imagery basemap.
4. Add `functions/api/interments.js`; fetch `/api/interments`; render all graves as faint
   markers; fit bounds to the data.
5. Probe one headstone photo (Section 5); decide photo strategy.
6. From the live data, pick the hero and about five more real people (Section 4 seed
   strategy); generate `public/data/seed-who.csv` with real INTERMENT_IDs and synthetic,
   `ILLUSTRATIVE`-labeled WHO.
7. Build the WHO loader (Sheet CSV if `SHEET_CSV_URL` set, else bundled CSV); join to
   interments by INTERMENT_ID; upgrade seeded graves to prominent markers.
8. Build the record panel (deck aesthetic, hero record, disclaimer badge) and the basic
   popup for non-seeded graves.
9. Add search and theme chips; wire the live Veterans theme to the real military flag.
10. Add deep-linking (`?id=`) and per-record QR generation.
11. Add `functions/_middleware.js` (Section 6, code = taproot).
12. `npm run build`, then `wrangler pages deploy dist --project-name richland-cemetery-prototype`.
13. Verify against the acceptance criteria; print the public URL and the access code.

---

## 9. Acceptance criteria

- Visiting the deployed URL shows the access gate; entering `taproot` grants access; a
  wrong code is rejected.
- After entry, a real aerial map of Richland Cemetery loads with hundreds of real grave
  markers pulled live from the City GIS through `/api/interments`.
- Typing a real interred name finds and highlights that grave.
- The Veterans chip highlights real veteran graves derived from the City military flag.
- Clicking a seeded grave opens a deck-styled record panel with a QR code and a clearly
  visible ILLUSTRATIVE disclaimer.
- Clicking a non-seeded grave shows a City-data-only popup noting research is pending.
- Opening `<url>?id=<INTERMENT_ID>` for a seeded person deep-links straight to that record.
- A persistent footer carries the two-source disclaimer.

---

## 10. v2 (context only, do not build now)

Synthetic evidence layer (documents, certificates, photographs) attached to WHO records
with provenance; replacement of synthetic biographies with real sourced research; the
fuller relational data model; multi-stop tour routing. v1 must leave clean seams for
these without implementing them.

---

## 11. Values the user supplies

- Cloudflare wrangler auth in the environment (`wrangler whoami` must succeed).
- Optional `SHEET_CSV_URL` in `src/config.js` once a Google Sheet is published; until
  then the bundled `seed-who.csv` is used automatically.
- Access code is fixed as `taproot` in the middleware per request.
