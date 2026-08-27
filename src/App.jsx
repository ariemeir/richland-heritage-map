import { useEffect, useMemo, useRef, useState } from "react";
import MapView from "./components/MapView.jsx";
import TopBar from "./components/TopBar.jsx";
import RecordPanel from "./components/RecordPanel.jsx";
import Footer from "./components/Footer.jsx";
import { loadInterments } from "./lib/interments.js";
import { loadWho } from "./lib/who.js";

export default function App() {
  const [interments, setInterments] = useState(null);
  const [whoMap, setWhoMap] = useState(null);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [activeTheme, setActiveTheme] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [panelId, setPanelId] = useState(null);
  const mapRef = useRef(null);
  const deepLinkHandled = useRef(false);

  useEffect(() => {
    setError(null);
    Promise.all([loadInterments(), loadWho()])
      .then(([intermentsData, who]) => {
        setInterments(intermentsData);
        setWhoMap(who);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || String(err));
      });
  }, [retryCount]);

  const records = useMemo(() => {
    if (!interments || !whoMap) return [];
    return interments.map((rec) => ({ ...rec, who: whoMap.get(rec.id) || null }));
  }, [interments, whoMap]);

  const panelRecord = useMemo(
    () => (panelId != null ? records.find((r) => r.id === panelId) : null),
    [records, panelId]
  );

  // Deep link: ?id=<INTERMENT_ID>
  useEffect(() => {
    if (deepLinkHandled.current || records.length === 0) return;
    deepLinkHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const idParam = Number(params.get("id"));
    if (!Number.isFinite(idParam)) return;
    const rec = records.find((r) => r.id === idParam);
    if (!rec) return;
    setSelectedId(rec.id);
    if (rec.who) setPanelId(rec.id);
    // Give the map a tick to mount before panning.
    setTimeout(() => mapRef.current?.panTo(rec.id), 150);
  }, [records]);

  function handleToggleTheme(key) {
    setActiveTheme((prev) => (prev === key ? null : key));
  }

  function handlePickResult(id) {
    const rec = records.find((r) => r.id === id);
    if (!rec) return;
    setSelectedId(id);
    if (rec.who) setPanelId(id);
    mapRef.current?.panTo(id);
  }

  function handleSelectSeeded(id) {
    setSelectedId(id);
    setPanelId(id);
  }

  function handleClosePanel() {
    setPanelId(null);
  }

  const loading = !interments || !whoMap;

  return (
    <div className="app">
      {loading && !error && (
        <div className="loading-screen">
          <div className="gold">Richland Cemetery</div>
          <div>Loading live interment records…</div>
        </div>
      )}
      {error && (
        <div className="loading-screen">
          <div className="gold">Could not load interment data</div>
          <div>{error}</div>
          <div style={{ fontSize: "0.8rem", opacity: 0.8, maxWidth: 340, textAlign: "center" }}>
            The City of Greenville's GIS service may be briefly unavailable. This usually
            resolves within a minute.
          </div>
          <button
            onClick={() => setRetryCount((n) => n + 1)}
            style={{
              marginTop: "0.5rem",
              padding: "0.5rem 1.2rem",
              borderRadius: 6,
              border: "1px solid #c8a028",
              background: "#c8a028",
              color: "#14261d",
              fontWeight: "bold",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Try again
          </button>
        </div>
      )}

      {!loading && (
        <>
          <MapView
            ref={mapRef}
            records={records}
            activeTheme={activeTheme}
            selectedId={selectedId}
            onSelectSeeded={handleSelectSeeded}
          />
          <TopBar
            records={records}
            activeTheme={activeTheme}
            onToggleTheme={handleToggleTheme}
            onPickResult={handlePickResult}
          />
          {panelRecord && <RecordPanel record={panelRecord} onClose={handleClosePanel} />}
          <Footer />
        </>
      )}
    </div>
  );
}
