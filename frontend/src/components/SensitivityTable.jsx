
export default function SensitivityTable({ data, currentPrice }) {
  if (!data) return null;
  const { waccs, growths, table } = data;
  return (
    <div className="sens-wrap">
      <div className="sens-header">
        <span className="sens-title">DCF Sensitivity Analysis</span>
        <span className="sens-sub">Intrinsic value per share across WACC and FCF growth rate assumptions</span>
      </div>
      <div className="sens-table-wrap">
        <table className="sens-table">
          <thead>
            <tr>
              <th className="sens-corner">Growth \ WACC</th>
              {waccs.map(w => <th key={w}>{w}</th>)}
            </tr>
          </thead>
          <tbody>
            {growths.map((g, gi) => (
              <tr key={g}>
                <td className="sens-row-label">{g}</td>
                {table[gi].map((val, wi) => {
                  const pct = (val - currentPrice) / currentPrice;
                  const bg = pct > 0.15 ? "rgba(16,185,129,0.18)" : pct < -0.15 ? "rgba(220,38,38,0.14)" : "rgba(217,119,6,0.12)";
                  const color = pct > 0.15 ? "var(--green2)" : pct < -0.15 ? "var(--red2)" : "var(--yellow2)";
                  return (
                    <td key={wi} style={{ background: bg, color }}>
                      ${val}
                      <div className="sens-pct">{pct >= 0 ? "+" : ""}{(pct*100).toFixed(0)}%</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
