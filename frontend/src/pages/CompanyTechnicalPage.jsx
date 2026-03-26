import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import CompanyNav from "../components/company/CompanyNav";
import TechnicalAnalysis from "../components/company/TechnicalAnalysis";
import PerformanceReturns from "../components/company/PerformanceReturns";
import SignalGauge from "../components/company/SignalGauge";
import api from "../lib/api";

export default function CompanyTechnicalPage() {
  const { ticker } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState("1y");

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/technicals/${ticker}?period=${period}`)
      .then((r) => {
        setData(r.data);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load technical data");
        setLoading(false);
      });
  }, [ticker, period]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="company-page"
    >
      <CompanyNav />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Technical Analysis</h2>
        <div style={{ display: "flex", gap: 6 }}>
          {["6mo", "1y", "2y", "5y"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              style={{
                padding: "5px 12px",
                fontSize: "0.75rem",
                fontWeight: 600,
                borderRadius: 6,
                border:
                  period === p
                    ? "1px solid var(--primary2)"
                    : "1px solid var(--border)",
                background: period === p ? "var(--primary2)" : "transparent",
                color: period === p ? "#fff" : "var(--text3)",
                cursor: "pointer",
              }}
            >
              {p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>
          Loading technical indicators...
        </div>
      )}
      {error && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--red)" }}>
          {error}
        </div>
      )}
      {data && !loading && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 16,
              marginBottom: 20,
            }}
          >
            <SignalGauge signals={data.signals} />
            <PerformanceReturns performance={data.performance} />
          </div>
          <TechnicalAnalysis data={data} />
        </>
      )}

      <style>{`
        @media (max-width: 700px) {
          .company-page > div:nth-child(3) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
