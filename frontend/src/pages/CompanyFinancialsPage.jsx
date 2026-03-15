import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import CompanyNav from "../components/company/CompanyNav";
import StatementTable from "../components/company/StatementTable";
import RevenueChart from "../components/company/RevenueChart";
import MarginsChart from "../components/company/MarginsChart";
import CashFlowWaterfall from "../components/company/CashFlowWaterfall";
import BalanceSheetChart from "../components/company/BalanceSheetChart";
import PerShareChart from "../components/company/PerShareChart";
import SegmentCharts from "../components/company/SegmentCharts";
import api from "../lib/api";

const STATEMENT_TABS = [
  { key: "income", label: "Income Statement" },
  { key: "balance", label: "Balance Sheet" },
  { key: "cashflow", label: "Cash Flow" },
];

const PERIOD_OPTIONS = [
  { key: "annual", label: "Annual" },
  { key: "quarterly", label: "Quarterly" },
];

export default function CompanyFinancialsPage() {
  const { ticker } = useParams();
  const { user } = useAuth();

  const [activeStatement, setActiveStatement] = useState("income");
  const [period, setPeriod] = useState("annual");
  const [financials, setFinancials] = useState(null);
  const [segments, setSegments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [finRes, segRes] = await Promise.allSettled([
          api.get(`/financials/${ticker}?period=${period}`),
          api.get(`/segments/${ticker}`),
        ]);

        if (finRes.status === "fulfilled") {
          setFinancials(finRes.value.data);
        } else {
          setError(finRes.reason?.response?.data?.detail || "Failed to load financial data.");
        }

        if (segRes.status === "fulfilled") {
          setSegments(segRes.value.data);
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load financial data.");
      } finally {
        setLoading(false);
      }
    }
    if (ticker) load();
  }, [ticker, period]);

  const currentRows = financials?.[activeStatement] || [];

  return (
    <div className="cf-page">
      <CompanyNav />

      {/* Controls row */}
      <div className="cf-controls">
        <div className="cf-tabs">
          {STATEMENT_TABS.map((tab) => (
            <button
              key={tab.key}
              className={`cf-tab ${activeStatement === tab.key ? "cf-tab-active" : ""}`}
              onClick={() => setActiveStatement(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="cf-period-toggle">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              className={`cf-period-btn ${period === opt.key ? "cf-period-active" : ""}`}
              onClick={() => setPeriod(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
          <div className="cf-spinner" />
          <p style={{ color: "var(--text3)", marginTop: 12, fontSize: "0.82rem" }}>
            Loading financials for {ticker.toUpperCase()}...
          </p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="error-box">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* Data */}
      {!loading && !error && financials && (
        <>
          {/* Statement table */}
          <StatementTable rows={currentRows} statementType={activeStatement} />

          {/* Charts based on active statement */}
          <div className="cf-charts-grid">
            {activeStatement === "income" && (
              <>
                <RevenueChart rows={financials.income} />
                <MarginsChart rows={financials.income} />
                <PerShareChart
                  incomeRows={financials.income}
                  balanceRows={financials.balance}
                />
              </>
            )}

            {activeStatement === "balance" && (
              <>
                <BalanceSheetChart rows={financials.balance} />
                <PerShareChart
                  incomeRows={financials.income}
                  balanceRows={financials.balance}
                />
              </>
            )}

            {activeStatement === "cashflow" && (
              <CashFlowWaterfall rows={financials.cashflow} />
            )}
          </div>

          {/* Segments (shown on income statement tab) */}
          {activeStatement === "income" && segments && (
            <SegmentCharts segments={segments} />
          )}
        </>
      )}

      <style>{`
        .cf-page {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .cf-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .cf-tabs {
          display: flex;
          gap: 2px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 3px;
        }
        .cf-tab {
          padding: 7px 16px;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--text3);
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .cf-tab:hover {
          color: var(--text);
        }
        .cf-tab-active {
          background: var(--primary);
          color: #fff;
        }
        .cf-period-toggle {
          display: flex;
          gap: 2px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 3px;
        }
        .cf-period-btn {
          padding: 7px 14px;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text3);
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .cf-period-btn:hover {
          color: var(--text);
        }
        .cf-period-active {
          background: var(--surface2);
          color: var(--text);
        }
        .cf-charts-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .cf-charts-grid > :only-child {
          grid-column: 1 / -1;
        }
        .cf-charts-grid > :nth-child(3):last-child {
          grid-column: 1 / -1;
        }
        .cf-spinner {
          width: 28px;
          height: 28px;
          border: 3px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: cf-spin 0.8s linear infinite;
          margin: 0 auto;
        }
        @keyframes cf-spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .cf-controls { flex-direction: column; align-items: stretch; }
          .cf-charts-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
