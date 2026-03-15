import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import SectorComparison from "./evs/SectorComparison";
import PeerComparison from "./evs/PeerComparison";

const LABELS = {
  valuation: { name: "Valuation", weight: "35%", desc: "Consensus model upside vs current price" },
  health: { name: "Financial Health", weight: "20%", desc: "Altman Z, Piotroski, leverage, margins" },
  analyst: { name: "Analyst Alignment", weight: "15%", desc: "Agreement between models and Wall Street" },
  growth: { name: "Growth Quality", weight: "15%", desc: "Revenue, EPS, and free cash flow trends" },
  risk: { name: "Risk Signals", weight: "15%", desc: "52-week range, earnings consistency, asset quality" },
};

function ScoreBar({ value, color }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: "var(--border)", flex: 1 }}>
      <div style={{
        height: "100%", borderRadius: 3, background: color,
        width: `${Math.min(value, 100)}%`, transition: "width 0.6s ease-out",
      }} />
    </div>
  );
}

function barColor(val) {
  if (val >= 70) return "#22c55e";
  if (val >= 40) return "#eab308";
  return "#ef4444";
}

export default function EVScoreBreakdown({ components, sectorRank, sectorTotal, sectorPercentile, sector, peerContext, ticker }) {
  const [open, setOpen] = useState(false);
  const { isFeatureUnlocked } = useAuth();
  const unlocked = isFeatureUnlocked("evs_breakdown");

  if (!components) return null;

  return (
    <div className="card" style={{ padding: "12px 16px" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          background: "none", border: "none", color: "var(--text)", cursor: "pointer",
          fontSize: 13, fontWeight: 600,
        }}
      >
        Score Breakdown
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "0.2s" }} />
      </button>
      {open && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {unlocked ? (
            Object.entries(LABELS).map(([key, meta]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 130, fontSize: 12, color: "var(--text-muted)" }}>
                  {meta.name} <span style={{ opacity: 0.5 }}>({meta.weight})</span>
                </div>
                <ScoreBar value={components[key]} color={barColor(components[key])} />
                <div style={{ width: 30, fontSize: 12, fontWeight: 600, textAlign: "right" }}>
                  {Math.round(components[key])}
                </div>
              </div>
            ))
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
              Upgrade to Pro to see the full score breakdown
            </div>
          )}
          <SectorComparison
            sectorRank={sectorRank}
            sectorTotal={sectorTotal}
            sectorPercentile={sectorPercentile}
            sector={sector}
          />
          <PeerComparison peerContext={peerContext} currentTicker={ticker} />
        </div>
      )}
    </div>
  );
}
