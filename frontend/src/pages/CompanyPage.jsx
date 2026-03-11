import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import CompanyNav from "../components/company/CompanyNav";
import CompanyHeader from "../components/CompanyHeader";
import ConsensusCard from "../components/ConsensusCard";
import AnalystWidget from "../components/company/AnalystWidget";
import KeyMetricsRow from "../components/company/KeyMetricsRow";
import FinancialSnapshot from "../components/company/FinancialSnapshot";
import MarginGrowthTrends from "../components/company/MarginGrowthTrends";
import SkeletonLoader from "../components/SkeletonLoader";
import api from "../lib/api";

export default function CompanyPage() {
  const { ticker } = useParams();
  const { getToken } = useAuth();
  const [data, setData] = useState(null);
  const [valuation, setValuation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [summaryRes, valuationRes] = await Promise.allSettled([
          api.get(`/summary/${ticker}`),
          api.get(`/valuation/${ticker}`),
        ]);
        if (summaryRes.status === "fulfilled") setData(summaryRes.value.data);
        if (valuationRes.status === "fulfilled") setValuation(valuationRes.value.data);
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

      {valuation && <CompanyHeader data={valuation} />}

      {valuation?.consensus && <ConsensusCard data={valuation.consensus} signals={valuation.signals} />}

      {data?.analyst && Object.keys(data.analyst).length > 0 && (
        <AnalystWidget analyst={data.analyst} />
      )}

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
      `}</style>
    </div>
  );
}
