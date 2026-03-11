import { useEffect, useState } from "react";
import { motion } from "framer-motion";

const VERDICT_CONFIG = {
  "Undervalued":   { color: "var(--green2)",  glow: "var(--green-glow)",  bg: "rgba(16,185,129,0.06)", border: "rgba(16,185,129,0.2)",  icon: "↑", score: 80 },
  "Overvalued":    { color: "var(--red2)",    glow: "var(--red-glow)",    bg: "rgba(239,68,68,0.06)",  border: "rgba(239,68,68,0.2)",   icon: "↓", score: 25 },
  "Fairly Valued": { color: "var(--yellow2)", glow: "var(--yellow-glow)", bg: "rgba(245,158,11,0.06)", border: "rgba(245,158,11,0.2)",  icon: "→", score: 52 },
};

function useCountUp(target, duration = 900, decimals = 2) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const step = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease out
      setVal(parseFloat((target * ease).toFixed(decimals)));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target]);
  return val;
}

function ScoreRing({ score, color, size = 90 }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const [dash, setDash] = useState(circ);

  useEffect(() => {
    const target = circ * (1 - score / 100);
    const timeout = setTimeout(() => setDash(target), 100);
    return () => clearTimeout(timeout);
  }, [score, circ]);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth="6" />
      <circle
        cx={size/2} cy={size/2} r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={dash}
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)", filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <text x={size/2} y={size/2 + 5} textAnchor="middle" fill={color} fontSize="16" fontWeight="700" fontFamily="JetBrains Mono, monospace">
        {score}
      </text>
    </svg>
  );
}

export default function ConsensusCard({ data, signals }) {
  const cfg = VERDICT_CONFIG[data.overall_verdict] || VERDICT_CONFIG["Fairly Valued"];
  const sign = data.upside_pct > 0 ? "+" : "";
  const animatedPrice = useCountUp(parseFloat(data.average_intrinsic_value) || 0, 1000);
  const animatedUpside = useCountUp(Math.abs(parseFloat(data.upside_pct) || 0), 800, 1);

  return (
    <motion.div
      className="cc-wrap"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={{ borderColor: cfg.border, background: cfg.bg }}
    >
      {/* Left: verdict + details */}
      <div className="cc-left">
        <div className="cc-eyebrow-row">
          <span className="cc-eyebrow">EV Model Consensus</span>
          <span className="cc-models-badge">{data.models_used} models</span>
        </div>

        <div className="cc-verdict-row">
          <span className="cc-verdict-icon" style={{ color: cfg.color }}>{cfg.icon}</span>
          <h2 className="cc-verdict" style={{ color: cfg.color }}>{data.overall_verdict}</h2>
        </div>

        <p className="cc-sub">
          Weighted average of {data.models_used} Equity Valuation models (not Wall Street analyst targets)
        </p>

        <div className="cc-meta-row">
          {data.confidence && (
            <span className="cc-conf-badge" style={{ color: cfg.color, borderColor: cfg.border, background: cfg.bg }}>
              {data.confidence} Confidence
            </span>
          )}
          <span className="cc-margin-note">
            Margin of safety: {Math.abs(data.upside_pct)}%
          </span>
        </div>
      </div>

      {/* Centre: score ring */}
      <div className="cc-centre">
        <ScoreRing score={cfg.score} color={cfg.color} size={88} />
        <span className="cc-score-label">Score</span>
      </div>

      {/* Right: prices */}
      <div className="cc-right">
        <div className="cc-price-block">
          <span className="cc-price-label">Intrinsic Value</span>
          <span className="cc-price mono" style={{ textShadow: `0 0 20px ${cfg.color}44` }}>
            ${animatedPrice.toFixed(2)}
          </span>
        </div>
        <div className="cc-upside-block">
          <span className="cc-upside mono" style={{ color: cfg.color }}>
            {sign}{animatedUpside.toFixed(1)}%
          </span>
          <span className="cc-current">vs ${data.current_price}</span>
        </div>
      </div>

      {signals?.extreme_premium && (
        <div className="cc-premium-warning">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>{signals.extreme_premium.message}</span>
        </div>
      )}

      <style>{`
        .cc-wrap {
          border: 1px solid;
          border-radius: var(--radius-lg);
          padding: 28px 32px;
          display: flex;
          align-items: center;
          gap: 32px;
          flex-wrap: wrap;
          position: relative;
          overflow: hidden;
        }
        .cc-wrap::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse 60% 80% at 0% 50%, rgba(255,255,255,0.015), transparent);
          pointer-events: none;
        }

        .cc-left { flex: 1; min-width: 200px; }
        .cc-eyebrow-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
        .cc-eyebrow {
          font-size: 0.68rem; font-weight: 600; letter-spacing: 1.2px;
          text-transform: uppercase; color: var(--text3);
        }
        .cc-models-badge {
          font-size: 0.65rem; font-weight: 700; letter-spacing: 0.5px;
          text-transform: uppercase; color: var(--text3);
          background: var(--surface2); border: 1px solid var(--border);
          padding: 2px 8px; border-radius: 20px;
        }
        .cc-verdict-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
        .cc-verdict-icon { font-size: 1.8rem; font-weight: 700; line-height: 1; }
        .cc-verdict {
          font-size: 2rem; font-weight: 800; letter-spacing: -1px;
          line-height: 1;
        }
        .cc-sub { font-size: 0.78rem; color: var(--text3); margin-bottom: 14px; }
        .cc-meta-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .cc-conf-badge {
          font-size: 0.65rem; font-weight: 700; letter-spacing: 0.5px;
          text-transform: uppercase; padding: 3px 10px; border-radius: 20px;
          border: 1px solid;
        }
        .cc-margin-note { font-size: 0.72rem; color: var(--text3); }

        .cc-centre { display: flex; flex-direction: column; align-items: center; gap: 4px; }
        .cc-score-label {
          font-size: 0.65rem; font-weight: 600; letter-spacing: 1px;
          text-transform: uppercase; color: var(--text3);
        }

        .cc-right { text-align: right; }
        .cc-price-block { margin-bottom: 12px; }
        .cc-price-label {
          display: block; font-size: 0.65rem; font-weight: 600;
          letter-spacing: 1px; text-transform: uppercase; color: var(--text3); margin-bottom: 4px;
        }
        .cc-price {
          display: block; font-size: 2.6rem; font-weight: 700;
          letter-spacing: -2px; color: var(--text); line-height: 1;
        }
        .cc-upside-block { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
        .cc-upside { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.5px; }
        .cc-current { font-size: 0.75rem; color: var(--text3); }

        .cc-premium-warning {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          width: 100%;
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: var(--radius);
          padding: 12px 16px;
          font-size: 0.75rem;
          color: var(--yellow2);
          line-height: 1.55;
        }
        .cc-premium-warning svg { flex-shrink: 0; margin-top: 1px; }

        @media (max-width: 640px) {
          .cc-wrap { padding: 20px; gap: 20px; }
          .cc-verdict { font-size: 1.5rem; }
          .cc-price { font-size: 2rem; }
          .cc-centre { display: none; }
        }
      `}</style>
    </motion.div>
  );
}
