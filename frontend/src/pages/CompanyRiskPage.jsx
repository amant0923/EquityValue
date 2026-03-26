import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import CompanyNav from "../components/company/CompanyNav";
import RiskDistribution from "../components/company/RiskDistribution";
import QQPlot from "../components/company/QQPlot";
import VolatilityChart from "../components/company/VolatilityChart";
import PriceForecast from "../components/company/PriceForecast";
import api from "../lib/api";

export default function CompanyRiskPage() {
  const { ticker } = useParams();
  const [riskData, setRiskData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.allSettled([
      api.get(`/risk/${ticker}`),
      api.get(`/forecast/${ticker}`),
    ]).then(([riskRes, forecastRes]) => {
      if (riskRes.status === "fulfilled") setRiskData(riskRes.value.data);
      if (forecastRes.status === "fulfilled") setForecastData(forecastRes.value.data);
      if (riskRes.status === "rejected" && forecastRes.status === "rejected") {
        setError("Failed to load risk and forecast data.");
      }
      setLoading(false);
    });
  }, [ticker]);

  return (
    <>
      <style>{`
        .risk-page-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }
        @media (max-width: 768px) {
          .risk-page-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="company-page"
      >
        <CompanyNav />
        <h2 style={{ fontSize: "1.1rem", marginBottom: 20 }}>
          Risk & Statistical Analysis
        </h2>

        {loading && (
          <div
            style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}
          >
            Loading risk analysis...
          </div>
        )}

        {!loading && error && (
          <div
            style={{ textAlign: "center", padding: 40, color: "var(--red)" }}
          >
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {riskData && (
              <div className="risk-page-grid">
                <RiskDistribution data={riskData} />
                <QQPlot data={riskData.qq_plot} />
              </div>
            )}
            {riskData && <VolatilityChart data={riskData} />}
            {forecastData && <PriceForecast data={forecastData} />}
          </>
        )}
      </motion.div>
    </>
  );
}
