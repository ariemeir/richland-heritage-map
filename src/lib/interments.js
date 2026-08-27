// Fetches the live City of Greenville GIS interments layer (via the same-origin
// proxy function) and resolves the messy GPS_/BR_ field pairs down to clean,
// display-ready values per the brief's name/date resolution rule:
// prefer BR_ (burial record), fall back to GPS_ (survey), then NAME_FOR_SEARCH.
// Never show an empty field; callers should skip blank rows.

function firstNonBlank(...values) {
  for (const v of values) {
    if (v !== null && v !== undefined && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function resolveName(p) {
  return firstNonBlank(p.BR_FULLNAME, p.GPS_FULLNAME, p.NAME_FOR_SEARCH) || "Unknown";
}

function resolveBirthDisplay(p) {
  return firstNonBlank(p.GPS_BIRTHDATE);
}

function resolveDeathDisplay(p) {
  return firstNonBlank(p.BR_DEATH_DATE, p.GPS_DEATHDATE);
}

function resolveBurialDisplay(p) {
  return firstNonBlank(p.BR_BURIAL_DATE);
}

function resolveLocation(p) {
  const survey = firstNonBlank(p.GPS_SECTIONNUM) &&
    `Section ${p.GPS_SECTIONNUM}${firstNonBlank(p.GPS_LOTNUM) ? `, Lot ${p.GPS_LOTNUM}` : ""}`;
  const record = firstNonBlank(p.BR_SECTION_NO) &&
    `Section ${p.BR_SECTION_NO}${firstNonBlank(p.BR_LOT_PLOTNUM) ? `, Lot ${p.BR_LOT_PLOTNUM}` : ""}${
      firstNonBlank(p.BR_GRAVE) ? `, Grave ${p.BR_GRAVE}` : ""
    }`;
  return firstNonBlank(record, survey);
}

function resolvePhoto(p) {
  return firstNonBlank(p.PHOTOPATH, p.PHOTOLINK) || null;
}

export function normalizeFeature(feature) {
  const p = feature.properties || {};
  const [lon, lat] = feature.geometry?.coordinates || [null, null];
  const isVeteran = p.GPS_MILITARY === "YES" || p.BR_MILITARY === "YES";
  return {
    id: p.INTERMENT_ID,
    lon,
    lat,
    name: resolveName(p),
    nameForSearch: firstNonBlank(p.NAME_FOR_SEARCH),
    gpsFullname: firstNonBlank(p.GPS_FULLNAME),
    brFullname: firstNonBlank(p.BR_FULLNAME),
    birthDisplay: resolveBirthDisplay(p),
    deathDisplay: resolveDeathDisplay(p),
    burialDisplay: resolveBurialDisplay(p),
    location: resolveLocation(p),
    isVeteran,
    gender: firstNonBlank(p.BR_GENDER),
    race: firstNonBlank(p.BR_RACE),
    spouse: firstNonBlank(p.GPS_SPOUSENAME),
    photoUrl: resolvePhoto(p),
    matchType: firstNonBlank(p.BR_MATCHTYPE),
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The City GIS origin behind /api/interments occasionally returns a transient
// 5xx (e.g. Cloudflare 521 when the origin is briefly unreachable). Retry a
// couple of times with a short backoff before giving up.
export async function loadInterments(retries = 2, backoffMs = 1500) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch("/api/interments");
      if (!res.ok) throw new Error(`Interments fetch failed: ${res.status}`);
      const geojson = await res.json();
      const features = geojson.features || [];
      return features
        .filter((f) => f.geometry && Array.isArray(f.geometry.coordinates))
        .map(normalizeFeature)
        .filter((r) => r.id !== undefined && r.id !== null);
    } catch (err) {
      lastError = err;
      if (attempt < retries) await sleep(backoffMs);
    }
  }
  throw lastError;
}
