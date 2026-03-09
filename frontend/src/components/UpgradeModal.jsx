import { motion } from "framer-motion";

const PLANS = [
  {
    name: "Pro",
    price: "$30",
    period: "/month",
    limit: "5 analyses/day",
    features: ["5 analyses per day", "All 12 valuation models", "AI investment thesis", "Monte Carlo simulation", "LBO model", "PDF export", "Compare stocks", "Full screener"],
    cta: "Upgrade to Pro",
    color: "var(--primary)",
  },
  {
    name: "Max",
    price: "$50",
    period: "/month",
    limit: "Unlimited",
    features: ["Unlimited analyses", "Everything in Pro", "Priority data refresh", "Early access to new features"],
    cta: "Upgrade to Max",
    color: "var(--indigo)",
    featured: true,
  },
];

export default function UpgradeModal({ onClose, reason = "limit" }) {
  return (
    <motion.div
      className="upg-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="upg-modal"
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <button className="upg-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="upg-header">
          <h2 className="upg-title">
            {reason === "limit" ? "Daily limit reached" : "Upgrade to unlock"}
          </h2>
          <p className="upg-sub">
            {reason === "limit"
              ? "You've used all your free analyses for today. Upgrade for more."
              : "This feature is available on Pro and Max plans."}
          </p>
        </div>

        <div className="upg-plans">
          {PLANS.map((plan, i) => (
            <div key={i} className={`upg-plan${plan.featured ? " upg-plan--featured" : ""}`}>
              <div className="upg-plan-name">{plan.name}</div>
              <div className="upg-plan-price">
                <span className="upg-plan-amount mono">{plan.price}</span>
                <span className="upg-plan-period">{plan.period}</span>
              </div>
              <div className="upg-plan-limit">{plan.limit}</div>
              <ul className="upg-plan-features">
                {plan.features.map((f, j) => (
                  <li key={j}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <button className="upg-plan-cta" style={{ background: plan.color }}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <p className="upg-note">Payment integration coming soon. Contact us for early access.</p>
      </motion.div>

      <style>{`
        .upg-overlay {
          position: fixed; inset: 0;
          background: rgba(0,0,0,0.85);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
        }
        .upg-modal {
          background: var(--surface);
          border: 1px solid var(--border2);
          border-radius: var(--radius-xl);
          max-width: 600px; width: 100%;
          padding: 36px;
          position: relative;
        }
        .upg-close {
          position: absolute;
          top: 16px; right: 16px;
          background: transparent;
          border: none;
          color: var(--text3);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: color 0.2s;
        }
        .upg-close:hover { color: var(--text); }

        .upg-header { text-align: center; margin-bottom: 28px; }
        .upg-title { font-size: 1.2rem; font-weight: 700; color: var(--text); margin-bottom: 8px; }
        .upg-sub { font-size: 0.82rem; color: var(--text2); }

        .upg-plans { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
        .upg-plan {
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .upg-plan--featured {
          border-color: rgba(129,140,248,0.35);
          background: rgba(129,140,248,0.04);
        }
        .upg-plan-name {
          font-size: 0.72rem; font-weight: 700; letter-spacing: 1px;
          text-transform: uppercase; color: var(--text3);
        }
        .upg-plan-price { display: flex; align-items: baseline; gap: 2px; }
        .upg-plan-amount { font-size: 2rem; font-weight: 700; color: var(--text); letter-spacing: -1px; }
        .upg-plan-period { font-size: 0.82rem; color: var(--text3); }
        .upg-plan-limit {
          font-size: 0.78rem; font-weight: 600; color: var(--primary2);
          margin-bottom: 8px;
        }
        .upg-plan-features {
          list-style: none; display: flex; flex-direction: column; gap: 6px;
          margin-bottom: 16px; flex: 1;
        }
        .upg-plan-features li {
          display: flex; align-items: center; gap: 8px;
          font-size: 0.78rem; color: var(--text2);
        }
        .upg-plan-cta {
          width: 100%;
          color: #fff;
          border: none;
          padding: 10px;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .upg-plan-cta:hover { opacity: 0.88; }

        .upg-note {
          text-align: center;
          font-size: 0.72rem;
          color: var(--text3);
        }

        @media (max-width: 540px) {
          .upg-plans { grid-template-columns: 1fr; }
          .upg-modal { padding: 24px 20px; }
        }
      `}</style>
    </motion.div>
  );
}
