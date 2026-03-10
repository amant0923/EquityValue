const formatValue = (val) => {
  if (val == null) return "-";
  if (typeof val === "number") {
    if (Math.abs(val) >= 1e9) return `${(val / 1e9).toFixed(1)}B`;
    if (Math.abs(val) >= 1e6) return `${(val / 1e6).toFixed(1)}M`;
    return val.toFixed(2);
  }
  return String(val);
};

const SCORES = [
  {
    key: "altman_z_score",
    label: "Altman Z-Score",
    description: "Bankruptcy risk indicator",
    thresholds: [
      { max: 1.81, label: "Distress", color: "var(--red2)" },
      { max: 2.99, label: "Grey Zone", color: "var(--yellow2)" },
      { max: Infinity, label: "Safe", color: "var(--green2)" },
    ],
  },
  {
    key: "piotroski_score",
    label: "Piotroski F-Score",
    description: "Financial strength (0-9)",
    thresholds: [
      { max: 3, label: "Weak", color: "var(--red2)" },
      { max: 6, label: "Moderate", color: "var(--yellow2)" },
      { max: Infinity, label: "Strong", color: "var(--green2)" },
    ],
  },
  {
    key: "dcf_value",
    label: "DCF Value",
    description: "Discounted cash flow intrinsic value",
    thresholds: null,
    isCurrency: true,
  },
  {
    key: "levered_dcf",
    label: "Levered DCF",
    description: "DCF with leverage adjustment",
    thresholds: null,
    isCurrency: true,
  },
  {
    key: "owner_earnings",
    label: "Owner Earnings",
    description: "Buffett-style owner earnings",
    thresholds: null,
    isCurrency: true,
  },
  {
    key: "owner_earnings_per_share",
    label: "Owner Earnings/Share",
    description: "Per-share owner earnings",
    thresholds: null,
    isCurrency: true,
  },
];

function getThresholdInfo(score, value) {
  if (!score.thresholds || value == null) return { label: null, color: "var(--text2)" };
  for (const t of score.thresholds) {
    if (value <= t.max) return { label: t.label, color: t.color };
  }
  return { label: null, color: "var(--text2)" };
}

export default function ScoresRadar({ scores }) {
  if (!scores) return null;

  const hasAny = SCORES.some((s) => scores[s.key] != null);
  if (!hasAny) return null;

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 className="ci-section-title" style={{ marginBottom: 16 }}>
        Financial Scores
      </h3>

      <div className="sr-grid">
        {SCORES.map((s) => {
          const val = scores[s.key];
          if (val == null) return null;
          const info = getThresholdInfo(s, val);
          return (
            <div key={s.key} className="sr-card">
              <div className="sr-card-label">{s.label}</div>
              <div className="sr-card-value mono" style={{ color: info.color }}>
                {s.isCurrency ? `$${formatValue(val)}` : formatValue(val)}
              </div>
              {info.label && (
                <span className="sr-card-badge" style={{ color: info.color, borderColor: info.color }}>
                  {info.label}
                </span>
              )}
              <div className="sr-card-desc">{s.description}</div>
            </div>
          );
        })}
      </div>

      <style>{`
        .sr-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 12px;
        }
        .sr-card {
          background: var(--surface2);
          border-radius: 10px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .sr-card-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .sr-card-value {
          font-size: 1.3rem;
          font-weight: 700;
          color: var(--text);
          line-height: 1.2;
        }
        .sr-card-badge {
          display: inline-block;
          font-size: 0.62rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          border: 1px solid;
          width: fit-content;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .sr-card-desc {
          font-size: 0.65rem;
          color: var(--text3);
          margin-top: 4px;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
