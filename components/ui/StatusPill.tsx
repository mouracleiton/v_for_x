import { ReactNode } from "react";

interface StatusPillProps {
  children: ReactNode;
  color?: "blood" | "green" | "amber" | "dim";
}

export default function StatusPill({
  children,
  color = "dim",
}: StatusPillProps) {
  const colorMap = {
    blood: { bg: "#1a0000", border: "#cc0000", text: "#e10600" },
    green: { bg: "#001a00", border: "#00ff41", text: "#00ff41" },
    amber: { bg: "#1a1100", border: "#ffaa00", text: "#ffaa00" },
    dim: { bg: "#111111", border: "#333333", text: "#888888" },
  };

  const c = colorMap[color];

  return (
    <span
      className="inline-block px-2 py-0.5 text-xs uppercase tracking-wider border"
      style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
    >
      {children}
    </span>
  );
}
