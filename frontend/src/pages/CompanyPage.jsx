import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import CompanyNav from "../components/company/CompanyNav";
import CompanyHeader from "../components/CompanyHeader";
import ConsensusCard from "../components/ConsensusCard";
import AnalystWidget from "../components/company/AnalystWidget";
import EVModelWidget from "../components/company/EVModelWidget";
import KeyMetricsRow from "../components/company/KeyMetricsRow";
import FinancialSnapshot from "../components/company/FinancialSnapshot";
import MarginGrowthTrends from "../components/company/MarginGrowthTrends";
import SkeletonLoader from "../components/SkeletonLoader";
import SectorComparison from "../components/evs/SectorComparison";
import PeerComparison from "../components/evs/PeerComparison";
import api from "../lib/api";

/* ── Inline mini-sparkline ────────────────────────────────────────── */
function Sparkline({ history, width = 80, height = 28 }) {
  if (!history || history.length < 2) return null;
  const data = [...history].reverse().slice(-90);
  const scores = data.map(d => d.score);
  const min = Math.min(...scores), max = Math.max(...scores);
  const range = max - min || 1;
  const pad = 1;
  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (width - pad * 2);
    const y = height - pad - ((s - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const color = scores[scores.length - 1] >= scores[0] ? "#22c55e" : "#ef4444";
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── EVS Glass Card (top-right floating) ──────────────────────────── */
function EVSCard({ evs, ticker }) {
  const { isFeatureUnlocked, user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertType, setAlertType] = useState("score_change");
  const [threshold, setThreshold] = useState(50);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [subs, setSubs] = useState([]);
  const ref = useRef(null);

  const score = evs?.score;
  const verdict = evs?.verdict;
  const components = evs?.components
    ? typeof evs.components === "string" ? JSON.parse(evs.components) : evs.components
    : null;

  useEffect(() => {
    if (!user || !ticker) return;
    api.get("/alerts/subscriptions")
      .then(({ data }) => setSubs((data || []).filter(s => s.ticker === ticker)))
      .catch(() => {});
  }, [user, ticker]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setAlertOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSubscribe = async () => {
    setSaving(true);
    try {
      await api.post("/alerts/subscribe", {
        ticker, alert_type: alertType,
        threshold: alertType === "score_threshold" ? threshold : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      const { data } = await api.get("/alerts/subscriptions");
      setSubs((data || []).filter(s => s.ticker === ticker));
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleUnsub = async (id) => {
    await api.delete(`/alerts/${id}`).catch(() => {});
    setSubs(prev => prev.filter(s => s.id !== id));
  };

  if (score == null) return null;

  const scoreColor = score >= 70 ? "#22c55e" : score >= 40 ? "#eab308" : "#ef4444";
  const unlocked = isFeatureUnlocked("evs_breakdown");

  const LABELS = {
    valuation: { name: "Valuation", weight: "35%" },
    health: { name: "Health", weight: "20%" },
    analyst: { name: "Analyst", weight: "15%" },
    growth: { name: "Growth", weight: "15%" },
    risk: { name: "Risk", weight: "15%" },
  };

  const ALERT_TYPES = [
    { value: "score_change", label: "Score changes 10+ pts" },
    { value: "verdict_flip", label: "Verdict flips" },
    { value: "score_threshold", label: "Score crosses threshold" },
  ];

  return (
    <div className="evs-card" ref={ref}>
      {/* Score row */}
      <div className="evs-card-top">
        <div className="evs-card-score-wrap">
          <span className="evs-card-score mono" style={{ color: scoreColor }}>{score}</span>
          <span className="evs-card-verdict" style={{ color: scoreColor }}>{verdict}</span>
        </div>
        <div className="evs-card-right">
          <Sparkline history={evs.history} width={72} height={24} />
          <span className="evs-card-label">90d</span>
        </div>
      </div>

      {/* Breakdown toggle */}
      {components && (
        <>
          <button className="evs-card-toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Hide" : "Breakdown"}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "0.2s" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {expanded && (
            <div className="evs-card-breakdown">
              {unlocked ? Object.entries(LABELS).map(([key, meta]) => {
                const val = Math.round(components[key] || 0);
                const c = val >= 70 ? "#22c55e" : val >= 40 ? "#eab308" : "#ef4444";
                return (
                  <div key={key} className="evs-bar-row">
                    <span className="evs-bar-label">{meta.name} <span className="evs-bar-weight">{meta.weight}</span></span>
                    <div className="evs-bar-track">
                      <div className="evs-bar-fill" style={{ width: `${val}%`, background: c }} />
                    </div>
                    <span className="evs-bar-val mono">{val}</span>
                  </div>
                );
              }) : (
                <div className="evs-card-locked">Pro to see breakdown</div>
              )}
            </div>
          )}
        </>
      )}

      {/* Sector & Peer comparison */}
      {unlocked && expanded && (
        <>
          <SectorComparison
            sectorRank={evs?.sector_rank}
            sectorTotal={evs?.sector_total}
            sectorPercentile={evs?.sector_percentile}
            sector={evs?.sector}
          />
          <PeerComparison peerContext={evs?.peer_context} currentTicker={ticker} />
        </>
      )}

      {/* Alert bell */}
      {user && (
        <div className="evs-card-alert-wrap">
          <button className="evs-card-alert-btn" onClick={() => setAlertOpen(!alertOpen)}
            title="Score alerts">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {subs.length > 0 && <span className="evs-alert-dot" />}
          </button>

          {alertOpen && (
            <div className="evs-alert-dropdown">
              {subs.length > 0 && (
                <div className="evs-alert-subs">
                  {subs.map(s => (
                    <div key={s.id} className="evs-alert-sub-row">
                      <span>{ALERT_TYPES.find(t => t.value === s.alert_type)?.label || s.alert_type}
                        {s.threshold != null ? ` (${s.threshold})` : ""}</span>
                      <button onClick={() => handleUnsub(s.id)} className="evs-alert-x">&times;</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="evs-alert-form">
                <select value={alertType} onChange={e => setAlertType(e.target.value)} className="evs-alert-select">
                  {ALERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {alertType === "score_threshold" && (
                  <input type="number" min={0} max={100} value={threshold}
                    onChange={e => setThreshold(Number(e.target.value))} className="evs-alert-input" />
                )}
                <button onClick={handleSubscribe} disabled={saving} className="evs-alert-add">
                  {saved ? "Added" : "+"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="evs-card-footer">Equity Value Score</div>
    </div>
  );
}

/* ── Main Page ────────────────────────────────────────────────────── */
export default function CompanyPage() {
  const { ticker } = useParams();
  const { getToken } = useAuth();
  const [data, setData] = useState(null);
  const [valuation, setValuation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [evs, setEvs] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [summaryRes, valuationRes, evsRes] = await Promise.allSettled([
          api.get(`/summary/${ticker}`),
          api.get(`/valuation/${ticker}`),
          api.get(`/evs/${ticker}`),
        ]);
        if (summaryRes.status === "fulfilled") setData(summaryRes.value.data);
        if (valuationRes.status === "fulfilled") setValuation(valuationRes.value.data);
        if (evsRes.status === "fulfilled") setEvs(evsRes.value.data);
        if (summaryRes.status === "rejected" && valuationRes.status === "rejected") {
          setError(summaryRes.reason?.response?.data?.detail || "Failed to load company data.");
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load company data.");
      } finally {
        setLoading(false);
      }
    }
    if (ticker) load();
  }, [ticker]);

  if (loading) return <SkeletonLoader />;

  if (error) {
    return (
      <div style={{ padding: 40 }}>
        <CompanyNav />
        <div className="error-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="company-page">
      <CompanyNav />

      <div className="cp-hero">
        {valuation && <CompanyHeader data={valuation} />}
        <EVSCard evs={evs} ticker={ticker} />
      </div>

      {valuation?.consensus && <ConsensusCard data={valuation.consensus} signals={valuation.signals} />}

      <div className="cp-targets-row">
        {valuation && <EVModelWidget valuation={valuation} />}
        {data?.analyst && Object.keys(data.analyst).length > 0 && (
          <AnalystWidget analyst={data.analyst} />
        )}
      </div>

      {data && (
        <KeyMetricsRow
          company={data.company}
          metrics={data.key_metrics}
        />
      )}

      {data?.quarterly_financials?.length > 0 && (
        <FinancialSnapshot quarters={data.quarterly_financials} />
      )}

      {data && (
        <MarginGrowthTrends
          quarters={data.quarterly_financials}
          growth={data.growth}
        />
      )}

      <style>{`
        .company-page {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Hero: header + EVS card side by side */
        .cp-hero {
          position: relative;
        }

        .cp-targets-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 768px) {
          .cp-targets-row { grid-template-columns: 1fr; }
        }

        /* ── EVS Glass Card ──────────────────────────── */
        .evs-card {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 180px;
          background: rgba(15, 23, 42, 0.65);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 14px 16px 10px;
          z-index: 10;
        }
        .light .evs-card {
          background: rgba(255,255,255,0.7);
          border-color: rgba(0,0,0,0.08);
        }

        .evs-card-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 6px;
        }
        .evs-card-score-wrap {
          display: flex;
          flex-direction: column;
        }
        .evs-card-score {
          font-size: 32px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -1.5px;
        }
        .evs-card-verdict {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-top: 2px;
        }
        .evs-card-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 1px;
        }
        .evs-card-label {
          font-size: 9px;
          color: var(--text3);
          letter-spacing: 0.3px;
        }

        .evs-card-toggle {
          display: flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          color: var(--text3);
          font-size: 10px;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 0;
          letter-spacing: 0.3px;
          transition: color 0.15s;
        }
        .evs-card-toggle:hover { color: var(--text); }

        .evs-card-breakdown {
          display: flex;
          flex-direction: column;
          gap: 5px;
          padding: 8px 0 4px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }
        .light .evs-card-breakdown { border-color: rgba(0,0,0,0.06); }

        .evs-bar-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .evs-bar-label {
          font-size: 9px;
          color: var(--text2);
          width: 65px;
          flex-shrink: 0;
          line-height: 1.2;
        }
        .evs-bar-weight {
          opacity: 0.4;
          font-size: 8px;
        }
        .evs-bar-track {
          flex: 1;
          height: 4px;
          background: rgba(255,255,255,0.06);
          border-radius: 2px;
          overflow: hidden;
        }
        .light .evs-bar-track { background: rgba(0,0,0,0.06); }
        .evs-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.5s ease-out;
        }
        .evs-bar-val {
          font-size: 9px;
          font-weight: 700;
          width: 20px;
          text-align: right;
          color: var(--text);
        }

        .evs-card-locked {
          font-size: 10px;
          color: var(--text3);
          text-align: center;
          padding: 6px 0;
        }

        /* Alert bell inside card */
        .evs-card-alert-wrap {
          position: relative;
          display: flex;
          justify-content: flex-end;
          margin-top: 4px;
        }
        .evs-card-alert-btn {
          background: none;
          border: none;
          color: var(--text3);
          cursor: pointer;
          padding: 3px;
          position: relative;
          transition: color 0.15s;
        }
        .evs-card-alert-btn:hover { color: var(--text); }
        .evs-alert-dot {
          position: absolute;
          top: 1px;
          right: 1px;
          width: 6px;
          height: 6px;
          background: #2563eb;
          border-radius: 50%;
        }

        .evs-alert-dropdown {
          position: absolute;
          bottom: 100%;
          right: 0;
          width: 220px;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 10px;
          margin-bottom: 6px;
          z-index: 20;
        }
        .light .evs-alert-dropdown {
          background: rgba(255,255,255,0.95);
          border-color: rgba(0,0,0,0.1);
        }

        .evs-alert-subs {
          margin-bottom: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .evs-alert-sub-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10px;
          color: var(--text2);
          background: rgba(255,255,255,0.04);
          padding: 4px 8px;
          border-radius: 6px;
        }
        .light .evs-alert-sub-row { background: rgba(0,0,0,0.03); }
        .evs-alert-x {
          background: none;
          border: none;
          color: var(--text3);
          cursor: pointer;
          font-size: 14px;
          line-height: 1;
          padding: 0 2px;
        }
        .evs-alert-x:hover { color: #ef4444; }

        .evs-alert-form {
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .evs-alert-select {
          flex: 1;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--text);
          font-size: 10px;
          padding: 5px 6px;
          border-radius: 6px;
          outline: none;
        }
        .light .evs-alert-select {
          background: rgba(0,0,0,0.04);
          border-color: rgba(0,0,0,0.1);
        }
        .evs-alert-input {
          width: 40px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: var(--text);
          font-size: 10px;
          padding: 5px 4px;
          border-radius: 6px;
          outline: none;
          text-align: center;
        }
        .light .evs-alert-input {
          background: rgba(0,0,0,0.04);
          border-color: rgba(0,0,0,0.1);
        }
        .evs-alert-add {
          background: #2563eb;
          color: #fff;
          border: none;
          font-size: 12px;
          font-weight: 700;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity 0.15s;
        }
        .evs-alert-add:hover { opacity: 0.85; }
        .evs-alert-add:disabled { opacity: 0.4; cursor: not-allowed; }

        .evs-card-footer {
          font-size: 9px;
          color: var(--text3);
          text-align: center;
          margin-top: 6px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          opacity: 0.6;
        }

        @media (max-width: 640px) {
          .evs-card {
            position: static;
            width: 100%;
            margin-bottom: -12px;
          }
          .cp-hero { display: flex; flex-direction: column-reverse; gap: 0; }
        }
      `}</style>
    </div>
  );
}
