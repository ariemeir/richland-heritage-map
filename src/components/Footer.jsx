export default function Footer() {
  return (
    <div className="footer">
      Grave locations and identities: live data from the{" "}
      <a
        href="https://citygis.greenvillesc.gov/arcgis/rest/services/Cemetery/CemeteryVectorCacheWGS/MapServer/1"
        target="_blank"
        rel="noreferrer"
      >
        City of Greenville GIS
      </a>
      . Stories and themes: a prototype "WHO" overlay layered on top. Biographical
      narrative in this demo is synthetic and illustrative — not verified history.
    </div>
  );
}
