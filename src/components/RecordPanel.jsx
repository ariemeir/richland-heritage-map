import { useEffect, useState } from "react";
import QRCode from "qrcode";

const PLACEHOLDER_PORTRAIT =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
      <rect width="128" height="128" fill="#14261d"/>
      <circle cx="64" cy="48" r="24" fill="#c8a028" opacity="0.55"/>
      <path d="M20 118 Q64 76 108 118 Z" fill="#c8a028" opacity="0.55"/>
    </svg>
  `);

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="record-section">
      <h3>{label}</h3>
      <p>{value}</p>
    </div>
  );
}

export default function RecordPanel({ record, onClose }) {
  const [qrUrl, setQrUrl] = useState(null);
  const [portraitSrc, setPortraitSrc] = useState(
    record.who?.portraitUrl || record.photoUrl || PLACEHOLDER_PORTRAIT
  );

  useEffect(() => {
    setPortraitSrc(record.who?.portraitUrl || record.photoUrl || PLACEHOLDER_PORTRAIT);
  }, [record]);

  useEffect(() => {
    const deepLink = `${window.location.origin}${window.location.pathname}?id=${record.id}`;
    let cancelled = false;
    QRCode.toDataURL(deepLink, { width: 260, margin: 1, color: { dark: "#1f3a2e", light: "#f3ead6" } })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [record.id]);

  const who = record.who;
  const birth = who?.birthDisplay || record.birthDisplay;
  const death = who?.deathDisplay || record.deathDisplay;
  const dateLine = [birth, death].filter(Boolean).join(" – ");

  const militaryText = [
    record.isVeteran ? "Listed as a veteran in the City's headstone survey (real record)." : null,
    who?.militaryDetail,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className="record-panel-backdrop" onClick={onClose} />
      <div className="record-panel" role="dialog" aria-label={`Record for ${record.name}`}>
        <button className="record-panel-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className="record-hero">
          {who?.isHero && <div className="hero-badge">Featured Story</div>}
          <img
            className="portrait"
            src={portraitSrc}
            alt={`Portrait or headstone photo of ${record.name}`}
            onError={() => setPortraitSrc(PLACEHOLDER_PORTRAIT)}
          />
          <h2>{who?.displayName || record.name}</h2>
          {dateLine && <div className="dates">{dateLine}</div>}
        </div>

        <div className="record-body">
          <span className="illustrative-badge">ILLUSTRATIVE — NOT VERIFIED HISTORY</span>
          <div className="disclaimer-text">
            Biographical narrative below is placeholder content written for this prototype
            and is not verified history. Grave location, name, dates, and veteran status
            are real City of Greenville records.
          </div>

          <Row label="Location" value={record.location} />
          <Row label="Biography (illustrative)" value={who?.bio} />
          <Row label="Family" value={who?.family} />
          <Row label="Military Service" value={militaryText || null} />
          <Row label="Residence / Occupation" value={who?.occupation} />
          <Row label="Community" value={who?.community} />

          <div className="record-section">
            <h3>Historical Records</h3>
            <p style={{ fontStyle: "italic", color: "#6b6455" }}>
              A future version of this project will attach primary-source documents,
              certificates, and photographs here, with provenance. Not built for v1.
            </p>
          </div>

          {record.matchType && <div className="match-tag">Data source: {record.matchType}</div>}

          <div className="qr-block">
            {qrUrl && <img src={qrUrl} alt="QR code linking to this record" />}
            <div className="caption">Scan at the grave</div>
          </div>
        </div>
      </div>
    </>
  );
}
