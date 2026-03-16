import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const STEPS = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
    title: "Search a Stock",
    desc: "Enter any S&P 500 ticker to get started. We run 11 institutional valuation models instantly.",
    link: "/analysis",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
    title: "Read the EVS Score",
    desc: "Every stock gets a 1–100 Equity Value Score combining valuation, health, analyst consensus, growth, and risk.",
    link: "/screener",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
      </svg>
    ),
    title: "Explore the Company",
    desc: "Dive into financials, analyst ratings, insider trades, and earnings history on the company page.",
    link: "/company/AAPL",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.58-3.25 3.93L12 22"/><path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.58 3.25 3.93"/>
      </svg>
    ),
    title: "Get an AI Thesis",
    desc: "Pro users get a Claude-powered investment memo that synthesizes all the quantitative data into qualitative insight.",
    link: "/analysis",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
      </svg>
    ),
    title: "Track with Watchlist",
    desc: "Add stocks to your watchlist and organize them into custom groups. Get alerts on score changes.",
    link: "/dashboard",
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
    ),
    title: "Compare & Screen",
    desc: "Use the screener to filter by sector, EVS score, and fundamentals. Compare stocks side by side.",
    link: "/screener",
  },
];

const FAQ_SECTIONS = [
  {
    id: "evs",
    title: "EVS Score",
    items: [
      {
        q: "What is the Equity Value Score?",
        a: "The EVS is a proprietary 1–100 composite score that measures how attractive a stock is as an investment. It combines five dimensions: Valuation (35%), Financial Health (20%), Analyst Alignment (15%), Growth Quality (15%), and Risk Signals (15%).",
      },
      {
        q: "What do the verdicts mean?",
        a: "EVS verdicts map to score ranges: Strong Buy (80–100), Buy (65–79), Hold (40–64), Sell (25–39), and Strong Sell (0–24). These reflect the overall balance of valuation, quality, and risk factors.",
      },
      {
        q: "How often is the EVS updated?",
        a: "EVS scores are recomputed every night (Monday–Friday) after market close. The nightly pipeline processes all S&P 500 stocks, updates scores, computes sector rankings, and fires alerts.",
      },
      {
        q: "What is sector percentile?",
        a: "Sector percentile ranks a stock's EVS score against all other stocks in the same GICS sector. A stock at the 90th percentile scores higher than 90% of its sector peers.",
      },
    ],
  },
  {
    id: "models",
    title: "Valuation Models",
    items: [
      {
        q: "Which 11 models does Equity Value use?",
        a: "Income-based: DCF, Capitalization of Earnings, Gordon Growth Model (DDM), Residual Income. Market-based: EV/EBITDA, EV/EBIT, EV/Sales, P/E, P/S, PEG Ratio. Asset-based: Price-to-Book, Graham Number.",
      },
      {
        q: "How does the consensus work?",
        a: "The consensus averages intrinsic values from all applicable market-based models (EV/EBITDA, EV/EBIT, EV/Sales, P/E, P/S, PEG). Income-based and asset-based models inform the EVS score but are excluded from the consensus price target to avoid outlier distortion.",
      },
      {
        q: "What does 'not applicable' mean?",
        a: "Some models require specific data to work. For example, the DDM model requires a company to pay dividends, and DCF requires positive free cash flow. If the prerequisite data is missing or negative, the model is marked as not applicable.",
      },
    ],
  },
  {
    id: "company",
    title: "Company Pages",
    items: [
      {
        q: "What does the Summary tab show?",
        a: "The Summary tab provides an overview: company description, EVS score with breakdown, key financial metrics, price chart, and peer comparison within the sector.",
      },
      {
        q: "What's in the Financials tab?",
        a: "Full three-statement financial data — income statement, balance sheet, and cash flow statement. Available in annual and quarterly views (quarterly is Pro only). Includes growth metrics and trend charts.",
      },
      {
        q: "What's in the Intelligence tab?",
        a: "Analyst ratings and price targets, recent analyst grade changes, insider trading activity, senate trades, and earnings history (actual vs. estimate).",
      },
      {
        q: "What's in the Valuation tab?",
        a: "All 11 valuation model results with assumptions, the football field chart comparing model ranges, and the consensus price target. Pro users also get Monte Carlo simulation and LBO modelling.",
      },
    ],
  },
  {
    id: "screener",
    title: "Screener",
    items: [
      {
        q: "How do screener filters work?",
        a: "Select a sector, set EVS score range, and choose a sort order. Click 'Run Screener' to filter all S&P 500 stocks. Results show EVS score, sector percentile, key metrics, and a link to analyse each stock.",
      },
      {
        q: "What is the 'Best in Sector' badge?",
        a: "The gold star badge appears next to stocks that rank #1 in their GICS sector by EVS score. It means this stock has the highest composite value rating among all its sector peers.",
      },
    ],
  },
  {
    id: "ai",
    title: "AI Thesis",
    items: [
      {
        q: "What is the AI investment thesis?",
        a: "A Claude-generated investment memo that synthesizes the company's financial data, valuation model results, and market context into a structured bull case, bear case, valuation assessment, and recommendation.",
      },
      {
        q: "Which AI model generates it?",
        a: "The AI model depends on your plan. Free users get Claude Haiku (fast, concise). Pro users get Claude Sonnet (balanced depth). The thesis is cached for 24 hours to reduce costs.",
      },
    ],
  },
  {
    id: "plans",
    title: "Plans & Billing",
    items: [
      {
        q: "What can I do on the free trial?",
        a: "The 7-day trial gives you 1 analysis per day, access to 8 valuation models, price charts, fundamentals, and peer comparison. AI thesis, Monte Carlo, LBO, PDF export, and full screener require Pro.",
      },
      {
        q: "What does Pro include?",
        a: "Unlimited analyses, all 12 valuation models, AI investment thesis, Monte Carlo simulation, LBO modelling, PDF export, stock comparison, full screener filters, EVS history, and quarterly financials.",
      },
      {
        q: "Is there a lifetime deal?",
        a: "Yes — Founding Pro is a one-time $99 payment for permanent Pro access. Limited to 100 licenses. Check the upgrade modal to see if any remain.",
      },
      {
        q: "Do you offer a student discount?",
        a: "Yes — 50% off Pro for verified .edu email addresses. Click 'Student? Get 50% off' in the upgrade modal and verify your university email.",
      },
      {
        q: "How does the referral program work?",
        a: "Share your referral link (found on the Refer a Friend page). When someone you refer upgrades to a paid plan, you both get 1 month free.",
      },
    ],
  },
  {
    id: "data",
    title: "Data & Accuracy",
    items: [
      {
        q: "Where does the data come from?",
        a: "Fundamental data comes from Financial Modeling Prep (FMP) API, cached in Supabase. Live prices come from Finnhub. Price history from yfinance. All S&P 500 stocks are covered.",
      },
      {
        q: "How is accuracy tracked?",
        a: "Every night we snapshot each model's intrinsic value prediction. After 6 and 12 months, we compare the predicted direction (above/below current price) against actual price movement. Results are published on the public accuracy dashboard with Wilson score confidence intervals.",
      },
      {
        q: "How often is data refreshed?",
        a: "Analyst data, insider trades, and scores: daily. Key metrics, growth, dividends, segments: weekly. Financial statements and earnings: quarterly. EVS scores: nightly.",
      },
    ],
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};
const stagger = { visible: { transition: { staggerChildren: 0.06 } } };

export default function HelpPage() {
  const navigate = useNavigate();
  const [openSections, setOpenSections] = useState([]);

  const toggle = (id) => {
    setOpenSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };

  return (
    <div className="help-wrap">
      <motion.div initial="hidden" animate="visible" variants={stagger}>
        {/* Header */}
        <motion.div variants={fadeUp} className="help-header">
          <h1 className="help-title">Help & Tutorials</h1>
          <p className="help-sub">Everything you need to get the most out of Equity Value</p>
        </motion.div>

        {/* Getting Started */}
        <motion.section variants={fadeUp} className="help-section">
          <h2 className="help-section-title">Getting Started</h2>
          <div className="help-steps-grid">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                className="help-step-card"
                variants={fadeUp}
                whileHover={{ y: -3, transition: { duration: 0.15 } }}
                onClick={() => navigate(step.link)}
              >
                <div className="help-step-top">
                  <span className="help-step-num">{i + 1}</span>
                  <span className="help-step-icon">{step.icon}</span>
                </div>
                <h3 className="help-step-title">{step.title}</h3>
                <p className="help-step-desc">{step.desc}</p>
                <span className="help-step-link">
                  Learn more
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                  </svg>
                </span>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* FAQ */}
        <motion.section variants={fadeUp} className="help-section">
          <h2 className="help-section-title">Frequently Asked Questions</h2>
          <div className="help-faq">
            {FAQ_SECTIONS.map((section) => {
              const isOpen = openSections.includes(section.id);
              return (
                <div key={section.id} className="help-faq-group">
                  <button
                    className={`help-faq-group-header${isOpen ? " help-faq-group-header--open" : ""}`}
                    onClick={() => toggle(section.id)}
                  >
                    <span>{section.title}</span>
                    <svg
                      width="16" height="16" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="help-faq-items">
                      {section.items.map((item, j) => (
                        <div key={j} className="help-faq-item">
                          <div className="help-faq-q">{item.q}</div>
                          <div className="help-faq-a">{item.a}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </motion.section>

        {/* Contact */}
        <motion.section variants={fadeUp} className="help-contact">
          <h3 className="help-contact-title">Still have questions?</h3>
          <p className="help-contact-desc">
            We're here to help. Reach out and we'll get back to you as soon as possible.
          </p>
          <a className="help-contact-btn" href="mailto:support@equityvalue.ai">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            Email support@equityvalue.ai
          </a>
        </motion.section>
      </motion.div>

      <style>{`
        .help-wrap { max-width: 900px; margin: 0 auto; }
        .help-header { margin-bottom: 36px; }
        .help-title { font-size: 1.6rem; font-weight: 700; color: var(--text); letter-spacing: -0.8px; margin-bottom: 6px; }
        .help-sub { font-size: 0.85rem; color: var(--text2); }

        .help-section { margin-bottom: 40px; }
        .help-section-title {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 1px;
          text-transform: uppercase; color: var(--text3); margin-bottom: 16px;
        }

        /* Getting Started Cards */
        .help-steps-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        @media (max-width: 768px) { .help-steps-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 480px) { .help-steps-grid { grid-template-columns: 1fr; } }

        .help-step-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 22px 20px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .help-step-card:hover { border-color: var(--primary); background: var(--surface2); }

        .help-step-top { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; }
        .help-step-num {
          width: 26px; height: 26px; border-radius: 13px;
          background: var(--primary); color: #fff;
          font-size: 0.75rem; font-weight: 700;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .help-step-icon { color: var(--text3); display: flex; }
        .help-step-title { font-size: 0.92rem; font-weight: 700; color: var(--text); letter-spacing: -0.2px; }
        .help-step-desc { font-size: 0.78rem; color: var(--text2); line-height: 1.55; flex: 1; }
        .help-step-link {
          display: flex; align-items: center; gap: 4px;
          font-size: 0.72rem; color: var(--primary2); font-weight: 600;
          margin-top: 4px;
        }

        /* FAQ */
        .help-faq {
          display: flex; flex-direction: column; gap: 6px;
        }
        .help-faq-group {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .help-faq-group-header {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; background: none; border: none;
          color: var(--text); font-size: 0.9rem; font-weight: 700;
          cursor: pointer; font-family: inherit; text-align: left;
          transition: background 0.15s;
        }
        .help-faq-group-header:hover { background: var(--surface2); }
        .help-faq-group-header--open { background: var(--surface2); }

        .help-faq-items { padding: 0 20px 16px; }
        .help-faq-item {
          padding: 14px 0;
          border-top: 1px solid var(--border);
        }
        .help-faq-item:first-child { border-top: none; }
        .help-faq-q { font-size: 0.85rem; font-weight: 600; color: var(--text); margin-bottom: 6px; }
        .help-faq-a { font-size: 0.8rem; color: var(--text2); line-height: 1.65; }

        /* Contact */
        .help-contact {
          text-align: center; padding: 40px 20px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          display: flex; flex-direction: column; align-items: center; gap: 10px;
        }
        .help-contact-title { font-size: 1.1rem; font-weight: 700; color: var(--text); }
        .help-contact-desc { font-size: 0.82rem; color: var(--text2); max-width: 360px; }
        .help-contact-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: var(--primary); color: #fff; text-decoration: none;
          padding: 10px 24px; border-radius: var(--radius);
          font-size: 0.85rem; font-weight: 700; margin-top: 8px;
          transition: opacity 0.15s;
        }
        .help-contact-btn:hover { opacity: 0.88; }
      `}</style>
    </div>
  );
}
