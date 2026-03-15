import { useEffect, useState } from "react";
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
import EVScoreBadge from "../components/EVScoreBadge";
import EVScoreBreakdown from "../components/EVScoreBreakdown";
import AlertPreferences from "../components/AlertPreferences";
import api from "../lib/api";

function EVSparkline({ history }) {
  if (!history || history.length < 2) return null;
  const data = [...history].reverse().slice(-90); // last 90 days, chronological
  const scores = data.map(d => d.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const w = 120, h = 36, pad = 2;
  const points = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
    const y = h - pad - ((s - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  const last = scores[scores.length - 1];
  const first = scores[0];
  const color = last >= first ? "#22c55e" : "#ef4444";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <svg width={w} height={h} style={{ overflow: "visible" }}>
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span style={{ fontSize: 10, color: "var(--text3)" }}>90d trend</span>
    </div>
  );
}

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

      {evs && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <EVScoreBadge score={evs.score} verdict={evs.verdict} />
            <EVSparkline history={evs.history} />
            <EVScoreBreakdown components={evs.components ? (typeof evs.components === 'string' ? JSON.parse(evs.components) : evs.components) : null} />
          </div>
          <AlertPreferences ticker={ticker} />
        </div>
      )}

      {valuation && <CompanyHeader data={valuation} />}

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
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .cp-targets-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 768px) {
          .cp-targets-row { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
