
export default function PeerComparison({ data }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="peer-wrap">
      <div className="peer-header">
        <span className="peer-title">Sector Peer Comparison</span>
        <span className="peer-sub">Company multiples vs sector median — higher than median implies premium valuation</span>
      </div>
      <div className="peer-table-wrap">
        <table className="peer-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>This Company</th>
              <th>Sector Median</th>
              <th>Premium / Discount</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => {
              const premium = row.diff_pct > 0;
              const color = premium ? "var(--red2)" : "var(--green2)";
              return (
                <tr key={i}>
                  <td className="peer-metric">{row.metric}</td>
                  <td className="peer-val">{row.company}x</td>
                  <td className="peer-val peer-median">{row.sector_median}x</td>
                  <td style={{ color }} className="peer-diff">
                    {premium ? "+" : ""}{row.diff_pct}%
                    <div className="peer-bar-wrap">
                      <div className="peer-bar" style={{ width: `${Math.min(Math.abs(row.diff_pct), 100)}%`, background: color, marginLeft: premium ? "50%" : `${50 - Math.min(Math.abs(row.diff_pct), 50)}%` }} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
