"use client";

import { useState } from "react";
import { sound } from "@/lib/sound";
import { EmbedButton, tweetIntent } from "@/components/shared/EmbedButton";

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
    <div className="p-3 terminal-card hover:border-blood transition-colors group">
      <div className="flex items-start gap-2">
        <span className="text-blood mt-0.5">▸</span>
        <p className="text-xs text-content-primary flex-1">{text}</p>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={copy}
            className={`text-xs px-2 py-0.5 border transition-colors ${
              copied
                ? "border-terminal-green text-terminal-green"
                : "text-content-dim group-hover:text-blood border-border-dim group-hover:border-blood"
            }`}
          >
            {copied ? "[ COPIED ]" : "[ COPY ]"}
          </button>
          <a
            href={tweetIntent(text)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] px-2 py-0.5 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright text-center transition-colors no-print"
          >
            TWEET
          </a>
          <div className="no-print">
            <EmbedButton text={text} />
          </div>
        </div>
      </div>
    </div>
  );
}
