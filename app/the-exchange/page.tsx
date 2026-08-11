"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  createPost,
  findMatches,
  computeStats,
  generateSeedPosts,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  URGENCY_LABELS,
  URGENCY_COLORS,
  type AidPost,
  type PostType,
  type ResourceCategory,
} from "@/lib/exchange";
import { matchToRelay, matchesToRelays, type MatchBundle } from "@/lib/exchange-relay";

const data = backbone as WorldBackbone;
const STORAGE_KEY = "vfx-exchange";

export default function TheExchangePage() {
  const [posts, setPosts] = useState<AidPost[]>([]);
  const [tab, setTab] = useState<"matches" | "offers" | "requests">("matches");
  const [relayBundles, setRelayBundles] = useState<MatchBundle[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchBundle | null>(null);

  // Form
  const [postType, setPostType] = useState<PostType>("request");
  const [category, setCategory] = useState<ResourceCategory>("food");
  const [resource, setResource] = useState("");
  const [quantity, setQuantity] = useState("");
  const [iso3, setIso3] = useState("SDN");
  const [urgency, setUrgency] = useState<AidPost["urgency"]>(3);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPosts(JSON.parse(stored));
      } else {
        setPosts(generateSeedPosts(data));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (posts.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }, [posts]);

  const handlePost = useCallback(() => {
    if (!resource || !quantity) return;
    const country = data.countries.find((c) => c.iso3 === iso3);
    const post = createPost(postType, category, resource, quantity, iso3, country?.name_en ?? iso3, urgency);
    setPosts((prev) => [post, ...prev]);
    setResource(""); setQuantity("");
    sound.success();
  }, [postType, category, resource, quantity, iso3, urgency]);

  const offers = useMemo(() => posts.filter((p) => p.type === "offer" && p.active), [posts]);
  const requests = useMemo(() => posts.filter((p) => p.type === "request" && p.active), [posts]);
  const matches = useMemo(() => findMatches(offers, requests), [offers, requests]);
  const stats = useMemo(() => computeStats(posts), [posts]);

  // Generate relay bundles when matches change
  useEffect(() => {
    if (matches.length > 0) {
      setRelayBundles(matchesToRelays(matches));
    } else {
      setRelayBundles([]);
    }
  }, [matches]);

  const handleCopyRelay = useCallback((relayText: string) => {
    navigator.clipboard?.writeText(relayText);
    sound.copy();
  }, []);

  const handleShowRelayDetails = useCallback((bundle: MatchBundle) => {
    setSelectedMatch(bundle);
    sound.select();
  }, []);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">🤝 THE EXCHANGE</h1>
      <p className="text-content-secondary text-sm mb-6">// decentralized mutual-aid matching — no registration, no tracking, no central authority</p>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <TerminalCard accent="green"><div className="text-center"><div className="text-2xl font-bold text-terminal-green">{stats.totalOffers}</div><div className="text-xs text-content-dim">OFFERS</div></div></TerminalCard>
        <TerminalCard accent="blood"><div className="text-center"><div className="text-2xl font-bold text-blood-bright">{stats.totalRequests}</div><div className="text-xs text-content-dim">REQUESTS</div></div></TerminalCard>
        <TerminalCard accent="amber"><div className="text-center"><div className="text-2xl font-bold text-warning-amber">{stats.matches}</div><div className="text-xs text-content-dim">MATCHES</div></div></TerminalCard>
        <TerminalCard accent="blood"><div className="text-center"><div className="text-2xl font-bold text-content-primary">{stats.unmatchedRequests}</div><div className="text-xs text-content-dim">UNMATCHED</div></div></TerminalCard>
      </div>

      {/* Post form */}
      <TerminalCard title="POST" accent="blood">
        <div className="space-y-3">
          <div className="flex gap-2">
            <button onClick={() => setPostType("request")} className={`flex-1 px-3 py-2 text-xs font-bold ${postType === "request" ? "bg-blood text-white" : "border border-border-dim text-content-secondary"}`}>📦 I NEED</button>
            <button onClick={() => setPostType("offer")} className={`flex-1 px-3 py-2 text-xs font-bold ${postType === "offer" ? "bg-terminal-green text-abyss" : "border border-border-dim text-content-secondary"}`}>✓ I HAVE</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value as ResourceCategory)} className="bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary">
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{CATEGORY_ICONS[k as ResourceCategory]} {v}</option>)}
            </select>
            <select value={iso3} onChange={(e) => setIso3(e.target.value)} className="bg-abyss border border-border-dim px-2 py-1.5 text-sm text-content-primary">
              {data.hotspots.all.map((h) => { const c = data.countries.find((x) => x.iso3 === h.iso3); return <option key={h.iso3} value={h.iso3}>{c?.name_en ?? h.iso3}</option>; })}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={resource} onChange={(e) => setResource(e.target.value)} placeholder="Resource (e.g., 'rice, grain')" className="bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
            <input type="text" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity (e.g., '50kg')" className="bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
          </div>
          <div>
            <label className="text-xs text-content-dim">Urgency: {URGENCY_LABELS[urgency]}</label>
            <input type="range" min={1} max={5} value={urgency} onChange={(e) => setUrgency(Number(e.target.value) as AidPost["urgency"])} className="w-full" style={{ accentColor: URGENCY_COLORS[urgency] }} />
          </div>
          <button onClick={handlePost} disabled={!resource || !quantity} className="w-full px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright disabled:opacity-30">
            [ POST {postType.toUpperCase()} ]
          </button>
        </div>
      </TerminalCard>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 mt-4 border-b border-border-dim">
        {([["matches", `MATCHES (${matches.length})`], ["offers", `OFFERS (${offers.length})`], ["requests", `REQUESTS (${requests.length})`]] as [typeof tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); sound.nav(); }} className={`px-3 py-2 text-xs font-bold ${tab === t ? "text-blood-bright border-b-2 border-blood" : "text-content-dim hover:text-content-primary"}`}>{label}</button>
        ))}
      </div>

      {tab === "matches" && (
        <div className="space-y-2">
          {matches.length === 0 ? (
            <TerminalCard accent="amber"><p className="text-sm text-content-secondary">No matches yet. Post an offer and a request to see matches.</p></TerminalCard>
          ) : (
            <>
              <TerminalCard accent="green" className="mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-terminal-green">📡 RELAY EXPORT</h3>
                    <p className="text-xs text-content-dim mt-1">Convert matches to offline QR messages for P2P delivery coordination</p>
                  </div>
                  <div className="text-xs text-content-secondary">
                    {relayBundles.length} match{relayBundles.length !== 1 ? 'es' : ''} ready
                  </div>
                </div>
              </TerminalCard>

              {matches.slice(0, 20).map((m, i) => {
                const bundle = relayBundles.find(b => b.match === m);
                if (!bundle) return null;
                return (
                <TerminalCard key={i} accent={m.score >= 60 ? "green" : "amber"}>
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-terminal-green">{CATEGORY_ICONS[m.offer.category]} {m.offer.resource}</span>
                        <span className="text-content-dim">↔</span>
                        <span className="text-blood-bright">{m.request.resource}</span>
                      </div>
                      <div className="text-xs text-content-dim mt-1">
                        {m.offer.countryName} · {m.offer.handle} → {m.request.handle}
                      </div>
                      <div className="text-xs text-warning-amber mt-1">{m.reason}</div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => handleCopyRelay(bundle.offerRelay)}
                          className="px-2 py-1 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green/10"
                          title="Copy relay message for offer side"
                        >
                          📋 OFFER RELAY
                        </button>
                        <button
                          onClick={() => handleCopyRelay(bundle.requestRelay)}
                          className="px-2 py-1 text-xs border border-blood text-blood hover:bg-blood/10"
                          title="Copy relay message for request side"
                        >
                          📋 REQUEST RELAY
                        </button>
                        <button
                          onClick={() => handleShowRelayDetails(bundle)}
                          className="px-2 py-1 text-xs border border-warning-amber text-warning-amber hover:bg-warning-amber/10"
                          title="View relay details"
                        >
                          🔍 DETAILS
                        </button>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-bold" style={{ color: m.score >= 60 ? "var(--color-terminal-green)" : "var(--color-warning-amber)" }}>{m.score}</div>
                      <div className="text-xs text-content-dim">MATCH</div>
                      <div className="text-xs text-content-dim mt-1">{bundle.matchId}</div>
                    </div>
                  </div>
                </TerminalCard>
              )})}
            </>
          )}
        </div>
      )}

      {tab === "offers" && (
        <div className="space-y-2">
          {offers.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}

      {tab === "requests" && (
        <div className="space-y-2">
          {requests.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}

      {selectedMatch && (
        <TerminalCard title="RELAY MESSAGE DETAILS" accent="green" className="mt-4">
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-content-dim">Match ID: {selectedMatch.matchId}</span>
              <button onClick={() => setSelectedMatch(null)} className="text-xs text-content-secondary hover:text-content-primary">[CLOSE]</button>
            </div>

            <div>
              <h4 className="text-xs font-bold text-terminal-green mb-2">📦 OFFER SIDE MESSAGE</h4>
              <p className="text-xs text-content-dim mb-1">For the person offering resources:</p>
              <code className="block text-xs bg-abyss border border-border-dim p-2 break-all text-terminal-green font-mono">
                {selectedMatch.offerRelay}
              </code>
              <button
                onClick={() => handleCopyRelay(selectedMatch.offerRelay)}
                className="mt-2 px-3 py-1 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green/10"
              >
                [COPY OFFER RELAY]
              </button>
            </div>

            <div>
              <h4 className="text-xs font-bold text-blood-bright mb-2">📋 REQUEST SIDE MESSAGE</h4>
              <p className="text-xs text-content-dim mb-1">For the person requesting resources:</p>
              <code className="block text-xs bg-abyss border border-border-dim p-2 break-all text-blood font-mono">
                {selectedMatch.requestRelay}
              </code>
              <button
                onClick={() => handleCopyRelay(selectedMatch.requestRelay)}
                className="mt-2 px-3 py-1 text-xs border border-blood text-blood hover:bg-blood/10"
              >
                [COPY REQUEST RELAY]
              </button>
            </div>

            <div className="text-xs text-content-dim bg-abyss border border-border-dim p-2">
              <p><strong>How to use:</strong></p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Share the offer relay with the person who has resources</li>
                <li>Share the request relay with the person who needs resources</li>
                <li>Both can scan each other's QR codes to coordinate delivery offline</li>
                <li>Messages use the VFX relay format for maximum compatibility</li>
              </ul>
            </div>
          </div>
        </TerminalCard>
      )}
    </div>
  );
}

function PostCard({ post }: { post: AidPost }) {
  return (
    <div className="p-3 border border-border-dim bg-abyss">
      <div className="flex justify-between">
        <span className="text-sm font-bold" style={{ color: post.type === "offer" ? "var(--color-terminal-green)" : "var(--color-blood-bright)" }}>
          {CATEGORY_ICONS[post.category]} {post.resource} — {post.quantity}
        </span>
        <span className="text-xs" style={{ color: URGENCY_COLORS[post.urgency] }}>{URGENCY_LABELS[post.urgency]}</span>
      </div>
      <div className="text-xs text-content-dim mt-1">{post.countryName} · {post.handle} · {new Date(post.ts).toLocaleDateString()}</div>
    </div>
  );
}
