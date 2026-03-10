import { useState } from "react";

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

const formatCurrency = (v) => {
  if (v == null) return "-";
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Number(v).toLocaleString()}`;
};

const formatShares = (v) => {
  if (v == null) return "-";
  return Number(v).toLocaleString();
};

const typeColor = (type) => {
  const t = (type || "").toLowerCase();
  if (t.includes("buy") || t.includes("purchase") || t.includes("acquisition"))
    return "var(--green2)";
  if (t.includes("sell") || t.includes("sale") || t.includes("disposition"))
    return "var(--red2)";
  return "var(--yellow2)";
};

const PAGE_SIZE = 15;

export default function TradesTable({ trades, type = "insider", title }) {
  const [page, setPage] = useState(0);

  if (!trades || trades.length === 0) return null;

  const isInsider = type === "insider";
  const sorted = [...trades].sort((a, b) => {
    const da = a.transaction_date || a.filing_date || a.disclosure_date || "";
    const db = b.transaction_date || b.filing_date || b.disclosure_date || "";
    return db.localeCompare(da);
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="glass-card" style={{ padding: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h3 className="ci-section-title">
          {title || (isInsider ? "Insider Trades" : "Senate Trades")}
        </h3>
        <span style={{ fontSize: "0.68rem", color: "var(--text3)" }}>
          {sorted.length} transaction{sorted.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="tt-table-wrap">
        <table className="tt-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>{isInsider ? "Name" : "Senator"}</th>
              {!isInsider && <th>Party</th>}
              <th>Type</th>
              <th>{isInsider ? "Shares" : "Amount"}</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {paged.map((t, i) => (
              <tr key={i}>
                <td className="mono" style={{ fontSize: "0.72rem" }}>
                  {formatDate(
                    isInsider
                      ? t.transaction_date || t.filing_date
                      : t.transaction_date || t.disclosure_date
                  )}
                </td>
                <td style={{ fontWeight: 600, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {isInsider ? (
                    <div>
                      <div>{t.reporter_name || "-"}</div>
                      {t.reporter_title && (
                        <div style={{ fontSize: "0.65rem", color: "var(--text3)", fontWeight: 400 }}>
                          {t.reporter_title}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div>{t.senator_name || "-"}</div>
                      {t.state && (
                        <div style={{ fontSize: "0.65rem", color: "var(--text3)", fontWeight: 400 }}>
                          {t.state}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                {!isInsider && (
                  <td>
                    <span
                      className="tt-party-badge"
                      style={{
                        color:
                          t.party === "D"
                            ? "#3b82f6"
                            : t.party === "R"
                            ? "#ef4444"
                            : "var(--text3)",
                      }}
                    >
                      {t.party || "-"}
                    </span>
                  </td>
                )}
                <td>
                  <span style={{ color: typeColor(t.transaction_type), fontWeight: 600, fontSize: "0.72rem" }}>
                    {t.transaction_type || "-"}
                  </span>
                </td>
                <td className="mono" style={{ fontSize: "0.75rem" }}>
                  {isInsider
                    ? formatShares(t.shares_traded)
                    : t.amount_range || "-"}
                </td>
                <td className="mono" style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                  {isInsider
                    ? formatCurrency(t.total_value || (t.shares_traded && t.price ? t.shares_traded * t.price : null))
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="tt-pagination">
          <button
            className="tt-page-btn"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Prev
          </button>
          <span className="tt-page-info">
            {page + 1} / {totalPages}
          </span>
          <button
            className="tt-page-btn"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
          >
            Next
          </button>
        </div>
      )}

      <style>{`
        .tt-table-wrap {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .tt-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.75rem;
        }
        .tt-table th {
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
        .tt-table td {
          padding: 10px 12px;
          color: var(--text2);
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .tt-table tbody tr:last-child td {
          border-bottom: none;
        }
        .tt-table tbody tr:hover {
          background: var(--surface2);
        }
        .tt-party-badge {
          font-weight: 700;
          font-size: 0.72rem;
        }
        .tt-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border);
        }
        .tt-page-btn {
          background: var(--surface2);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 5px 14px;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text2);
          cursor: pointer;
          transition: all 0.15s;
        }
        .tt-page-btn:hover:not(:disabled) {
          background: var(--surface3, var(--surface2));
          color: var(--text);
        }
        .tt-page-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .tt-page-info {
          font-size: 0.7rem;
          color: var(--text3);
        }
      `}</style>
    </div>
  );
}
