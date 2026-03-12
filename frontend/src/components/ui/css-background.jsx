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
      <svg viewBox="0 0 420 320" fill="none" xmlns="http://www.w3.org/2000/svg" className="hero-graphic-svg">
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(59,130,246,0.18)" />
            <stop offset="100%" stopColor="rgba(59,130,246,0)" />
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Subtle grid */}
        {[80, 140, 200, 260].map(y => (
          <line key={y} x1="30" y1={y} x2="390" y2={y} stroke="rgba(255,255,255,0.035)" strokeWidth="0.5" />
        ))}

        {/* Area fill */}
        <path
          d="M40,240 C70,230 85,225 110,215 C135,205 150,212 170,195 C190,178 210,168 230,172 C250,176 260,155 280,135 C300,115 320,100 350,85 C365,78 380,68 390,58 L390,290 L40,290 Z"
          fill="url(#chartGrad)"
          className="hero-area"
        />

        {/* Chart line — smooth curve */}
        <path
          d="M40,240 C70,230 85,225 110,215 C135,205 150,212 170,195 C190,178 210,168 230,172 C250,176 260,155 280,135 C300,115 320,100 350,85 C365,78 380,68 390,58"
          stroke="url(#lineGrad)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          className="hero-line"
          filter="url(#glow)"
        />

        {/* End dot */}
        <circle cx="390" cy="58" r="3" fill="#818cf8" className="hero-dot">
          <animate attributeName="r" values="3;5;3" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.5;1" dur="2.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="390" cy="58" r="10" fill="none" stroke="#818cf8" strokeWidth="0.5" opacity="0.25">
          <animate attributeName="r" values="10;18;10" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.25;0;0.25" dur="2.5s" repeatCount="indefinite" />
        </circle>

        {/* Price label */}
        <g className="hero-price">
          <text x="348" y="48" fill="rgba(255,255,255,0.8)" fontSize="11" fontWeight="600" fontFamily="ui-monospace, monospace">$247.82</text>
          <text x="348" y="62" fill="#10b981" fontSize="8.5" fontWeight="600" fontFamily="ui-monospace, monospace">+18.4%</text>
        </g>

        {/* Card: Intrinsic Value */}
        <g className="hero-card hero-card-1">
          <rect x="55" y="100" width="88" height="40" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
          <text x="65" y="116" fill="rgba(255,255,255,0.35)" fontSize="6.5" fontWeight="600" letterSpacing="0.5" fontFamily="ui-sans-serif, system-ui, sans-serif">INTRINSIC VALUE</text>
          <text x="65" y="132" fill="#10b981" fontSize="12" fontWeight="700" fontFamily="ui-monospace, monospace">$312.40</text>
        </g>

        {/* Card: Verdict */}
        <g className="hero-card hero-card-2">
          <rect x="250" y="205" width="92" height="40" rx="6" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
          <text x="260" y="221" fill="rgba(255,255,255,0.35)" fontSize="6.5" fontWeight="600" letterSpacing="0.5" fontFamily="ui-sans-serif, system-ui, sans-serif">EV MODEL VERDICT</text>
          <text x="260" y="237" fill="#3b82f6" fontSize="11" fontWeight="700" fontFamily="ui-sans-serif, system-ui, sans-serif">Undervalued</text>
        </g>
      </svg>

      <style>{`
        .hero-graphic {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          position: relative;
          padding: 16px;
        }
        .hero-graphic-svg {
          width: 100%; height: auto;
          max-height: 100%;
        }
        .hero-line {
          stroke-dasharray: 1200;
          stroke-dashoffset: 1200;
          animation: drawLine 2.2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        .hero-area {
          opacity: 0;
          animation: fadeArea 0.8s ease-out 1.6s forwards;
        }
        .hero-card { opacity: 0; }
        .hero-card-1 { animation: fadeSlideUp 0.6s ease-out 2.1s forwards; }
        .hero-card-2 { animation: fadeSlideUp 0.6s ease-out 2.4s forwards; }
        .hero-price { opacity: 0; animation: fadeSlideUp 0.5s ease-out 1.9s forwards; }
        .hero-dot { opacity: 0; animation: fadeCard 0.3s ease-out 2s forwards; }
        @keyframes drawLine {
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeArea {
          to { opacity: 1; }
        }
        @keyframes fadeCard {
          to { opacity: 1; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
