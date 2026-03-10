import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import CompanyNav from "../components/company/CompanyNav";
import RatingDistribution from "../components/company/RatingDistribution";
import PriceTargetChart from "../components/company/PriceTargetChart";
import GradesTimeline from "../components/company/GradesTimeline";
import EarningsChart from "../components/company/EarningsChart";
import ScoresRadar from "../components/company/ScoresRadar";
import InsiderChart from "../components/company/InsiderChart";
import TradesTable from "../components/company/TradesTable";
import api from "../lib/api";

function SectionSkeleton() {
  return (
    <div className="glass-card ci-skeleton-card">
      <div className="ci-skeleton ci-skeleton--title" />
      <div className="ci-skeleton ci-skeleton--bar" />
      <div className="ci-skeleton ci-skeleton--bar-sm" />
    </div>
  );
}

export default function CompanyIntelligencePage() {
  const { ticker } = useParams();
  const { user } = useAuth();

  const [analyst, setAnalyst] = useState(null);
  const [insider, setInsider] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [dividends, setDividends] = useState(null);
  const [scores, setScores] = useState(null);
  const [currentPrice, setCurrentPrice] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const results = await Promise.allSettled([
          api.get(`/analyst/${ticker}`),
          api.get(`/insider/${ticker}`),
          api.get(`/earnings/${ticker}`),
          api.get(`/dividends/${ticker}`),
          api.get(`/scores/${ticker}`),
          api.get(`/valuation/${ticker}`),
        ]);

        if (results[0].status === "fulfilled") setAnalyst(results[0].value.data);
        if (results[1].status === "fulfilled") setInsider(results[1].value.data);
        if (results[2].status === "fulfilled") setEarnings(results[2].value.data);
        if (results[3].status === "fulfilled") setDividends(results[3].value.data);
        if (results[4].status === "fulfilled") setScores(results[4].value.data);
        if (results[5].status === "fulfilled") {
          const val = results[5].value.data;
          setCurrentPrice(val?.current_price || val?.price || null);
        }

        // If all critical endpoints failed, show error
        const allFailed = results.every((r) => r.status === "rejected");
        if (allFailed) {
          setError("Failed to load intelligence data. Please try again.");
        }
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load intelligence data.");
      } finally {
        setLoading(false);
      }
    }
    if (ticker) load();
  }, [ticker]);

  return (
    <div className="ci-page">
      <CompanyNav />

      {error && (
        <div className="error-box">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {loading ? (
        <div className="ci-loading-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <SectionSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          {/* Analyst Ratings & Price Targets */}
          {analyst && (
            <div className="ci-two-col">
              <RatingDistribution data={analyst} />
              <PriceTargetChart data={analyst} currentPrice={currentPrice} />
            </div>
          )}

          {/* Grades Timeline */}
          {analyst?.recent_grades && analyst.recent_grades.length > 0 && (
            <GradesTimeline grades={analyst.recent_grades} />
          )}

          {/* Earnings History */}
          {earnings && earnings.length > 0 && <EarningsChart earnings={earnings} />}

          {/* Financial Scores */}
          {scores && <ScoresRadar scores={scores} />}

          {/* Dividends */}
          {dividends && dividends.length > 0 && (
            <div className="glass-card" style={{ padding: 20 }}>
              <h3 className="ci-section-title" style={{ marginBottom: 16 }}>
                Dividend History
              </h3>
              <div className="ci-div-table-wrap">
                <table className="ci-div-table">
                  <thead>
                    <tr>
                      <th>Ex-Date</th>
                      <th>Amount</th>
                      <th>Yield</th>
                      <th>Frequency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dividends.slice(0, 12).map((d, i) => (
                      <tr key={i}>
                        <td className="mono">
                          {d.ex_date
                            ? new Date(d.ex_date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })
                            : "-"}
                        </td>
                        <td className="mono" style={{ fontWeight: 600 }}>
                          ${Number(d.amount || 0).toFixed(4)}
                        </td>
                        <td className="mono">
                          {d.yield != null ? `${(d.yield * 100).toFixed(2)}%` : "-"}
                        </td>
                        <td style={{ color: "var(--text3)" }}>
                          {d.frequency || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Insider Activity */}
          {insider?.insider && insider.insider.length > 0 && (
            <>
              <InsiderChart trades={insider.insider} />
              <TradesTable trades={insider.insider} type="insider" />
            </>
          )}

          {/* Senate Trades */}
          {insider?.senate && insider.senate.length > 0 && (
            <TradesTable
              trades={insider.senate}
              type="senate"
              title="Senate Trades"
            />
          )}

          {/* Empty state */}
          {!analyst && !earnings?.length && !scores && !insider?.insider?.length && !insider?.senate?.length && !dividends?.length && (
            <div className="glass-card" style={{ padding: 40, textAlign: "center" }}>
              <div style={{ fontSize: "0.85rem", color: "var(--text3)", marginBottom: 8 }}>
                No intelligence data available for {ticker?.toUpperCase()}.
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>
                This may be due to limited coverage for this security.
              </div>
            </div>
          )}
        </>
      )}

      <style>{`
        .ci-page {
          max-width: 1200px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .ci-section-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text);
          margin: 0;
        }
        .ci-badge {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 20px;
          background: rgba(59, 130, 246, 0.12);
          color: var(--primary2);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .ci-two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 768px) {
          .ci-two-col {
            grid-template-columns: 1fr;
          }
        }

        /* Dividends table */
        .ci-div-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .ci-div-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.75rem;
        }
        .ci-div-table th {
          text-align: left;
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .ci-div-table td {
          padding: 10px 12px;
          color: var(--text2);
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .ci-div-table tbody tr:last-child td {
          border-bottom: none;
        }
        .ci-div-table tbody tr:hover {
          background: var(--surface2);
        }

        /* Loading skeletons */
        .ci-loading-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 768px) {
          .ci-loading-grid {
            grid-template-columns: 1fr;
          }
        }
        .ci-skeleton-card {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .ci-skeleton {
          border-radius: 6px;
          background: linear-gradient(
            90deg,
            var(--surface2) 25%,
            var(--surface3, rgba(255,255,255,0.06)) 50%,
            var(--surface2) 75%
          );
          background-size: 400px 100%;
          animation: ci-shimmer 1.6s ease-in-out infinite;
        }
        .ci-skeleton--title {
          width: 140px;
          height: 16px;
        }
        .ci-skeleton--bar {
          width: 100%;
          height: 36px;
        }
        .ci-skeleton--bar-sm {
          width: 60%;
          height: 14px;
        }
        @keyframes ci-shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
      `}</style>
    </div>
  );
}
