interface DataBarProps {
  value: number;
  max: number;
  label?: string;
  unit?: string;
  inverse?: boolean;
}

export default function DataBar({
  value,
  max,
  label,
  unit = "",
  inverse = false,
}: DataBarProps) {
  if (value === null || value === undefined || isNaN(value) || max === 0) {
    return (
      <div className="w-full">
        {label && (
          <div className="flex justify-between text-xs mb-1">
            <span className="text-content-secondary">{label}</span>
            <span className="text-content-dim">N/A</span>
          </div>
        )}
        <div className="w-full h-2 bg-void border border-border-dim">
          <div className="h-full" style={{ width: "0%" }} />
        </div>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const barColor = inverse
    ? pct > 66
      ? "#00ff41"
      : pct > 33
        ? "#ffaa00"
        : "#cc0000"
    : pct > 80
      ? "#ff0000"
      : pct > 60
        ? "#cc0000"
        : pct > 40
          ? "#990000"
          : "#660000";

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between text-xs mb-1">
          <span className="text-content-secondary">{label}</span>
          <span style={{ color: barColor }}>
            {value.toFixed(1)}
            {unit}
          </span>
        </div>
      )}
      <div className="w-full h-2 bg-void border border-border-dim">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}
