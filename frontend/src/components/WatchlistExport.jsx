import { useState } from "react";
import api from "../lib/api";

export default function WatchlistExport({ watchlist, watchlistEvs }) {
  const [showMenu, setShowMenu] = useState(false);
  const [shareLink, setShareLink] = useState(null);
  const [copying, setCopying] = useState(false);

  const exportCSV = () => {
    if (!watchlist.length) return;
    const headers = ["Ticker", "EVS Score", "Verdict", "Sector Percentile"];
    const rows = watchlist.map(sym => {
      const evs = watchlistEvs[sym];
      return [
        sym,
        evs?.score ?? "",
        evs?.verdict ?? "",
        evs?.sector_percentile ?? "",
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equity_value_watchlist_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const generateShareLink = () => {
    const encoded = btoa(JSON.stringify(watchlist));
    const link = `${window.location.origin}/dashboard?shared=${encoded}`;
    setShareLink(link);
  };

  const copyLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = shareLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopying(true);
      setTimeout(() => setCopying(false), 2000);
    }
  };

  if (!watchlist.length) return null;

  return (
    <div className="wle-wrap">
      <button className="wle-btn" onClick={() => { setShowMenu(!showMenu); setShareLink(null); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Export
      </button>

      {showMenu && (
        <div className="wle-menu">
          <button className="wle-menu-item" onClick={exportCSV}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            Download CSV
          </button>
          <button className="wle-menu-item" onClick={generateShareLink}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share Link
          </button>
          {shareLink && (
            <div className="wle-share">
              <input className="wle-share-input" value={shareLink} readOnly />
              <button className="wle-copy-btn" onClick={copyLink}>
                {copying ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        .wle-wrap { position: relative; }
        .wle-btn {
          display: flex; align-items: center; gap: 5px;
          background: var(--surface); border: 1px solid var(--border);
          color: var(--text3); padding: 5px 12px; border-radius: 6px;
          font-size: 0.72rem; font-weight: 600; cursor: pointer;
          font-family: inherit; transition: all 0.15s;
        }
        .wle-btn:hover { border-color: var(--primary); color: var(--text); }
        .wle-menu {
          position: absolute; top: 100%; right: 0; margin-top: 4px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 8px; padding: 4px; min-width: 180px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3); z-index: 50;
        }
        .wle-menu-item {
          display: flex; align-items: center; gap: 8px; width: 100%;
          background: none; border: none; color: var(--text2);
          padding: 8px 12px; border-radius: 6px; font-size: 0.78rem;
          cursor: pointer; font-family: inherit; text-align: left;
        }
        .wle-menu-item:hover { background: var(--surface2); color: var(--text); }
        .wle-share { padding: 8px; border-top: 1px solid var(--border); margin-top: 4px; }
        .wle-share-input {
          width: 100%; background: var(--bg); border: 1px solid var(--border);
          color: var(--text3); padding: 5px 8px; border-radius: 4px;
          font-size: 0.68rem; font-family: monospace; margin-bottom: 6px;
        }
        .wle-copy-btn {
          width: 100%; background: var(--primary); color: #fff;
          border: none; padding: 5px; border-radius: 4px;
          font-size: 0.72rem; font-weight: 700; cursor: pointer;
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}
