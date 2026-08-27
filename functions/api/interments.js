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
