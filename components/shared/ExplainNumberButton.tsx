"use client";

import { useId, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { explainNumber } from "@/lib/explain-number";

interface ExplainNumberButtonProps {
  value: number;
  metricPath: string;
  displayValue?: string;
}

/**
 * Compact "?" control that opens a TerminalCard popover with source meta.
 */
export default function ExplainNumberButton({
  value,
  metricPath,
  displayValue,
}: ExplainNumberButtonProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const card = open ? explainNumber(value, metricPath, displayValue) : null;

  return (
    <span className="relative inline-flex align-middle ml-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[9px] px-1 py-0 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright font-mono leading-none"
        aria-expanded={open}
        aria-controls={panelId}
        title="Explain this number"
      >
        ?
      </button>
      {open && card && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Close explanation"
            onClick={() => setOpen(false)}
          />
          <div
            id={panelId}
            className="absolute z-50 left-0 top-full mt-1 w-[min(280px,85vw)]"
            role="dialog"
            aria-label="Number explanation"
          >
            <TerminalCard title="SOURCE" accent="amber" className="text-left shadow-xl">
              <div className="space-y-1.5 text-[10px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-blood-bright font-bold">{card.displayValue}</span>
                  <StatusPill
                    color={
                      card.meta.confidence === "high"
                        ? "green"
                        : card.meta.confidence === "low" || card.undocumented
                          ? "amber"
                          : "dim"
                    }
                  >
                    {card.meta.confidence}
                  </StatusPill>
                </div>
                <div className="text-content-primary">{card.citation}</div>
                <div className="text-content-dim leading-snug">{card.footnote}</div>
                {card.meta.url && (
                  <div className="text-terminal-green truncate" title={card.meta.url}>
                    {card.meta.url}
                  </div>
                )}
              </div>
            </TerminalCard>
          </div>
        </>
      )}
    </span>
  );
}
