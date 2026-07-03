"use client";

import { useState, useRef, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ─── Icons (inline SVG) ─────────────────────────────────────────────────────
const UploadIcon = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CameraIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const RefreshIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// ─── Score colours ───────────────────────────────────────────────────────────
const scoreConfig = {
  NEGATIVE:   { bg: "#f0fdf4", border: "#86efac", text: "#15803d", badge: "#16a34a" },
  BORDERLINE: { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c", badge: "#ea580c" },
  POSITIVE:   { bg: "#fef2f2", border: "#fca5a5", text: "#991b1b", badge: "#dc2626" },
  INVALID:    { bg: "#f8fafc", border: "#cbd5e1", text: "#475569", badge: "#64748b" },
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function Home() {
  const [step, setStep] = useState("upload"); // upload | analysing | results | error
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [data, setData] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef();
  const cameraInputRef = useRef();

  const handleFile = useCallback((f) => {
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setData(null);
    setErrorMsg("");
    setStep("upload");
  }, []);

  const onFileChange = (e) => handleFile(e.target.files[0]);

  const analyse = async () => {
    if (!file) return;
    setStep("analysing");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch(`${API_BASE}/analyse`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const json = await res.json();
      setData(json);
      setStep(json.success ? "results" : "quality_fail");
    } catch (e) {
      setErrorMsg(e.message || "Could not reach the backend. Make sure it's running.");
      setStep("error");
    }
  };

  const reset = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setData(null);
    setErrorMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const cfg = data?.result ? scoreConfig[data.result.diagnostic_score] || scoreConfig.INVALID : null;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>

        {/* ── Header ── */}
        <header style={styles.header}>
          <div style={styles.logoRow}>
            <span style={styles.logoMark}>⬡</span>
            <span style={styles.logoText}>DiagnosticIQ</span>
          </div>
          <p style={styles.headerSub}>Image-Based Diagnostic Analysis</p>
        </header>

        {/* ── STEP: Upload ── */}
        {(step === "upload") && (
          <div style={styles.card}>
            <h2 style={styles.sectionTitle}>Upload Test Image</h2>
            <p style={styles.hint}>Use your device camera or upload an existing image of the diagnostic test strip.</p>

            {/* Drop zone */}
            <div
              style={{ ...styles.dropZone, ...(preview ? styles.dropZoneHasImg : {}) }}
              onClick={() => fileInputRef.current.click()}
            >
              {preview ? (
                <img src={preview} alt="preview" style={styles.previewImg} />
              ) : (
                <>
                  <div style={styles.dropIcon}><UploadIcon /></div>
                  <p style={styles.dropText}>Tap to choose a file</p>
                  <p style={styles.dropSub}>PNG, JPG, TIFF · 8-bit or 16-bit grayscale or RGB</p>
                </>
              )}
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} style={{ display: "none" }} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={onFileChange} style={{ display: "none" }} />

            <div style={styles.btnRow}>
              <button style={styles.btnSecondary} onClick={() => cameraInputRef.current.click()}>
                <CameraIcon /> &nbsp;Use Camera
              </button>
              {preview && (
                <button style={styles.btnPrimary} onClick={analyse}>
                  Analyse Image →
                </button>
              )}
            </div>

            {preview && (
              <button style={styles.btnGhost} onClick={reset}>Choose a different image</button>
            )}
          </div>
        )}

        {/* ── STEP: Analysing ── */}
        {step === "analysing" && (
          <div style={{ ...styles.card, textAlign: "center", padding: "48px 24px" }}>
            <div style={styles.spinner} />
            <p style={{ marginTop: 24, fontSize: 16, color: "#334155", fontWeight: 500 }}>Analysing image...</p>
            <p style={{ marginTop: 8, fontSize: 13, color: "#94a3b8" }}>Running intensity measurements</p>
          </div>
        )}

        {/* ── STEP: Quality Fail ── */}
        {step === "quality_fail" && data && (
          <div style={styles.card}>
            <div style={styles.alertBox}>
              <AlertIcon />
              <span style={{ marginLeft: 8, fontWeight: 600 }}>Image Quality Check Failed</span>
            </div>
            <ul style={styles.issueList}>
              {data.quality.issues.map((iss, i) => (
                <li key={i} style={styles.issueItem}>• {iss}</li>
              ))}
            </ul>
            <div style={styles.qualityGrid}>
              <QualStat label="Blur Score" value={data.quality.blur_score} />
              <QualStat label="Brightness" value={data.quality.mean_brightness} />
              <QualStat label="Resolution" value={data.quality.resolution} />
            </div>
            <button style={styles.btnPrimary} onClick={reset}><RefreshIcon />&nbsp; Retake Image</button>
          </div>
        )}

        {/* ── STEP: Results ── */}
        {step === "results" && data && cfg && (
          <>
            {/* Annotated image */}
            {data.annotated_image && (
              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>Analysis Region</h2>
                <img
                  src={`data:image/png;base64,${data.annotated_image}`}
                  alt="annotated"
                  style={styles.annotatedImg}
                />
              </div>
            )}

            {/* Diagnostic result */}
            <div style={{ ...styles.card, background: cfg.bg, borderColor: cfg.border }}>
              <div style={styles.resultHeader}>
                <span style={{ ...styles.scoreBadge, background: cfg.badge }}>
                  {data.result.diagnostic_score}
                </span>
                <span style={{ ...styles.confidence, color: cfg.text }}>
                  Confidence: {data.result.confidence}
                </span>
              </div>
              <p style={{ ...styles.interpretation, color: cfg.text }}>
                {data.result.interpretation}
              </p>

              <div style={styles.divider} />

              <h3 style={styles.subTitle}>Recommended Next Steps</h3>
              <ul style={styles.nextList}>
                {data.result.next_steps.map((s, i) => (
                  <li key={i} style={styles.nextItem}>
                    <span style={{ ...styles.checkCircle, background: cfg.badge }}><CheckIcon /></span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* Measurements */}
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>Intensity Measurements</h2>
              <div style={styles.measureGrid}>
                <MeasureCard
                  label="Mean Gray Value"
                  value={data.measurements.mean_gray_value}
                  desc="Average pixel brightness in analysis region"
                />
                <MeasureCard
                  label="Integrated Density"
                  value={data.measurements.integrated_density.toLocaleString()}
                  desc="Area × Mean Gray Value"
                />
                <MeasureCard
                  label="Raw Integrated Density"
                  value={data.measurements.raw_integrated_density.toLocaleString()}
                  desc="Direct sum of all pixel values"
                />
              </div>

              <h3 style={{ ...styles.subTitle, marginTop: 24 }}>Additional Metrics</h3>
              <table style={styles.table}>
                <tbody>
                  {[
                    ["Area (px)", data.measurements.area_px.toLocaleString()],
                    ["Std. Deviation", data.measurements.std_deviation],
                    ["Min Value", data.measurements.min_value],
                    ["Max Value", data.measurements.max_value],
                    ["Blur Score", data.quality.blur_score],
                    ["Resolution", data.quality.resolution],
                  ].map(([k, v]) => (
                    <tr key={k} style={styles.tableRow}>
                      <td style={styles.tdLabel}>{k}</td>
                      <td style={styles.tdValue}>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button style={{ ...styles.btnPrimary, width: "100%", justifyContent: "center" }} onClick={reset}>
              <RefreshIcon />&nbsp; Analyse Another Image
            </button>
          </>
        )}

        {/* ── STEP: Error ── */}
        {step === "error" && (
          <div style={styles.card}>
            <div style={styles.alertBox}>
              <AlertIcon />
              <span style={{ marginLeft: 8, fontWeight: 600 }}>Something went wrong</span>
            </div>
            <p style={{ color: "#475569", marginTop: 12, fontSize: 14 }}>{errorMsg}</p>
            <button style={{ ...styles.btnPrimary, marginTop: 20 }} onClick={reset}>
              <RefreshIcon />&nbsp; Try Again
            </button>
          </div>
        )}

        <footer style={styles.footer}>
          For investigational use only · Not a certified medical device
        </footer>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f1f5f9; }
      `}</style>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MeasureCard({ label, value, desc }) {
  return (
    <div style={styles.measureCard}>
      <p style={styles.measureLabel}>{label}</p>
      <p style={styles.measureValue}>{value}</p>
      <p style={styles.measureDesc}>{desc}</p>
    </div>
  );
}

function QualStat({ label, value }) {
  return (
    <div style={styles.qualCard}>
      <p style={styles.qualLabel}>{label}</p>
      <p style={styles.qualValue}>{value}</p>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: "100vh",
    background: "#f1f5f9",
    display: "flex",
    justifyContent: "center",
    padding: "24px 16px 48px",
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  shell: {
    width: "100%",
    maxWidth: 520,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  header: {
    padding: "24px 0 8px",
    textAlign: "center",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 6,
  },
  logoMark: {
    fontSize: 26,
    color: "#0ea5e9",
    lineHeight: 1,
  },
  logoText: {
    fontSize: 22,
    fontWeight: 700,
    color: "#0f172a",
    letterSpacing: "-0.5px",
  },
  headerSub: {
    fontSize: 13,
    color: "#64748b",
    letterSpacing: "0.03em",
  },
  card: {
    background: "#ffffff",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    padding: "24px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "#0f172a",
    marginBottom: 8,
  },
  hint: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.6,
    marginBottom: 16,
  },
  dropZone: {
    border: "2px dashed #cbd5e1",
    borderRadius: 12,
    padding: "32px 16px",
    textAlign: "center",
    cursor: "pointer",
    transition: "border-color 0.2s",
    marginBottom: 16,
    minHeight: 140,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  dropZoneHasImg: {
    padding: 0,
    border: "2px solid #0ea5e9",
    overflow: "hidden",
  },
  dropIcon: { color: "#94a3b8", marginBottom: 10 },
  dropText: { fontSize: 15, fontWeight: 600, color: "#334155", marginBottom: 4 },
  dropSub: { fontSize: 12, color: "#94a3b8" },
  previewImg: { width: "100%", maxHeight: 320, objectFit: "contain", display: "block" },
  annotatedImg: { width: "100%", borderRadius: 8, border: "1px solid #e2e8f0" },
  btnRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  btnPrimary: {
    display: "inline-flex",
    alignItems: "center",
    background: "#0ea5e9",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    flex: 1,
    justifyContent: "center",
    minWidth: 160,
  },
  btnSecondary: {
    display: "inline-flex",
    alignItems: "center",
    background: "#f8fafc",
    color: "#334155",
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    padding: "11px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    flex: 1,
    justifyContent: "center",
  },
  btnGhost: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: 13,
    cursor: "pointer",
    marginTop: 12,
    display: "block",
    width: "100%",
    textAlign: "center",
  },
  spinner: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    border: "4px solid #e2e8f0",
    borderTopColor: "#0ea5e9",
    animation: "spin 0.9s linear infinite",
    margin: "0 auto",
  },
  alertBox: {
    display: "flex",
    alignItems: "center",
    background: "#fef2f2",
    border: "1px solid #fca5a5",
    borderRadius: 8,
    padding: "12px 14px",
    color: "#991b1b",
    fontSize: 14,
    marginBottom: 14,
  },
  issueList: { listStyle: "none", marginBottom: 16 },
  issueItem: { fontSize: 13, color: "#475569", lineHeight: 1.8 },
  qualityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
    marginBottom: 20,
  },
  qualCard: {
    background: "#f8fafc",
    borderRadius: 8,
    padding: "12px 10px",
    textAlign: "center",
    border: "1px solid #e2e8f0",
  },
  qualLabel: { fontSize: 11, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" },
  qualValue: { fontSize: 16, fontWeight: 700, color: "#0f172a" },
  resultHeader: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  scoreBadge: {
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    borderRadius: 6,
    padding: "4px 12px",
    letterSpacing: "0.06em",
  },
  confidence: { fontSize: 13, fontWeight: 500 },
  interpretation: { fontSize: 15, lineHeight: 1.6, fontWeight: 500 },
  divider: { height: 1, background: "#e2e8f0", margin: "18px 0" },
  subTitle: { fontSize: 13, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 },
  nextList: { listStyle: "none", display: "flex", flexDirection: "column", gap: 10 },
  nextItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    fontSize: 14,
    color: "#334155",
    lineHeight: 1.5,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: "#fff",
    marginTop: 1,
  },
  measureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
  },
  measureCard: {
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "14px 12px",
  },
  measureLabel: { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 },
  measureValue: { fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 4, letterSpacing: "-0.5px" },
  measureDesc: { fontSize: 11, color: "#94a3b8", lineHeight: 1.4 },
  table: { width: "100%", borderCollapse: "collapse" },
  tableRow: { borderBottom: "1px solid #f1f5f9" },
  tdLabel: { padding: "9px 0", fontSize: 13, color: "#64748b" },
  tdValue: { padding: "9px 0", fontSize: 13, color: "#0f172a", fontWeight: 600, textAlign: "right" },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#94a3b8",
    padding: "8px 0",
  },
};
