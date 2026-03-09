export function Skeleton({ width, height, borderRadius = 6, style = {} }) {
  return (
    <div
      className="skeleton"
      style={{ width, height: height || 14, borderRadius, ...style }}
    />
  );
}

export default function AnalysisSkeleton() {
  return (
    <div className="skeleton-wrap">
      {/* Company header skeleton */}
      <div className="sk-card sk-header">
        <div className="sk-header-top">
          <div>
            <Skeleton width={220} height={24} style={{ marginBottom: 10 }} />
            <Skeleton width={140} height={14} style={{ marginBottom: 8 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <Skeleton width={70} height={22} borderRadius={4} />
              <Skeleton width={90} height={22} borderRadius={4} />
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <Skeleton width={100} height={40} borderRadius={6} style={{ marginBottom: 6 }} />
            <Skeleton width={80} height={14} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 0, borderTop: "1px solid var(--border)", paddingTop: 0 }}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} style={{ padding: "12px 16px", borderRight: "1px solid var(--border)" }}>
              <Skeleton width={30} height={10} style={{ marginBottom: 6 }} />
              <Skeleton width={50} height={16} />
            </div>
          ))}
        </div>
      </div>

      {/* Consensus hero skeleton */}
      <div className="sk-card sk-consensus">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <Skeleton width={140} height={12} style={{ marginBottom: 12 }} />
            <Skeleton width={200} height={36} style={{ marginBottom: 8 }} />
            <Skeleton width={120} height={12} />
          </div>
          <div style={{ textAlign: "right" }}>
            <Skeleton width={120} height={44} style={{ marginBottom: 8 }} />
            <Skeleton width={70} height={24} style={{ marginBottom: 6 }} />
            <Skeleton width={90} height={12} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="sk-stat">
              <Skeleton width={50} height={24} style={{ marginBottom: 4 }} />
              <Skeleton width={60} height={11} />
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="sk-card sk-chart">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <Skeleton width={100} height={14} />
          <div style={{ display: "flex", gap: 6 }}>
            {["1W","1M","3M","6M","1Y"].map(l => <Skeleton key={l} width={32} height={26} borderRadius={4} />)}
          </div>
        </div>
        <div className="sk-chart-bars">
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="sk-chart-bar" style={{ height: `${20 + Math.sin(i * 0.4) * 50 + Math.random() * 30}px` }} />
          ))}
        </div>
      </div>

      {/* Model cards skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="sk-card" style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <Skeleton width={130} height={14} />
              <Skeleton width={50} height={20} borderRadius={4} />
            </div>
            <Skeleton width={100} height={32} style={{ marginBottom: 6 }} />
            <Skeleton width={70} height={20} style={{ marginBottom: 16 }} />
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginBottom: 12 }} />
            <Skeleton width={160} height={11} />
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }
        .skeleton {
          background: linear-gradient(
            90deg,
            var(--surface2) 25%,
            var(--surface3) 50%,
            var(--surface2) 75%
          );
          background-size: 400px 100%;
          animation: shimmer 1.6s ease-in-out infinite;
          border-radius: 6px;
          display: block;
        }
        .skeleton-wrap {
          display: flex;
          flex-direction: column;
          gap: 16px;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .sk-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
        }
        .sk-header { padding: 0; }
        .sk-header-top { padding: 22px 24px; display: flex; justify-content: space-between; align-items: flex-start; }
        .sk-consensus { padding: 28px; }
        .sk-stat { background: var(--surface2); border-radius: 8px; padding: 14px; }
        .sk-chart { padding: 20px; }
        .sk-chart-bars {
          display: flex;
          align-items: flex-end;
          gap: 4px;
          height: 120px;
        }
        .sk-chart-bar {
          flex: 1;
          background: linear-gradient(
            90deg,
            var(--surface2) 25%,
            var(--surface3) 50%,
            var(--surface2) 75%
          );
          background-size: 400px 100%;
          animation: shimmer 1.6s ease-in-out infinite;
          border-radius: 3px 3px 0 0;
          min-height: 8px;
        }
      `}</style>
    </div>
  );
}
