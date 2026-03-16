import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const DEFAULT_GROUPS = [
  { id: "all", name: "All", icon: "list" },
];

const lsGet = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const lsSet = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

export default function WatchlistGroups({ watchlist, onGroupFilter }) {
  const [groups, setGroups] = useState(() => lsGet("ve_wl_groups", DEFAULT_GROUPS));
  const [assignments, setAssignments] = useState(() => lsGet("ve_wl_assign", {}));
  const [activeGroup, setActiveGroup] = useState("all");
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingTicker, setEditingTicker] = useState(null);

  const customGroups = groups.filter(g => g.id !== "all");

  const addGroup = () => {
    const name = newName.trim();
    if (!name || groups.some(g => g.name.toLowerCase() === name.toLowerCase())) return;
    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    const updated = [...groups, { id, name }];
    setGroups(updated);
    lsSet("ve_wl_groups", updated);
    setNewName("");
    setShowAdd(false);
  };

  const removeGroup = (gid) => {
    const updated = groups.filter(g => g.id !== gid);
    setGroups(updated);
    lsSet("ve_wl_groups", updated);
    const newAssign = { ...assignments };
    Object.keys(newAssign).forEach(t => {
      if (newAssign[t] === gid) delete newAssign[t];
    });
    setAssignments(newAssign);
    lsSet("ve_wl_assign", newAssign);
    if (activeGroup === gid) {
      setActiveGroup("all");
      onGroupFilter(null);
    }
  };

  const assignTicker = (ticker, groupId) => {
    const updated = { ...assignments, [ticker]: groupId || undefined };
    if (!groupId) delete updated[ticker];
    setAssignments(updated);
    lsSet("ve_wl_assign", updated);
    setEditingTicker(null);
  };

  const handleGroupClick = (gid) => {
    setActiveGroup(gid);
    if (gid === "all") {
      onGroupFilter(null);
    } else {
      const tickers = watchlist.filter(t => assignments[t] === gid);
      onGroupFilter(tickers);
    }
  };

  const getGroupCount = (gid) => {
    if (gid === "all") return watchlist.length;
    return watchlist.filter(t => assignments[t] === gid).length;
  };

  return (
    <div className="wlg-wrap">
      <div className="wlg-tabs">
        {groups.map(g => (
          <button
            key={g.id}
            className={`wlg-tab${activeGroup === g.id ? " wlg-tab--active" : ""}`}
            onClick={() => handleGroupClick(g.id)}
          >
            {g.name}
            <span className="wlg-tab-count">{getGroupCount(g.id)}</span>
            {g.id !== "all" && (
              <span className="wlg-tab-remove" onClick={(e) => { e.stopPropagation(); removeGroup(g.id); }}>
                &times;
              </span>
            )}
          </button>
        ))}
        <button className="wlg-add-btn" onClick={() => setShowAdd(!showAdd)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            className="wlg-add-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <input
              className="wlg-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Group name (e.g. AI Plays)"
              onKeyDown={(e) => e.key === "Enter" && addGroup()}
              maxLength={24}
              autoFocus
            />
            <button className="wlg-save-btn" onClick={addGroup} disabled={!newName.trim()}>Add</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ticker assignment popover */}
      {editingTicker && customGroups.length > 0 && (
        <div className="wlg-assign-popover">
          <div className="wlg-assign-header">Assign {editingTicker} to group:</div>
          <button className="wlg-assign-opt" onClick={() => assignTicker(editingTicker, null)}>
            No group
          </button>
          {customGroups.map(g => (
            <button
              key={g.id}
              className={`wlg-assign-opt${assignments[editingTicker] === g.id ? " wlg-assign-opt--active" : ""}`}
              onClick={() => assignTicker(editingTicker, g.id)}
            >
              {g.name}
            </button>
          ))}
          <button className="wlg-assign-close" onClick={() => setEditingTicker(null)}>Done</button>
        </div>
      )}

      <style>{`
        .wlg-wrap { margin-bottom: 12px; }
        .wlg-tabs { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .wlg-tab {
          display: flex; align-items: center; gap: 5px;
          background: var(--surface); border: 1px solid var(--border);
          color: var(--text3); padding: 5px 12px; border-radius: 16px;
          font-size: 0.72rem; font-weight: 600; cursor: pointer;
          font-family: inherit; transition: all 0.15s;
        }
        .wlg-tab:hover { border-color: var(--primary); color: var(--text); }
        .wlg-tab--active { background: var(--primary); color: #fff; border-color: var(--primary); }
        .wlg-tab-count { font-size: 0.65rem; opacity: 0.7; }
        .wlg-tab-remove { margin-left: 2px; font-size: 0.85rem; opacity: 0.5; cursor: pointer; }
        .wlg-tab-remove:hover { opacity: 1; }
        .wlg-add-btn {
          width: 28px; height: 28px; border-radius: 14px;
          background: var(--surface); border: 1px dashed var(--border);
          color: var(--text3); cursor: pointer; display: flex;
          align-items: center; justify-content: center; transition: all 0.15s;
        }
        .wlg-add-btn:hover { border-color: var(--primary); color: var(--primary2); }
        .wlg-add-form { display: flex; gap: 8px; padding: 8px 0; overflow: hidden; }
        .wlg-input {
          flex: 1; background: var(--surface); border: 1px solid var(--border);
          color: var(--text); padding: 6px 12px; border-radius: 8px;
          font-size: 0.78rem; font-family: inherit; outline: none;
        }
        .wlg-input:focus { border-color: var(--primary); }
        .wlg-save-btn {
          background: var(--primary); color: #fff; border: none;
          padding: 6px 16px; border-radius: 8px; font-size: 0.78rem;
          font-weight: 700; cursor: pointer; font-family: inherit;
        }
        .wlg-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .wlg-assign-popover {
          position: absolute; z-index: 100; background: var(--surface);
          border: 1px solid var(--border); border-radius: 8px;
          padding: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);
          min-width: 160px;
        }
        .wlg-assign-header { font-size: 0.72rem; color: var(--text3); margin-bottom: 6px; font-weight: 600; }
        .wlg-assign-opt {
          display: block; width: 100%; text-align: left;
          background: none; border: none; color: var(--text2);
          padding: 6px 10px; border-radius: 4px; font-size: 0.78rem;
          cursor: pointer; font-family: inherit;
        }
        .wlg-assign-opt:hover { background: var(--surface2); }
        .wlg-assign-opt--active { color: var(--primary2); font-weight: 600; }
        .wlg-assign-close {
          display: block; width: 100%; margin-top: 6px;
          background: var(--surface2); border: none; color: var(--text3);
          padding: 5px; border-radius: 4px; font-size: 0.72rem;
          cursor: pointer; font-family: inherit;
        }
      `}</style>
    </div>
  );
}

export { lsGet, lsSet };
