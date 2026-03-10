const fmtNum = (v, dec = 2) => v != null ? Number(v).toFixed(dec) : "—";
const fmtPct = (v) => v != null ? `${(Number(v) * 100).toFixed(1)}%` : "—";

const METRICS = [
  { label: "P/E Ratio", key: "pe_ratio", fallbackKey: "pe_ratio", fmt: fmtNum },
  { label: "EV/EBITDA", key: "enterprise_value_over_ebitda", fallbackKey: "ev_to_ebitda", fmt: fmtNum },
  { label: "P/B Ratio", key: "pb_ratio", fallbackKey: "pb_ratio", fmt: fmtNum },
  { label: "ROE", key: "roe", fallbackKey: "roe", fmt: fmtPct, color: v => v > 0.15 ? "var(--green2)" : v < 0 ? "var(--red2)" : null },
  { label: "ROA", key: "roa", fallbackKey: "roa", fmt: fmtPct, color: v => v > 0.05 ? "var(--green2)" : v < 0 ? "var(--red2)" : null },
  { label: "Current Ratio", key: "current_ratio", fallbackKey: "current_ratio", fmt: fmtNum },
  { label: "D/E Ratio", key: "debt_to_equity", fallbackKey: "debt_to_equity", fmt: fmtNum },
  { label: "Div. Yield", key: "dividend_yield", fallbackKey: "dividend_yield", fmt: fmtPct },
];

export default function KeyMetricsRow({ company, metrics }) {
  // Use latest metrics entry, fall back to stock_fundamentals (company) data
  const latest = metrics?.[0] || {};
  const co = company || {};

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 className="km-title">Key Metrics</h3>
      <div className="km-grid">
        {METRICS.map((m) => {
          const val = latest[m.key] ?? co[m.fallbackKey] ?? null;
          const colorFn = m.color;
          const color = colorFn && val != null ? colorFn(val) : null;
          return (
            <div key={m.key} className="km-card">
              <span className="km-label">{m.label}</span>
              <span className="km-value mono" style={color ? { color } : {}}>
                {m.fmt(val)}
              </span>
            </div>
          );
        })}
      </div>

      <style>{`
        .km-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 14px;
        }
        .km-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        .km-card {
          background: var(--surface2);
          border-radius: 8px;
          padding: 12px 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .km-label {
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .km-value {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
        }
        @media (max-width: 768px) {
          .km-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 480px) {
          .km-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </div>
  );
}
