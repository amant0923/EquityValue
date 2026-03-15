import React from 'react';

export default function PeerComparison({ peerContext, currentTicker }) {
  if (!peerContext?.peer_group?.length) return null;

  const maxScore = Math.max(...peerContext.peer_group.map(p => p.score));

  return (
    <div style={{ marginTop: '16px' }}>
      <h4 style={{ color: '#e2e8f0', marginBottom: '12px', fontSize: '14px' }}>
        vs Peers (Avg: {peerContext.peer_avg_score} EVS)
      </h4>
      {peerContext.peer_group.map(peer => (
        <div key={peer.ticker} style={{
          display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px'
        }}>
          <span style={{
            width: '50px', fontSize: '13px', fontWeight: peer.ticker === currentTicker ? 700 : 400,
            color: peer.ticker === currentTicker ? '#60a5fa' : '#94a3b8'
          }}>
            {peer.ticker}
          </span>
          <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: '#1e293b' }}>
            <div style={{
              width: `${(peer.score / maxScore) * 100}%`, height: '100%', borderRadius: '4px',
              background: peer.score >= 60 ? '#22c55e' : peer.score >= 40 ? '#eab308' : '#ef4444'
            }} />
          </div>
          <span style={{ width: '30px', fontSize: '13px', color: '#e2e8f0', textAlign: 'right' }}>
            {peer.score}
          </span>
        </div>
      ))}
    </div>
  );
}
