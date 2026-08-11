"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  TOKEN_SPECS,
  detectToken,
  validateTokenFormat,
  type TokenSpec,
  type DetectedToken,
} from "@/lib/tokens";
import { logEvent } from "@/lib/ops-journal";

/* ═══════════════════════════════════════════════════════════════
   Component State
═══════════════════════════════════════════════════════════════ */

export default function TheTokensPage() {
  const { lang } = useStore();
  const [pastedText, setPastedText] = useState("");
  const [detectedToken, setDetectedToken] = useState<DetectedToken | null>(null);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Filter tokens by category
  const filteredTokens = selectedCategory
    ? TOKEN_SPECS.filter((spec) => spec.module === selectedCategory)
    : TOKEN_SPECS;

  // Get unique categories
  const categories = Array.from(
    new Set(TOKEN_SPECS.map((spec) => spec.module))
  ).sort();

  // Handle paste detection
  const handleDetect = useCallback(() => {
    if (!pastedText.trim()) {
      setDetectedToken(null);
      setIsValid(null);
      return;
    }

    const detected = detectToken(pastedText.trim());
    setDetectedToken(detected);

    if (detected) {
      const valid = validateTokenFormat(pastedText.trim());
      setIsValid(valid);

      if (valid) {
        sound.success();
      } else {
        sound.error();
      }
      logEvent({
        type: "custom",
        title: `Token detected: ${detected.spec.name}`,
        details: { tokenType: detected.spec.id, isValid: valid },
      });
    } else {
      setIsValid(false);
      sound.error();
      logEvent({
        type: "custom",
        title: "Token detection failed",
        details: { input: pastedText.slice(0, 100) },
      });
    }
  }, [pastedText]);

  // Clear input
  const handleClear = useCallback(() => {
    setPastedText("");
    setDetectedToken(null);
    setIsValid(null);
    sound.select();
  }, []);

  /* ═══════════════════════════════════════════════════════════════
     Render
    ═══════════════════════════════════════════════════════════════ */
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 font-mono">
          {tc(lang, "tokens_title")}
        </h1>
        <p className="text-gray-400 text-lg">
          {tc(lang, "tokens_subtitle")}
        </p>
      </div>

      {/* Token Detector Card */}
      <TerminalCard title="TOKEN DETECTOR" className="mb-8">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-mono mb-2 text-gray-300">
              Paste any VFX* token to detect its type
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="VFXID1:... or VFXPACK1:... or any VFX* token"
              className="w-full h-32 bg-black/50 border border-green-500/30 rounded p-3 font-mono text-sm text-green-400 placeholder-gray-600 focus:border-green-500 focus:outline-none resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleDetect}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-black font-mono text-sm rounded transition-colors"
            >
              DETECT TOKEN
            </button>
            <button
              onClick={handleClear}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-mono text-sm rounded transition-colors"
            >
              CLEAR
            </button>
          </div>

          {/* Detection Result */}
          {detectedToken && (
            <div className="bg-black/50 border border-green-500/30 rounded p-4">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="font-mono text-lg text-green-400">
                  {detectedToken.spec.name}
                </h3>
                {isValid !== null && (
                  <StatusPill color={isValid ? "green" : "blood"}>
                    {isValid ? "VALID FORMAT" : "INVALID FORMAT"}
                  </StatusPill>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                <div className="text-gray-400">ID:</div>
                <div className="text-green-300">{detectedToken.spec.id}</div>
                <div className="text-gray-400">Module:</div>
                <div className="text-green-300">{detectedToken.spec.module}</div>
                <div className="text-gray-400">Signed:</div>
                <div className="text-green-300">
                  {detectedToken.spec.signed ? "✓" : "✗"}
                </div>
                <div className="text-gray-400">Encrypted:</div>
                <div className="text-green-300">
                  {detectedToken.spec.encrypted ? "✓" : "✗"}
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-300">
                {detectedToken.spec.description}
              </div>
            </div>
          )}

          {pastedText && !detectedToken && (
            <div className="bg-red-950/50 border border-red-500/30 rounded p-3">
              <p className="text-red-400 font-mono text-sm">
                No VFX* token detected in input. Check the format and try again.
              </p>
            </div>
          )}
        </div>
      </TerminalCard>

      {/* Category Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1 font-mono text-xs rounded transition-colors ${
            selectedCategory === null
              ? "bg-green-600 text-black"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          ALL ({TOKEN_SPECS.length})
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1 font-mono text-xs rounded transition-colors ${
              selectedCategory === category
                ? "bg-green-600 text-black"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {category.toUpperCase()} ({TOKEN_SPECS.filter((s) => s.module === category).length})
          </button>
        ))}
      </div>

      {/* Token Catalog */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredTokens.map((spec) => (
          <TerminalCard key={spec.id} title={spec.id} className="h-full">
            <div className="space-y-3">
              {/* Name and Description */}
              <div>
                <h3 className="font-mono text-lg text-green-400 mb-1">
                  {spec.name}
                </h3>
                <p className="text-sm text-gray-300">{spec.description}</p>
              </div>

              {/* Prefix */}
              <div className="bg-black/50 border border-green-500/20 rounded p-2">
                <code className="text-xs text-green-400 break-all">
                  {spec.prefix}
                </code>
              </div>

              {/* Specs */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="text-gray-400">Module:</div>
                <div className="text-green-300">{spec.module}</div>
                <div className="text-gray-400">Signed:</div>
                <div className="text-green-300">
                  {spec.signed ? "✓ Yes" : "✗ No"}
                </div>
                <div className="text-gray-400">Encrypted:</div>
                <div className="text-green-300">
                  {spec.encrypted ? "✓ Yes" : "✗ No"}
                </div>
              </div>

              {/* Example placeholder */}
              <div className="text-xs text-gray-500 italic">
                Paste token starting with {spec.prefix} to detect
              </div>
            </div>
          </TerminalCard>
        ))}
      </div>

      {/* Info Section */}
      <TerminalCard title="ABOUT VFX* TOKENS" className="mt-8">
        <div className="space-y-3 text-sm text-gray-300">
          <p>
            VFX* tokens are the interoperability layer that powers all V FOR X
            modules. Each token type serves a specific purpose and follows a
            standardized format.
          </p>
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <h4 className="font-mono text-green-400 mb-2">USAGE</h4>
              <ul className="space-y-1 text-xs">
                <li>• Copy tokens between modules</li>
                <li>• Share via QR codes, Relay, WebRTC</li>
                <li>• Import/export as VFXPACK1 bundles</li>
                <li>• Verify signatures & integrity</li>
              </ul>
            </div>
            <div>
              <h4 className="font-mono text-green-400 mb-2">SECURITY</h4>
              <ul className="space-y-1 text-xs">
                <li>• Signed tokens: ECDSA P-256</li>
                <li>• Encrypted tokens: AES-GCM</li>
                <li>• All validation happens client-side</li>
                <li>• No server-side verification needed</li>
              </ul>
            </div>
          </div>
        </div>
      </TerminalCard>
    </div>
  );
}
