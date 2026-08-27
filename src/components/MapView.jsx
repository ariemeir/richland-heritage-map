import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import L from "leaflet";

const CENTER = [34.8567, -82.3869];
const INITIAL_ZOOM = 18;
const ESRI_IMAGERY_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community";

function styleFor(rec, activeTheme, isSelected) {
  const seeded = !!rec.who;
  let radius = seeded ? 9 : 4;
  let color = seeded ? "#c8a028" : "#f3ead6";
  let fillColor = seeded ? "#c8a028" : "#f3ead6";
  let fillOpacity = seeded ? 0.9 : 0.32;
  let weight = seeded ? 2 : 1;

  if (activeTheme === "veterans") {
    if (rec.isVeteran) {
      radius = Math.max(radius, 8);
      color = "#e0bb4a";
      fillColor = "#ff8a3d";
      fillOpacity = 0.95;
      weight = 2;
    } else {
      fillOpacity = seeded ? 0.25 : 0.1;
    }
  } else if (activeTheme) {
    if (seeded && rec.who.themes.includes(activeTheme)) {
      radius = 11;
      color = "#e0bb4a";
      fillColor = "#ff8a3d";
      fillOpacity = 0.95;
      weight = 2;
    } else if (seeded) {
      fillOpacity = 0.35;
    } else {
      fillOpacity = 0.1;
    }
  }

  if (isSelected) {
    radius += 3;
    color = "#ffffff";
    weight = 3;
  }

  return { radius, color, fillColor, fillOpacity, weight };
}

function popupHtml(rec) {
  const dateLine = [rec.birthDisplay, rec.deathDisplay].filter(Boolean).join(" – ");
  return `
    <div class="popup-name">${escapeHtml(rec.name)}</div>
    ${dateLine ? `<div class="popup-dates">${escapeHtml(dateLine)}</div>` : ""}
    ${rec.location ? `<div class="popup-location">${escapeHtml(rec.location)}</div>` : ""}
    <div class="popup-pending">Historical profile not yet researched.</div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

const MapView = forwardRef(function MapView(
  { records, activeTheme, selectedId, onSelectSeeded },
  ref
) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const recordsRef = useRef(records);
  recordsRef.current = records;

  useImperativeHandle(ref, () => ({
    panTo(id) {
      const rec = recordsRef.current.find((r) => r.id === id);
      const marker = markersRef.current.get(id);
      if (!rec || !mapRef.current) return;
      mapRef.current.setView([rec.lat, rec.lon], 19, { animate: true });
      if (marker) {
        marker.bringToFront();
        if (!rec.who) marker.openPopup();
      }
    },
  }));

  // Init map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: CENTER,
      zoom: INITIAL_ZOOM,
      minZoom: 15,
      maxZoom: 21,
      fadeAnimation: false, // avoid tiles stuck at opacity:0 if rAF stalls (backgrounded tabs, low-power mode)
    });
    L.tileLayer(ESRI_IMAGERY_URL, {
      attribution: ESRI_ATTRIBUTION,
      maxZoom: 21,
      maxNativeZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Build/refresh markers when the joined record set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const seenIds = new Set();
    const bounds = [];

    for (const rec of records) {
      if (rec.lat == null || rec.lon == null) continue;
      seenIds.add(rec.id);
      bounds.push([rec.lat, rec.lon]);

      let marker = markersRef.current.get(rec.id);
      const style = styleFor(rec, activeTheme, rec.id === selectedId);

      if (!marker) {
        marker = L.circleMarker([rec.lat, rec.lon], style);
        marker.addTo(map);
        markersRef.current.set(rec.id, marker);
      } else {
        marker.setStyle(style);
      }

      marker.off("click");
      if (rec.who) {
        marker.unbindPopup();
        marker.on("click", () => onSelectSeeded(rec.id));
      } else {
        marker.bindPopup(popupHtml(rec), { maxWidth: 240 });
      }
      if (rec.who) marker.bringToFront();
    }

    // Remove markers for ids no longer present (shouldn't normally happen).
    for (const [id, marker] of markersRef.current.entries()) {
      if (!seenIds.has(id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    if (bounds.length && !map._richlandFitted) {
      map.fitBounds(bounds, { padding: [40, 40] });
      map._richlandFitted = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, activeTheme, selectedId]);

  return <div ref={containerRef} className="map-container" />;
});

export default MapView;
