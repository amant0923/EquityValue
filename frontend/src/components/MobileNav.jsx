import { motion } from "framer-motion";

const NAV = [
  {
    id: "dashboard",
    label: "Home",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: "analysis",
    label: "Analyse",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: "screener",
    label: "Screen",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
    ),
  },
  {
    id: "compare",
    label: "Compare",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
];

export default function MobileNav({ page, setPage }) {
  return (
    <nav className="mobile-nav">
      {NAV.map((item) => {
        const active = page === item.id;
        return (
          <button
            key={item.id}
            className={`mobile-nav-item${active ? " mobile-nav-item--active" : ""}`}
            onClick={() => setPage(item.id)}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span className="mobile-nav-label">{item.label}</span>
            {active && (
              <motion.div
                className="mobile-nav-indicator"
                layoutId="mobileIndicator"
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
          </button>
        );
      })}

      <style>{`
        .mobile-nav {
          display: none;
        }
        @media (max-width: 768px) {
          .mobile-nav {
            display: flex;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            z-index: 200;
            background: var(--surface);
            border-top: 1px solid var(--border);
            padding: 8px 0 max(8px, env(safe-area-inset-bottom));
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
          }
          .mobile-nav-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding: 6px 4px;
            background: none;
            border: none;
            cursor: pointer;
            font-family: inherit;
            color: var(--text3);
            position: relative;
            transition: color 0.15s;
          }
          .mobile-nav-item--active {
            color: var(--primary2);
          }
          .mobile-nav-icon {
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .mobile-nav-label {
            font-size: 0.62rem;
            font-weight: 600;
            letter-spacing: 0.3px;
          }
          .mobile-nav-indicator {
            position: absolute;
            top: 0;
            left: 20%;
            right: 20%;
            height: 2px;
            background: var(--primary);
            border-radius: 0 0 3px 3px;
          }
        }
      `}</style>
    </nav>
  );
}
