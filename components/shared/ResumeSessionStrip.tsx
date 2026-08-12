"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  loadResume,
  resumeLabel,
  resumeAgo,
  clearResume,
  type ResumeEntry,
} from "@/lib/resume-session";

/**
 * Compact "resume last position" strip. Hidden when no resume entry exists
 * or the visitor dismissed it this session.
 */
export default function ResumeSessionStrip() {
  const pathname = usePathname();
  const [entry, setEntry] = useState<ResumeEntry | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Snapshot once on mount so live recordVisit updates do not chase the user.
    setEntry(loadResume().current);
  }, []);

  if (dismissed || !entry) return null;
  // Already on that route — nothing to resume.
  if (pathname && (pathname === entry.route || pathname === `${entry.route}/` || `${pathname}/` === entry.route)) {
    return null;
  }

  const label = resumeLabel(entry);
  const ago = resumeAgo(entry);

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5 border-b border-border-dim bg-panel text-[10px] font-mono"
      role="status"
    >
      <span className="text-content-dim uppercase tracking-widest shrink-0">
        // resume
      </span>
      <Link
        href={entry.route}
        className="text-blood-bright hover:underline truncate min-w-0"
        title={entry.route}
      >
        {label}
      </Link>
      <span className="text-content-dim shrink-0">{ago}</span>
      <button
        type="button"
        onClick={() => {
          clearResume();
          setDismissed(true);
          setEntry(null);
        }}
        className="ml-auto shrink-0 px-1.5 py-0.5 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright transition-colors"
        aria-label="Dismiss resume strip"
      >
        ✕
      </button>
    </div>
  );
}
