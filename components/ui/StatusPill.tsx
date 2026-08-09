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
    blood: { bg: "#1a0000", border: "var(--color-blood)", text: "var(--color-blood-bright)" },
    green: { bg: "#001a00", border: "var(--color-terminal-green)", text: "var(--color-terminal-green)" },
    amber: { bg: "#1a1100", border: "var(--color-warning-amber)", text: "var(--color-warning-amber)" },
    dim: { bg: "var(--color-panel)", border: "#333333", text: "var(--color-content-secondary)" },
  };

  const c = colorMap[color];

  return (
    <span
      className="inline-pill inline-block px-2 py-0.5 text-xs uppercase tracking-wider border"
      style={{ backgroundColor: c.bg, borderColor: c.border, color: c.text }}
    >
      {children}
    </span>
  );
}
