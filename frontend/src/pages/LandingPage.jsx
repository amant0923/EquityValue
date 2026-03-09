import { useState } from "react";
import { motion } from "framer-motion";
import SearchBar from "../components/SearchBar";

const FEATURES = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: "12 Valuation Models",
    desc: "DCF, comparables, Graham Number, DDM — all run simultaneously and synthesised into one verdict.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    title: "Live Market Data",
    desc: "Real-time prices from Finnhub. Fundamental data refreshed continuously from financial databases.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
    title: "AI Investment Thesis",
    desc: "Claude-powered investment memos that synthesise the quantitative data into qualitative insight.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
      </svg>
    ),
    title: "Monte Carlo & LBO",
    desc: "10,000-path Monte Carlo simulation and private-equity LBO return modelling, automated.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
    title: "Peer Comparables",
    desc: "Sector peer analysis with live comps, median multiples, and position relative to industry.",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    title: "PDF Export",
    desc: "Download a full institutional-quality PDF report for every analysis you run.",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "",
    desc: "Try the platform with limited access",
    cta: "Sign Up Free",
    ctaStyle: "outline",
    features: [
      "1 analysis per day",
      "8 valuation models",
      "Price chart & fundamentals",
      "Peer comparison table",
    ],
    notIncluded: ["AI investment thesis", "Monte Carlo & LBO", "PDF export", "Compare & full screener"],
  },
  {
    name: "Pro",
    price: "$30",
    period: "/month",
    desc: "For active investors and researchers",
    cta: "Get Pro",
    ctaStyle: "primary",
    badge: "Most Popular",
    features: [
      "5 analyses per day",
      "All 12 valuation models",
      "AI investment thesis (Claude)",
      "Monte Carlo simulation",
      "LBO return modelling",
      "PDF report export",
      "Compare stocks",
      "Full screener filters",
    ],
  },
  {
    name: "Max",
    price: "$50",
    period: "/month",
    desc: "Unlimited access for professionals",
    cta: "Get Max",
    ctaStyle: "featured",
    features: [
      "Unlimited analyses",
      "Everything in Pro",
      "Priority data refresh",
      "DCF sensitivity table",
      "Three-statement projections",
      "Early access to new features",
    ],
  },
];

