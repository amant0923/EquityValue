import { useMemo } from "react";

const fmtNum = (v) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(2);
};

const fmtPct = (v) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (isNaN(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
};

const INCOME_ITEMS = [
  { key: "revenue", label: "Revenue", total: true },
  { key: "cost_of_revenue", label: "Cost of Revenue" },
  { key: "gross_profit", label: "Gross Profit", total: true },
  { key: "gross_margin", label: "Gross Margin", pct: true },
  { key: "research_development", label: "R&D Expenses" },
  { key: "selling_general_admin", label: "SG&A Expenses" },
  { key: "operating_expenses", label: "Total Operating Expenses" },
  { key: "operating_income", label: "Operating Income", total: true },
  { key: "operating_margin", label: "Operating Margin", pct: true },
  { key: "interest_expense", label: "Interest Expense" },
  { key: "income_before_tax", label: "Income Before Tax" },
  { key: "income_tax_expense", label: "Income Tax Expense" },
  { key: "net_income", label: "Net Income", total: true },
  { key: "net_margin", label: "Net Margin", pct: true },
  { key: "eps", label: "EPS (Basic)" },
  { key: "eps_diluted", label: "EPS (Diluted)" },
  { key: "weighted_avg_shares", label: "Shares Outstanding" },
  { key: "ebitda", label: "EBITDA", total: true },
];

const BALANCE_ITEMS = [
  { key: "cash_and_equivalents", label: "Cash & Equivalents" },
  { key: "short_term_investments", label: "Short-term Investments" },
  { key: "accounts_receivable", label: "Accounts Receivable" },
  { key: "inventory", label: "Inventory" },
  { key: "total_current_assets", label: "Total Current Assets", total: true },
  { key: "property_plant_equipment", label: "PP&E (Net)" },
  { key: "goodwill", label: "Goodwill" },
  { key: "intangible_assets", label: "Intangible Assets" },
  { key: "total_assets", label: "Total Assets", total: true },
  { key: "accounts_payable", label: "Accounts Payable" },
  { key: "short_term_debt", label: "Short-term Debt" },
  { key: "total_current_liabilities", label: "Total Current Liabilities", total: true },
  { key: "long_term_debt", label: "Long-term Debt" },
  { key: "total_liabilities", label: "Total Liabilities", total: true },
  { key: "total_stockholders_equity", label: "Stockholders' Equity", total: true },
  { key: "retained_earnings", label: "Retained Earnings" },
  { key: "book_value_per_share", label: "Book Value / Share" },
  { key: "total_debt", label: "Total Debt" },
  { key: "net_debt", label: "Net Debt" },
];

const CASHFLOW_ITEMS = [
  { key: "net_income", label: "Net Income" },
  { key: "depreciation_amortization", label: "Depreciation & Amortization" },
  { key: "stock_based_compensation", label: "Stock-Based Compensation" },
  { key: "change_in_working_capital", label: "Change in Working Capital" },
  { key: "operating_cash_flow", label: "Operating Cash Flow", total: true },
  { key: "capital_expenditures", label: "Capital Expenditures" },
  { key: "acquisitions", label: "Acquisitions" },
  { key: "investing_cash_flow", label: "Investing Cash Flow", total: true },
  { key: "debt_repayment", label: "Debt Repayment" },
  { key: "common_stock_repurchased", label: "Share Buybacks" },
  { key: "dividends_paid", label: "Dividends Paid" },
  { key: "financing_cash_flow", label: "Financing Cash Flow", total: true },
  { key: "free_cash_flow", label: "Free Cash Flow", total: true },
  { key: "net_change_in_cash", label: "Net Change in Cash" },
];

const ITEMS_MAP = {
  income: INCOME_ITEMS,
  balance: BALANCE_ITEMS,
  cashflow: CASHFLOW_ITEMS,
};

export default function StatementTable({ rows, statementType }) {
  const items = ITEMS_MAP[statementType] || INCOME_ITEMS;

  const periods = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return [...rows]
      .sort((a, b) => b.period_date.localeCompare(a.period_date))
      .slice(0, 10);
  }, [rows]);

  if (!rows || rows.length === 0) {
    return (
      <div className="glass-card" style={{ padding: 24, textAlign: "center", color: "var(--text3)" }}>
        No data available.
      </div>
    );
  }

  // Filter items to only show rows that have at least one non-null value
  const visibleItems = items.filter((item) =>
    periods.some((p) => p[item.key] != null && p[item.key] !== "")
  );

  return (
    <div className="glass-card stmt-table-wrap">
      <div className="stmt-table-scroll">
        <table className="stmt-table">
          <thead>
            <tr>
              <th className="stmt-th stmt-th-label">Line Item</th>
              {periods.map((p) => (
                <th key={p.period_date} className="stmt-th stmt-th-val">
                  {formatPeriodDate(p.period_date, p.period_type)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <tr
                key={item.key}
                className={`stmt-tr ${item.total ? "stmt-tr-total" : ""}`}
              >
                <td className="stmt-td stmt-td-label">{item.label}</td>
                {periods.map((p) => (
                  <td key={p.period_date} className="stmt-td stmt-td-val">
                    {item.pct
                      ? fmtPct(computeMargin(p, item.key))
                      : fmtNum(p[item.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .stmt-table-wrap {
          padding: 0;
          overflow: hidden;
        }
        .stmt-table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .stmt-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.78rem;
          min-width: 600px;
        }
        .stmt-th {
          padding: 10px 14px;
          font-weight: 600;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: var(--text3);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          background: var(--surface);
          z-index: 2;
        }
        .stmt-th-label {
          text-align: left;
          min-width: 180px;
          position: sticky;
          left: 0;
          z-index: 3;
          background: var(--surface);
        }
        .stmt-th-val {
          text-align: right;
          min-width: 110px;
        }
        .stmt-tr:hover {
          background: var(--surface2);
        }
        .stmt-tr-total {
          font-weight: 700;
        }
        .stmt-tr-total .stmt-td {
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          background: var(--surface2);
        }
        .stmt-td {
          padding: 8px 14px;
          border-bottom: 1px solid var(--border);
          color: var(--text);
        }
        .stmt-td-label {
          text-align: left;
          color: var(--text2);
          position: sticky;
          left: 0;
          background: var(--surface);
          z-index: 1;
        }
        .stmt-tr-total .stmt-td-label {
          color: var(--text);
        }
        .stmt-td-val {
          text-align: right;
          font-variant-numeric: tabular-nums;
        }
      `}</style>
    </div>
  );
}

function formatPeriodDate(dateStr, periodType) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (periodType === "Q1" || periodType === "Q2" || periodType === "Q3" || periodType === "Q4") {
    return `${periodType} ${d.getFullYear()}`;
  }
  return `FY ${d.getFullYear()}`;
}

function computeMargin(row, key) {
  if (!row.revenue || row.revenue === 0) return null;
  if (key === "gross_margin" && row.gross_profit != null) return row.gross_profit / row.revenue;
  if (key === "operating_margin" && row.operating_income != null) return row.operating_income / row.revenue;
  if (key === "net_margin" && row.net_income != null) return row.net_income / row.revenue;
  return row[key];
}
