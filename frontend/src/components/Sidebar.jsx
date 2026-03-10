import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const NAV = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: "analysis",
    label: "Analysis",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: "screener",
    label: "Screener",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
      </svg>
    ),
  },
  {
    id: "compare",
    label: "Compare",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    id: "portfolio",
    label: "Portfolio",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
      </svg>
    ),
  },
];

export default function Sidebar({ page, setPage, onBackToLanding, onCollapseChange }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      className="sidebar"
      animate={{ width: collapsed ? 60 : 220 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {/* Logo */}
      <div className="sb-logo" onClick={onBackToLanding} title="Equity Valuation Home">
        <div className="sb-logo-mark">
          <svg viewBox="0 0 16 16" fill="none">
            <polyline points="1,12 5,7 9,10 15,3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.span
              className="sb-logo-text"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              Equity Valuation
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav items */}
      <nav className="sb-nav">
        {NAV.map((item) => {
          const active = page === item.id;
          return (
            <button
              key={item.id}
              className={`sb-nav-item${active ? " sb-nav-item--active" : ""}`}
              onClick={() => setPage(item.id)}
              title={collapsed ? item.label : undefined}
            >
              <span className="sb-nav-icon">{item.icon}</span>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    className="sb-nav-label"
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {active && (
                <motion.div
                  className="sb-nav-active-indicator"
                  layoutId="activeIndicator"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom: collapse toggle */}
      <div className="sb-bottom">
        <button
          className="sb-collapse-btn"
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            if (onCollapseChange) onCollapseChange(next);
          }}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: collapsed ? "rotate(180deg)" : "none", transition: "transform 0.25s" }}
          >
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      <style>{`
        .sidebar {
          position: fixed;
          left: 0; top: 0; bottom: 0;
          background: var(--surface);
          border-right: 1px solid var(--glass-border);
          display: flex;
          flex-direction: column;
          z-index: 200;
          overflow: hidden;
          will-change: width;
        }
        .sidebar::after {
          content: '';
          position: absolute;
          top: 0; right: 0; bottom: 0;
          width: 1px;
          background: linear-gradient(180deg, rgba(255,255,255,0.06), transparent 50%, rgba(255,255,255,0.03));
          pointer-events: none;
        }

        .sb-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 18px 16px;
          height: var(--header-h);
          border-bottom: 1px solid var(--border);
          cursor: pointer;
          text-decoration: none;
          overflow: hidden;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .sb-logo:hover .sb-logo-mark { transform: scale(1.05); }

        .sb-logo-mark {
          width: 28px; height: 28px; flex-shrink: 0;
          background: linear-gradient(135deg, var(--primary), var(--indigo));
          border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          transition: transform 0.2s;
          box-shadow: 0 0 12px rgba(59,130,246,0.35);
        }
        .sb-logo-mark svg { width: 16px; height: 16px; }

        .sb-logo-text {
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.3px;
          white-space: nowrap;
        }

        .sb-nav {
          flex: 1;
          padding: 12px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow: hidden;
        }

        .sb-nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: var(--text3);
          cursor: pointer;
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 500;
          text-align: left;
          transition: color 0.15s, background 0.15s;
          white-space: nowrap;
          overflow: hidden;
          width: 100%;
        }
        .sb-nav-item:hover { background: var(--surface2); color: var(--text2); }
        .sb-nav-item--active { color: var(--text) !important; }
        .sb-nav-item--active .sb-nav-icon { color: var(--primary2); }

        .sb-nav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
        }

        .sb-nav-label { flex: 1; }

        .sb-nav-active-indicator {
          position: absolute;
          left: 0; top: 20%; bottom: 20%;
          width: 3px;
          background: var(--primary);
          border-radius: 0 3px 3px 0;
          box-shadow: 0 0 8px var(--primary);
        }

        .sb-bottom {
          padding: 12px 10px;
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }

        .sb-collapse-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 10px;
          border: none;
          background: transparent;
          color: var(--text3);
          cursor: pointer;
          font-family: inherit;
          font-size: 0.8rem;
          border-radius: 6px;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap;
          overflow: hidden;
        }
        .sb-collapse-btn:hover { background: var(--surface2); color: var(--text2); }
      `}</style>
    </motion.aside>
  );
}
