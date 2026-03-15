import React from 'react';

export default function SectorComparison({ sectorRank, sectorTotal, sectorPercentile, sector }) {
  if (!sectorRank || !sectorTotal) return null;

  const label = sectorPercentile >= 75 ? 'Top Quartile'
    : sectorPercentile >= 50 ? 'Above Median'
    : sectorPercentile >= 25 ? 'Below Median'
    : 'Bottom Quartile';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 16px', borderRadius: '8px',
      background: 'rgba(255,255,255,0.05)', marginTop: '12px'
    }}>
      <div style={{ fontSize: '14px', color: '#94a3b8' }}>
        <strong style={{ color: '#e2e8f0' }}>#{sectorRank}</strong> of {sectorTotal} in {sector}
      </div>
      <div style={{
        fontSize: '12px', padding: '2px 8px', borderRadius: '4px',
        background: sectorPercentile >= 75 ? '#166534' : sectorPercentile >= 50 ? '#854d0e' : '#7f1d1d',
        color: '#fff'
      }}>
        {label} ({Math.round(sectorPercentile)}th percentile)
      </div>
    </div>
  );
}
