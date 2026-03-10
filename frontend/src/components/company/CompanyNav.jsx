import { NavLink, useParams } from "react-router-dom";

const tabs = [
  { label: "Summary", path: "" },
  { label: "Financials", path: "/financials" },
  { label: "Company Intelligence", path: "/intelligence" },
  { label: "Valuation Modelling", path: "/valuation" },
];

export default function CompanyNav() {
  const { ticker } = useParams();
  const base = `/company/${ticker}`;

  return (
    <nav className="company-nav">
      {tabs.map((tab) => (
        <NavLink
          key={tab.path}
          to={`${base}${tab.path}`}
          end={tab.path === ""}
          className={({ isActive }) =>
            `company-nav-tab ${isActive ? "active" : ""}`
          }
        >
          {tab.label}
        </NavLink>
      ))}

      <style>{`
        .company-nav {
          display: flex;
          gap: 4px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 24px;
          padding-bottom: 0;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .company-nav-tab {
          padding: 10px 18px;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text3);
          text-decoration: none;
          border-bottom: 2px solid transparent;
          transition: color 0.2s, border-color 0.2s;
          white-space: nowrap;
        }
        .company-nav-tab:hover {
          color: var(--text);
        }
        .company-nav-tab.active {
          color: var(--primary2);
          border-bottom-color: var(--primary2);
        }
        @media (max-width: 640px) {
          .company-nav-tab {
            padding: 8px 12px;
            font-size: 0.75rem;
          }
        }
      `}</style>
    </nav>
  );
}
