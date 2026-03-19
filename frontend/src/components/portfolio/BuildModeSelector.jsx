import "./BuildModeSelector.css";

const MODES = [
  {
    key: "guided",
    icon: "\u2728",
    title: "Build For Me",
    desc: "Answer a few questions and we\u2019ll construct an optimised portfolio based on your risk profile and preferences.",
  },
  {
    key: "optimize",
    icon: "\u2699\uFE0F",
    title: "Optimize Mine",
    desc: "Bring your own stock picks and we\u2019ll find the optimal weights using modern portfolio theory.",
  },
];

export default function BuildModeSelector({ selected, onSelect }) {
  return (
    <div className="build-mode-selector">
      {MODES.map((mode) => (
        <div
          key={mode.key}
          className={`mode-card${selected === mode.key ? " active" : ""}`}
          onClick={() => onSelect(mode.key)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(mode.key);
            }
          }}
          aria-pressed={selected === mode.key}
        >
          <div className="mode-card__icon">{mode.icon}</div>
          <div className="mode-card__title">{mode.title}</div>
          <div className="mode-card__desc">{mode.desc}</div>
        </div>
      ))}
    </div>
  );
}
