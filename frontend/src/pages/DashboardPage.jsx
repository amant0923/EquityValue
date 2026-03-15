import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import EVScoreBadge from "../components/EVScoreBadge";

const blurReveal = {
  hidden: { opacity: 0, filter: "blur(12px)", y: 20 },
  visible: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

export default function DashboardPage({ watchlist, onSearch, onGoAnalysis }) {
  const navigate = useNavigate();
  const [topPicks, setTopPicks] = useState({ buy: [], avoid: [] });
  const [loading, setLoading] = useState(true);
  const [watchlistEvs, setWatchlistEvs] = useState({});

  useEffect(() => {
    if (!watchlist.length) return;
    // Fetch EVS for each watched ticker
    Promise.allSettled(
      watchlist.map(sym => api.get(`/evs/${sym}`).then(({ data }) => ({ sym, data })))
    ).then(results => {
      const map = {};
      results.forEach(r => {
        if (r.status === "fulfilled") map[r.value.sym] = r.value.data;
      });
      setWatchlistEvs(map);
    });
  }, [watchlist]);

  useEffect(() => {
    api.get("/dashboard/top-picks")
      .then(({ data }) => setTopPicks(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n) => n?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—";

  return (
    <div className="db-wrap">
      <motion.div initial="hidden" animate="visible" variants={staggerContainer}>
        {/* Header */}
        <motion.div variants={blurReveal} className="db-header">
          <div>
            <h1 className="db-title">Dashboard</h1>
            <p className="db-sub">S&amp;P 500 market overview and your recent analyses</p>
          </div>
          <button className="db-analyse-btn" onClick={onGoAnalysis}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Analyse a stock
          </button>
        </motion.div>

        {/* Watchlist */}
        {watchlist.length > 0 && (
          <motion.section variants={blurReveal} className="db-section">
            <h2 className="db-section-title">Recent Analyses</h2>
            <div className="db-watchlist-grid">
              {watchlist.map((sym, i) => {
                const evsData = watchlistEvs[sym];
                return (
                  <motion.button
                    key={sym}
                    className="db-watchlist-card"
                    onClick={() => navigate(`/company/${sym}`)}
                    whileHover={{ y: -2, transition: { duration: 0.15 } }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="db-wl-ticker mono">{sym}</span>
                      {evsData && (
                        <span style={{
                          fontSize: 13, fontWeight: 700,
                          color: evsData.score >= 70 ? "#22c55e" : evsData.score >= 40 ? "#eab308" : "#ef4444",
                        }}>
                          {evsData.score}
                        </span>
                      )}
                    </div>
                    {evsData && (
                      <span style={{ fontSize: 10, color: "var(--text3)" }}>{evsData.verdict}</span>
                    )}
                    <span className="db-wl-cta">
                      View analysis
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </motion.section>
        )}

        {/* Top Picks */}
        <motion.section variants={blurReveal} className="db-section">
          <div className="db-picks-grid">
            {/* Top 5 Buy */}
            <div>
              <h2 className="db-section-title">
                <span className="db-pick-dot db-pick-dot--buy" />
                Top 5 — Best to Buy
              </h2>
              <div className="db-movers-card">
                {loading ? (
                  <div className="db-mover" style={{ justifyContent: "center", color: "var(--text3)" }}>Loading...</div>
                ) : topPicks.buy.map((s, i) => (
                  <div key={s.ticker} className="db-mover" onClick={() => navigate(`/company/${s.ticker}`)}>
                    <div className="db-mover-left">
                      <span className="db-mover-rank">{i + 1}</span>
                      {s.evs_score != null && (
                        <EVScoreBadge score={s.evs_score} verdict={s.evs_verdict || "Hold"} size="sm" />
                      )}
                      <div>
                        <span className="db-mover-ticker mono">{s.ticker}</span>
                        <span className="db-mover-name">{s.name}</span>
                      </div>
                    </div>
                    <div className="db-mover-right">
                      <span className="db-mover-price mono">${fmt(s.current_price)}</span>
                      <span className="db-mover-target">WS Target: ${fmt(s.target_price)}</span>
                      <span className="db-mover-change mono db-positive">+{s.upside_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top 5 Avoid */}
            <div>
              <h2 className="db-section-title">
                <span className="db-pick-dot db-pick-dot--avoid" />
                Top 5 — Avoid / Sell
              </h2>
              <div className="db-movers-card">
                {loading ? (
                  <div className="db-mover" style={{ justifyContent: "center", color: "var(--text3)" }}>Loading...</div>
                ) : topPicks.avoid.map((s, i) => (
                  <div key={s.ticker} className="db-mover" onClick={() => navigate(`/company/${s.ticker}`)}>
                    <div className="db-mover-left">
                      <span className="db-mover-rank">{i + 1}</span>
                      {s.evs_score != null && (
                        <EVScoreBadge score={s.evs_score} verdict={s.evs_verdict || "Hold"} size="sm" />
                      )}
                      <div>
                        <span className="db-mover-ticker mono">{s.ticker}</span>
                        <span className="db-mover-name">{s.name}</span>
                      </div>
                    </div>
                    <div className="db-mover-right">
                      <span className="db-mover-price mono">${fmt(s.current_price)}</span>
                      <span className="db-mover-target">WS Target: ${fmt(s.target_price)}</span>
                      <span className="db-mover-change mono db-negative">{s.upside_pct}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="db-disclaimer">Based on Wall Street analyst consensus price targets vs. current price. Not financial advice.</p>
        </motion.section>

        {/* Quick start */}
        {watchlist.length === 0 && (
          <motion.section variants={blurReveal} className="db-empty">
            <div className="db-empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <h3 className="db-empty-title">Start your first analysis</h3>
            <p className="db-empty-sub">Run valuation models on any S&amp;P 500 stock. Your recent analyses will appear here.</p>
            <button className="db-empty-btn" onClick={onGoAnalysis}>
              Search for a stock
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          </motion.section>
        )}
      </motion.div>

      <style>{`
        .db-wrap { max-width: 900px; }
        .db-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 36px;
          flex-wrap: wrap;
          gap: 16px;
        }
        .db-title { font-size: 1.6rem; font-weight: 700; color: var(--text); letter-spacing: -0.8px; margin-bottom: 4px; }
        .db-sub { font-size: 0.85rem; color: var(--text2); }
        .db-analyse-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--primary);
          color: #fff;
          border: none;
          padding: 10px 20px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s;
        }
        .db-analyse-btn:hover { opacity: 0.85; }

        .db-section { margin-bottom: 32px; }
        .db-section-title {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text3);
          margin-bottom: 14px;
        }

        .db-watchlist-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 10px;
        }
        .db-watchlist-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          transition: border-color 0.15s, background 0.15s;
        }
        .db-watchlist-card:hover { border-color: var(--primary); background: var(--surface2); }
        .db-wl-ticker {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
          letter-spacing: 0.3px;
        }
        .db-wl-cta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.72rem;
          color: var(--primary2);
          font-weight: 500;
        }

        .db-movers-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .db-picks-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        @media (max-width: 768px) {
          .db-picks-grid { grid-template-columns: 1fr; }
        }
        .db-pick-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 6px;
        }
        .db-pick-dot--buy { background: var(--green2); }
        .db-pick-dot--avoid { background: var(--red2); }
        .db-mover {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          transition: background 0.15s;
        }
        .db-mover:last-child { border-bottom: none; }
        .db-mover:hover { background: var(--surface2); }
        .db-mover-left { display: flex; align-items: center; gap: 12px; }
        .db-mover-rank {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text3);
          min-width: 18px;
        }
        .db-mover-ticker { font-size: 0.88rem; font-weight: 700; color: var(--text); display: block; }
        .db-mover-name { font-size: 0.72rem; color: var(--text3); display: block; }
        .db-mover-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .db-mover-price { font-size: 0.88rem; font-weight: 600; color: var(--text); }
        .db-mover-target { font-size: 0.68rem; color: var(--text3); }
        .db-mover-change { font-size: 0.8rem; font-weight: 600; }
        .db-positive { color: var(--green2); }
        .db-negative { color: var(--red2); }
        .db-disclaimer { font-size: 0.68rem; color: var(--text3); margin-top: 8px; }

        .db-empty {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 56px 32px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .db-empty-icon {
          width: 56px; height: 56px;
          background: var(--primary-glow2);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary2);
          margin-bottom: 8px;
        }
        .db-empty-title { font-size: 1.1rem; font-weight: 700; color: var(--text); }
        .db-empty-sub { font-size: 0.83rem; color: var(--text2); max-width: 340px; line-height: 1.65; }
        .db-empty-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--primary);
          color: #fff;
          border: none;
          padding: 11px 24px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          margin-top: 8px;
          transition: opacity 0.15s;
        }
        .db-empty-btn:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