const TICKERS = ["AAPL", "NVDA", "TSLA", "KO", "JPM", "MSFT", "AMZN", "META"];

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export default function LandingPage({ ticker, setTicker, onSearch, loading, onEnterApp }) {
  const [activeTab, setActiveTab] = useState("free");

  return (
    <div className="lp-wrap">

      {/* ── Hero ── */}
      <motion.section
        className="lp-hero"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        <motion.div variants={fadeUp} className="lp-eyebrow-wrap">
          <span className="lp-eyebrow">
            <span className="lp-eyebrow-dot" />
            S&amp;P 500 · 12 Models · Real-Time
          </span>
        </motion.div>

        <motion.h1 variants={fadeUp} className="lp-headline">
          Know what a stock is
          <br />
          <span className="gradient-text">actually worth</span>
        </motion.h1>

        <motion.p variants={fadeUp} className="lp-sub">
          ValuEngine runs up to 12 institutional valuation models simultaneously — DCF, comparables,
          Graham Number, and more — synthesising them into a single consensus verdict in seconds.
        </motion.p>

        {/* Search */}
        <motion.div variants={fadeUp} className="lp-search-wrap">
          <SearchBar ticker={ticker} setTicker={setTicker} onSearch={(t) => { onEnterApp(); onSearch(t); }} loading={loading} />
        </motion.div>

        <motion.div variants={fadeUp} className="lp-tickers">
          <span className="lp-tickers-label">Try:</span>
          {TICKERS.map(t => (
            <button
              key={t}
              className="lp-ticker-btn"
              onClick={() => { setTicker(t); onEnterApp(); onSearch(t); }}
            >
              {t}
            </button>
          ))}
        </motion.div>

        {/* Stats */}
        <motion.div variants={fadeUp} className="lp-stats">
          {[
            { val: "12", label: "Models" },
            { val: "500", label: "Stocks" },
            { val: "~3s", label: "Per analysis" },
            { val: "3", label: "Methodologies" },
          ].map((s, i) => (
            <div key={i} className="lp-stat">
              <span className="lp-stat-val mono">{s.val}</span>
              <span className="lp-stat-label">{s.label}</span>
            </div>
          ))}
        </motion.div>
      </motion.section>

      {/* ── How it works ── */}
      <section className="lp-section">
        <div className="lp-section-header">
          <h2 className="lp-section-title">Institutional methodology, democratised</h2>
          <p className="lp-section-sub">
            Three valuation categories. Each captures a distinct dimension of value. Professionals triangulate all three.
          </p>
        </div>

        <div className="lp-methods-grid">
          {[
            {
              color: "blue", label: "Income-Based", models: 4,
              desc: "Values a company by its capacity to generate future earnings or cash flows, discounted to present value.",
              models_list: ["DCF (Discounted Cash Flow)", "Capitalisation of Earnings", "Gordon Growth Model", "Residual Income"],
            },
            {
              color: "purple", label: "Market-Based", models: 6,
              desc: "Compares the company against sector peers using standardised market multiples.",
              models_list: ["EV/EBITDA", "EV/EBIT", "EV/Sales", "P/E Ratio", "P/S Ratio", "PEG Ratio"],
            },
            {
              color: "green", label: "Asset-Based", models: 2,
              desc: "Values the company on the basis of its net asset position — what it owns minus what it owes.",
              models_list: ["Price-to-Book (P/B)", "Graham Number"],
            },
          ].map((cat, i) => (
            <motion.div
              key={i}
              className={`lp-method-card lp-method-card--${cat.color}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <div className="lp-method-top">
                <span className={`lp-method-badge lp-method-badge--${cat.color}`}>{cat.label}</span>
                <span className="lp-method-count">{cat.models} models</span>
              </div>
              <p className="lp-method-desc">{cat.desc}</p>
              <ul className="lp-method-list">
                {cat.models_list.map((m, j) => (
                  <li key={j}>
                    <span className={`lp-method-dot lp-method-dot--${cat.color}`} />
                    {m}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section">
        <div className="lp-section-header">
          <h2 className="lp-section-title">Everything you need for serious equity research</h2>
          <p className="lp-section-sub">Built for investors who want institutional rigour without the institutional cost.</p>
        </div>

        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              className="lp-feature-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.07 }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
            >
              <div className="lp-feature-icon">{f.icon}</div>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-desc">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="lp-section" id="pricing">
        <div className="lp-section-header">
          <h2 className="lp-section-title">Simple, transparent pricing</h2>
          <p className="lp-section-sub">Start free. Upgrade when you need the full suite.</p>
        </div>

        <div className="lp-pricing-grid">
          {PRICING.map((plan, i) => (
            <motion.div
              key={i}
              className={`lp-pricing-card${plan.ctaStyle === "primary" ? " lp-pricing-card--featured" : plan.ctaStyle === "featured" ? " lp-pricing-card--max" : ""}`}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              {plan.badge && <div className="lp-pricing-badge">{plan.badge}</div>}
              <div className="lp-pricing-name">{plan.name}</div>
              <div className="lp-pricing-price">
                <span className="lp-pricing-amount mono">{plan.price}</span>
                <span className="lp-pricing-period">{plan.period}</span>
              </div>
              <p className="lp-pricing-desc">{plan.desc}</p>

              <button
                className={`lp-pricing-cta lp-pricing-cta--${plan.ctaStyle}`}
                onClick={onEnterApp}
              >
                {plan.cta}
              </button>

              <ul className="lp-pricing-features">
                {plan.features.map((f, j) => (
                  <li key={j} className="lp-pricing-feature lp-pricing-feature--included">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {f}
                  </li>
                ))}
                {(plan.notIncluded || []).map((f, j) => (
                  <li key={`n${j}`} className="lp-pricing-feature lp-pricing-feature--excluded">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <motion.section
        className="lp-cta-banner"
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="lp-cta-title">Ready to see what the market is missing?</h2>
        <p className="lp-cta-sub">Run your first valuation in seconds. No sign-up required.</p>
        <button className="lp-cta-btn" onClick={onEnterApp}>
          Start Analysing — It's Free
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </motion.section>

      <style>{`
        .lp-wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 32px 80px;
          display: flex;
          flex-direction: column;
          gap: 100px;
        }

        /* ── Hero ── */
        .lp-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding-top: 80px;
          gap: 0;
        }
        .lp-eyebrow-wrap { margin-bottom: 24px; }
        .lp-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: var(--primary2);
          background: rgba(59,130,246,0.07);
          border: 1px solid rgba(59,130,246,0.18);
          padding: 6px 16px;
          border-radius: 20px;
        }
        .lp-eyebrow-dot {
          width: 6px; height: 6px;
          background: var(--primary2);
          border-radius: 50%;
          box-shadow: 0 0 8px var(--primary2);
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

        .lp-headline {
          font-size: clamp(2.4rem, 5vw, 3.8rem);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -2px;
          color: var(--text);
          margin-bottom: 22px;
        }
        .lp-sub {
          font-size: 1.05rem;
          color: var(--text2);
          line-height: 1.75;
          max-width: 560px;
          margin-bottom: 36px;
          font-weight: 400;
        }

        .lp-search-wrap { width: 100%; max-width: 560px; margin-bottom: 16px; }

        .lp-tickers {
          display: flex;
          gap: 6px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 48px;
        }
        .lp-tickers-label { font-size: 0.75rem; color: var(--text3); margin-right: 4px; }
        .lp-ticker-btn {
          background: transparent;
          border: 1px solid var(--border2);
          color: var(--text2);
          padding: 6px 14px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 0.78rem;
          font-weight: 700;
          font-family: "JetBrains Mono", monospace;
          letter-spacing: 0.5px;
          transition: all 0.2s;
        }
        .lp-ticker-btn:hover {
          background: var(--surface2);
          border-color: var(--primary);
          color: var(--primary2);
        }

        .lp-stats {
          display: flex;
          border: 1px solid var(--border2);
          border-radius: 12px;
          overflow: hidden;
          background: var(--surface);
        }
        .lp-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 16px 32px;
          border-right: 1px solid var(--border2);
        }
        .lp-stat:last-child { border-right: none; }
        .lp-stat-val { font-size: 1.4rem; font-weight: 700; color: var(--text); letter-spacing: -0.5px; }
        .lp-stat-label { font-size: 0.68rem; color: var(--text3); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }

        /* ── Sections ── */
        .lp-section { }
        .lp-section-header { text-align: center; margin-bottom: 48px; }
        .lp-section-title {
          font-size: clamp(1.4rem, 3vw, 1.9rem);
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.8px;
          margin-bottom: 12px;
        }
        .lp-section-sub {
          font-size: 0.92rem;
          color: var(--text2);
          line-height: 1.7;
          max-width: 520px;
          margin: 0 auto;
        }

        /* ── Methods grid ── */
        .lp-methods-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: var(--border);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .lp-method-card {
          background: var(--surface);
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .lp-method-top { display: flex; justify-content: space-between; align-items: center; }
        .lp-method-count { font-size: 0.7rem; color: var(--text3); font-weight: 500; }
        .lp-method-badge {
          font-size: 0.68rem; font-weight: 700; padding: 3px 10px;
          border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase;
        }
        .lp-method-badge--blue   { background: rgba(59,130,246,0.1); color: #93c5fd; border: 1px solid rgba(59,130,246,0.2); }
        .lp-method-badge--purple { background: rgba(129,140,248,0.1); color: #a5b4fc; border: 1px solid rgba(129,140,248,0.2); }
        .lp-method-badge--green  { background: rgba(16,185,129,0.1); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.2); }
        .lp-method-desc { font-size: 0.83rem; color: var(--text2); line-height: 1.65; }
        .lp-method-list {
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .lp-method-list li {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          color: var(--text3);
        }
        .lp-method-dot {
          width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
        }
        .lp-method-dot--blue   { background: #3b82f6; }
        .lp-method-dot--purple { background: #818cf8; }
        .lp-method-dot--green  { background: #10b981; }

        /* ── Features ── */
        .lp-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        .lp-feature-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: border-color 0.2s;
        }
        .lp-feature-card:hover { border-color: var(--border2); }
        .lp-feature-icon {
          width: 42px; height: 42px;
          background: var(--primary-glow2);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary2);
        }
        .lp-feature-title {
          font-size: 0.92rem;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.2px;
        }
        .lp-feature-desc { font-size: 0.8rem; color: var(--text2); line-height: 1.65; }

        /* ── Pricing ── */
        .lp-pricing-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          max-width: 960px;
          margin: 0 auto;
        }
        .lp-pricing-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          position: relative;
        }
        .lp-pricing-card--featured {
          border-color: rgba(59,130,246,0.35);
          background: linear-gradient(135deg, rgba(59,130,246,0.06), rgba(129,140,248,0.04));
          box-shadow: 0 0 40px rgba(59,130,246,0.1);
        }
        .lp-pricing-card--max {
          border-color: rgba(129,140,248,0.3);
          background: linear-gradient(135deg, rgba(129,140,248,0.06), rgba(124,58,237,0.04));
        }
        .lp-pricing-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: linear-gradient(135deg, var(--primary), var(--indigo));
          color: #fff;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          padding: 4px 14px;
          border-radius: 20px;
          white-space: nowrap;
        }
        .lp-pricing-name {
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: var(--text3);
          margin-bottom: 6px;
        }
        .lp-pricing-price {
          display: flex;
          align-items: baseline;
          gap: 4px;
          margin-bottom: 6px;
        }
        .lp-pricing-amount {
          font-size: 2.8rem;
          font-weight: 700;
          letter-spacing: -2px;
          color: var(--text);
        }
        .lp-pricing-period { font-size: 0.9rem; color: var(--text3); }
        .lp-pricing-desc { font-size: 0.82rem; color: var(--text2); margin-bottom: 20px; }
        .lp-pricing-cta {
          width: 100%;
          padding: 12px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 20px;
          letter-spacing: 0.2px;
        }
        .lp-pricing-cta--primary {
          background: linear-gradient(135deg, var(--primary), var(--indigo));
          color: #fff;
          border: none;
          box-shadow: var(--shadow-blue);
        }
        .lp-pricing-cta--primary:hover { opacity: 0.9; transform: translateY(-1px); }
        .lp-pricing-cta--outline {
          background: transparent;
          color: var(--text);
          border: 1px solid var(--border2);
        }
        .lp-pricing-cta--outline:hover { border-color: var(--primary); color: var(--primary2); }
        .lp-pricing-cta--featured {
          background: linear-gradient(135deg, var(--indigo), #7c3aed);
          color: #fff;
          border: none;
          box-shadow: 0 4px 24px rgba(129,140,248,0.25);
        }
        .lp-pricing-cta--featured:hover { opacity: 0.9; transform: translateY(-1px); }
        .lp-pricing-features { list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .lp-pricing-feature {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.82rem;
          flex-shrink: 0;
        }
        .lp-pricing-feature--included { color: var(--text2); }
        .lp-pricing-feature--excluded { color: var(--text3); text-decoration: line-through; opacity: 0.5; }

        /* ── CTA Banner ── */
        .lp-cta-banner {
          background: linear-gradient(135deg, rgba(59,130,246,0.08), rgba(129,140,248,0.06));
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: var(--radius-xl);
          padding: 56px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .lp-cta-title {
          font-size: clamp(1.4rem, 3vw, 2rem);
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.8px;
        }
        .lp-cta-sub { font-size: 0.92rem; color: var(--text2); }
        .lp-cta-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: linear-gradient(135deg, var(--primary), var(--indigo));
          color: #fff;
          border: none;
          padding: 14px 32px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.92rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: var(--shadow-blue);
          margin-top: 8px;
        }
        .lp-cta-btn:hover { opacity: 0.9; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(59,130,246,0.35); }

        @media (max-width: 900px) {
          .lp-methods-grid { grid-template-columns: 1fr; }
          .lp-features-grid { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 640px) {
          .lp-wrap { padding: 0 16px 60px; gap: 60px; }
          .lp-hero { padding-top: 48px; }
          .lp-headline { letter-spacing: -1px; }
          .lp-sub { font-size: 0.92rem; }
          .lp-stats { flex-wrap: wrap; }
          .lp-stat { flex: 1 1 40%; padding: 12px 16px; }
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-pricing-grid { grid-template-columns: 1fr !important; }
          .lp-cta-banner { padding: 36px 24px; }
        }
      `}</style>
    </div>
  );
}
