import { motion } from "framer-motion";

const MARKET_MOVERS = [
  { ticker: "NVDA", name: "NVIDIA Corp", change: "+3.42%", price: "135.80", positive: true },
  { ticker: "TSLA", name: "Tesla Inc", change: "+2.18%", price: "248.50", positive: true },
  { ticker: "AAPL", name: "Apple Inc", change: "+0.87%", price: "213.49", positive: true },
  { ticker: "MSFT", name: "Microsoft Corp", change: "-0.42%", price: "378.22", positive: false },
  { ticker: "META", name: "Meta Platforms", change: "-1.15%", price: "498.30", positive: false },
];

const SECTORS = [
  { name: "Technology", change: "+1.82%", positive: true },
  { name: "Healthcare", change: "+0.34%", positive: true },
  { name: "Financials", change: "-0.28%", positive: false },
  { name: "Energy", change: "+0.91%", positive: true },
  { name: "Consumer Disc.", change: "-0.63%", positive: false },
  { name: "Utilities", change: "+0.12%", positive: true },
];

const stagger = { visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } } };

export default function DashboardPage({ watchlist, onSearch, onGoAnalysis }) {
  return (
    <div className="db-wrap">
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        {/* Header */}
        <motion.div variants={fadeUp} className="db-header">
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
          <motion.section variants={fadeUp} className="db-section">
            <h2 className="db-section-title">Recent Analyses</h2>
            <div className="db-watchlist-grid">
              {watchlist.map((sym, i) => (
                <motion.button
                  key={sym}
                  className="db-watchlist-card"
                  onClick={() => { onGoAnalysis(); onSearch(sym); }}
                  whileHover={{ y: -2, transition: { duration: 0.15 } }}
                >
                  <span className="db-wl-ticker mono">{sym}</span>
                  <span className="db-wl-cta">
                    View analysis
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.section>
        )}

        {/* Market movers */}
        <motion.section variants={fadeUp} className="db-section">
          <h2 className="db-section-title">Market Movers</h2>
          <div className="db-movers-card">
            {MARKET_MOVERS.map((m, i) => (
              <div key={i} className="db-mover" onClick={() => { onGoAnalysis(); onSearch(m.ticker); }}>
                <div className="db-mover-left">
                  <span className="db-mover-ticker mono">{m.ticker}</span>
                  <span className="db-mover-name">{m.name}</span>
                </div>
                <div className="db-mover-right">
                  <span className="db-mover-price mono">${m.price}</span>
                  <span className={`db-mover-change mono ${m.positive ? "db-positive" : "db-negative"}`}>{m.change}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="db-disclaimer">Market data is illustrative. Use the Analysis page for live valuations.</p>
        </motion.section>

        {/* Sector performance */}
        <motion.section variants={fadeUp} className="db-section">
          <h2 className="db-section-title">Sector Performance</h2>
          <div className="db-sectors-grid">
            {SECTORS.map((s, i) => (
              <div key={i} className={`db-sector-card ${s.positive ? "db-sector--positive" : "db-sector--negative"}`}>
                <span className="db-sector-name">{s.name}</span>
                <span className={`db-sector-change mono ${s.positive ? "db-positive" : "db-negative"}`}>{s.change}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Quick start */}
        {watchlist.length === 0 && (
          <motion.section variants={fadeUp} className="db-empty">
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
        .db-mover-left { display: flex; flex-direction: column; gap: 2px; }
        .db-mover-ticker { font-size: 0.88rem; font-weight: 700; color: var(--text); }
        .db-mover-name { font-size: 0.75rem; color: var(--text3); }
        .db-mover-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .db-mover-price { font-size: 0.88rem; font-weight: 600; color: var(--text); }
        .db-mover-change { font-size: 0.8rem; font-weight: 600; }
        .db-positive { color: var(--green2); }
        .db-negative { color: var(--red2); }
        .db-disclaimer { font-size: 0.68rem; color: var(--text3); margin-top: 8px; }

        .db-sectors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
        }
        .db-sector-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .db-sector--positive { border-left: 3px solid var(--green2); }
        .db-sector--negative { border-left: 3px solid var(--red2); }
        .db-sector-name { font-size: 0.78rem; color: var(--text2); font-weight: 500; }
        .db-sector-change { font-size: 0.9rem; font-weight: 700; }

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
