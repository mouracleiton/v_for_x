"use client";

import { useState } from "react";
import { sound } from "@/lib/sound";

interface ShareableStatProps {
  text: string;
}

export default function ShareableStat({ text }: ShareableStatProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      sound.copy();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      sound.error();
    }
  };

  return (
    <button
      onClick={copy}
      className="block w-full text-left p-3 terminal-card hover:border-blood transition-colors group"
    >
      <div className="flex items-start gap-2">
        <span className="text-blood mt-0.5">▸</span>
        <p className="text-xs text-content-primary flex-1">{text}</p>
        <span
          className={`text-xs shrink-0 ${
            copied ? "text-terminal-green" : "text-content-dim group-hover:text-blood"
          }`}
        >
          {copied ? "[ COPIED ]" : "[ COPY ]"}
        </span>
      </div>
    </button>
  );
}
