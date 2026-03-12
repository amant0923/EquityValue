/**
 * Lightweight CSS-only animated background — replaces ShaderAnimation (THREE.js)
 * and SplineScene (~4MB total savings).
 */
export function CSSBackground() {
  return (
    <>
      <div className="css-bg" />
      <style>{`
        .css-bg {
          position: absolute;
          inset: 0;
          overflow: hidden;
          background: #060810;
        }
        .css-bg::before,
        .css-bg::after {
          content: '';
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          animation: bgFloat 12s ease-in-out infinite alternate;
        }
        .css-bg::before {
          width: 800px; height: 800px;
          background: radial-gradient(circle, rgba(59,130,246,0.7), transparent 70%);
          top: -30%; left: -15%;
          opacity: 0.8;
        }
        .css-bg::after {
          width: 700px; height: 700px;
          background: radial-gradient(circle, rgba(129,140,248,0.6), transparent 70%);
          bottom: -30%; right: -15%;
          animation-delay: -6s;
          opacity: 0.7;
        }
        @keyframes bgFloat {
          0%   { transform: translate(0, 0) scale(1); }
          100% { transform: translate(60px, 40px) scale(1.2); }
        }
      `}</style>
    </>
  );
}

/**
 * Animated stock chart graphic — replaces the Spline 3D robot.
 * Pure SVG + CSS animation, zero JS dependencies.
 */
export function HeroGraphic() {
  return (
    <div className="hero-graphic">
      <svg viewBox="0 0 400 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="hero-graphic-svg">
        {/* Grid lines */}
        {[60, 120, 180, 240].map(y => (
          <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}
        {[80, 160, 240, 320].map(x => (
          <line key={x} x1={x} y1="0" x2={x} y2="300" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        ))}

        {/* Gradient area under the line */}
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(59,130,246,0.3)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0)" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path
          d="M20,220 L60,200 L100,210 L140,180 L180,160 L220,170 L260,120 L300,100 L340,80 L380,60 L380,280 L20,280 Z"
          fill="url(#chartGrad)"
          className="hero-area"
        />

        {/* Main chart line */}
        <polyline
          points="20,220 60,200 100,210 140,180 180,160 220,170 260,120 300,100 340,80 380,60"
          stroke="url(#lineGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          className="hero-line"
        />

        {/* Glow dot at end */}
        <circle cx="380" cy="60" r="4" fill="#3b82f6" className="hero-dot">
          <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="380" cy="60" r="12" fill="none" stroke="#3b82f6" strokeWidth="1" opacity="0.3" className="hero-dot-ring">
          <animate attributeName="r" values="12;20;12" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2s" repeatCount="indefinite" />
        </circle>

        {/* Value labels */}
        <text x="340" y="50" fill="#3b82f6" fontSize="13" fontWeight="700" fontFamily="monospace" className="hero-price">$247.82</text>
        <text x="340" y="68" fill="#10b981" fontSize="9" fontWeight="600" fontFamily="monospace">+18.4%</text>

        {/* Floating data cards */}
        <g className="hero-card hero-card-1">
          <rect x="40" y="80" width="100" height="50" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <text x="52" y="100" fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="600" fontFamily="sans-serif">INTRINSIC VALUE</text>
          <text x="52" y="118" fill="#10b981" fontSize="14" fontWeight="700" fontFamily="monospace">$312.40</text>
        </g>

        <g className="hero-card hero-card-2">
          <rect x="220" y="190" width="100" height="50" rx="8" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          <text x="232" y="210" fill="rgba(255,255,255,0.4)" fontSize="8" fontWeight="600" fontFamily="sans-serif">CONSENSUS</text>
          <text x="232" y="228" fill="#3b82f6" fontSize="14" fontWeight="700" fontFamily="monospace">Undervalued</text>
        </g>
      </svg>

      <style>{`
        .hero-graphic {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          position: relative;
        }
        .hero-graphic-svg {
          width: 90%; height: auto;
          max-height: 90%;
        }
        .hero-line {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: drawLine 2s ease-out forwards;
        }
        .hero-area {
          opacity: 0;
          animation: fadeArea 1s ease-out 1.5s forwards;
        }
        .hero-card {
          opacity: 0;
        }
        .hero-card-1 { animation: fadeCard 0.5s ease-out 2s forwards; }
        .hero-card-2 { animation: fadeCard 0.5s ease-out 2.3s forwards; }
        .hero-price {
          opacity: 0;
          animation: fadeCard 0.5s ease-out 1.8s forwards;
        }
        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeArea {
          to { opacity: 1; }
        }
        @keyframes fadeCard {
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
