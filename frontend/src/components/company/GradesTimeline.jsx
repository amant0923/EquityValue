export default function GradesTimeline({ grades }) {
  if (!grades || grades.length === 0) return null;

  const actionColor = (action) => {
    const a = (action || "").toLowerCase();
    if (a.includes("upgrade") || a.includes("initiated") || a.includes("reiterated"))
      return "var(--green2)";
    if (a.includes("downgrade")) return "var(--red2)";
    return "var(--yellow2)";
  };

  const formatDate = (d) => {
    if (!d) return "-";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <h3 className="ci-section-title" style={{ marginBottom: 16 }}>
        Recent Grade Changes
      </h3>

      <div className="gt-table-wrap">
        <table className="gt-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Firm</th>
              <th>Action</th>
              <th>From</th>
              <th>To</th>
            </tr>
          </thead>
          <tbody>
            {grades.slice(0, 20).map((g, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: "0.72rem" }}>
                  {formatDate(g.date)}
                </td>
                <td style={{ fontWeight: 600 }}>{g.firm || "-"}</td>
                <td>
                  <span
                    className="gt-action-badge"
                    style={{ color: actionColor(g.action) }}
                  >
                    {g.action || "-"}
                  </span>
                </td>
                <td className="gt-grade">{g.previous || "-"}</td>
                <td className="gt-grade" style={{ fontWeight: 600 }}>
                  {g.current || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .ci-section-title {
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 12px;
        }
        .gt-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .gt-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.75rem;
        }
        .gt-table th {
          text-align: left;
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text3);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .gt-table td {
          padding: 10px 12px;
          color: var(--text2);
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .gt-table tbody tr:last-child td {
          border-bottom: none;
        }
        .gt-table tbody tr:hover {
          background: var(--surface2);
        }
        .gt-action-badge {
          font-weight: 600;
          font-size: 0.72rem;
        }
        .gt-grade {
          font-size: 0.72rem;
          color: var(--text2);
        }
      `}</style>
    </div>
  );
}
