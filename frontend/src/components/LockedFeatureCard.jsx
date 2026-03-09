export default function LockedFeatureCard({ title, plan = "Pro", onUpgrade }) {
  return (
    <div className="locked-card">
      <div className="locked-card-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
        </svg>
      </div>
      <h3 className="locked-card-title">{title}</h3>
      <p className="locked-card-desc">This feature is available on <strong>{plan}+</strong> plans.</p>
      <button className="locked-card-btn" onClick={onUpgrade}>Upgrade to Unlock</button>

      <style>{`
        .locked-card {
          background: var(--surface);
          border: 1px dashed var(--border2);
          border-radius: var(--radius-lg);
          padding: 40px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .locked-card-icon {
          color: var(--text3);
          opacity: 0.5;
        }
        .locked-card-title {
          font-size: 1rem;
          font-weight: 700;
          color: var(--text);
        }
        .locked-card-desc {
          font-size: 0.82rem;
          color: var(--text2);
        }
        .locked-card-btn {
          margin-top: 8px;
          padding: 10px 24px;
          background: var(--primary);
          color: #fff;
          border: none;
          border-radius: var(--radius);
          font-family: inherit;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .locked-card-btn:hover { opacity: 0.88; }
      `}</style>
    </div>
  );
}
