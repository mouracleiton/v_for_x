import { ReactNode } from "react";

interface TerminalCardProps {
  title?: string;
  children: ReactNode;
  className?: string;
  glow?: boolean;
  accent?: "blood" | "green" | "amber";
}

export default function TerminalCard({
  title,
  children,
  className = "",
  glow = false,
  accent = "blood",
}: TerminalCardProps) {
  const accentColor =
    accent === "green"
      ? "var(--color-terminal-green)"
      : accent === "amber"
        ? "var(--color-warning-amber)"
        : "var(--color-blood)";

  return (
    <div
      className={`terminal-card p-4 ${glow ? "pulse-blood" : ""} ${className}`}
    >
      {title && (
        <div
          className="text-xs uppercase tracking-widest mb-3 pb-2 border-b"
          style={{
            color: accentColor,
            borderColor: "var(--color-border-dim)",
          }}
        >
          {"> "}{title}
        </div>
      )}
      {children}
    </div>
  );
}
