import "./StockCountPicker.css";

const SIZES = [
  { key: "small", range: "5\u201310", label: "Concentrated" },
  { key: "medium", range: "10\u201315", label: "Balanced" },
  { key: "large", range: "15\u201325", label: "Diversified" },
];

export default function StockCountPicker({ selected, onSelect }) {
  return (
    <div className="stock-count-picker">
      {SIZES.map((size) => (
        <div
          key={size.key}
          className={`count-card${selected === size.key ? " active" : ""}`}
          onClick={() => onSelect(size.key)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(size.key);
            }
          }}
          aria-pressed={selected === size.key}
        >
          <div className="count-card__range">{size.range}</div>
          <div className="count-card__label">{size.label}</div>
        </div>
      ))}
    </div>
  );
}
