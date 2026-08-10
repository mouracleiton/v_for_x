"use client";

import { useState, useCallback } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import backbone from "@/data/world_backbone.json";
import type { WorldBackbone } from "@/lib/types";
import {
  createPoll,
  castVote,
  tallyVotes,
  isPollOpen,
  formatTimeRemaining,
  generateVoterSecret,
  type Poll,
  type Ballot,
  type TallyResult,
} from "@/lib/quorum";

const data = backbone as WorldBackbone;
const HOTSPOT_ISO3S = data.hotspots.all.map((h) => h.iso3);

export default function TheQuorumPage() {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [ballots, setBallots] = useState<Ballot[]>([]);
  const [tally, setTally] = useState<TallyResult | null>(null);
  const [voterSecret] = useState(() => generateVoterSecret());

  // Poll creation
  const [question, setQuestion] = useState("Should we declare a hunger emergency?");
  const [duration, setDuration] = useState(72);

  // Voting
  const [attribute, setAttribute] = useState("SDN");
  const [voteChoice, setVoteChoice] = useState("");
  const [error, setError] = useState("");

  const handleCreatePoll = useCallback(() => {
    const p = createPoll(
      question,
      "Anonymous vote restricted to members of hunger hotspot countries. Your country is proven via ZK — not revealed.",
      [
        { id: "yes", label: "Yes — Declare Emergency", description: "Endorse the emergency declaration" },
        { id: "no", label: "No — Reject", description: "Reject the declaration" },
        { id: "abstain", label: "Abstain", description: "No position" },
      ],
      HOTSPOT_ISO3S,
      "Hunger hotspot country members",
      duration,
    );
    setPoll(p);
    setBallots([]);
    setTally(null);
    sound.success();
  }, [question, duration]);

  const handleVote = useCallback(async () => {
    if (!poll) return;
    setError("");
    if (!voteChoice) { setError("// SELECT AN OPTION"); sound.error(); return; }
    try {
      const { ballot } = await castVote(poll, attribute, voteChoice, voterSecret);
      setBallots((prev) => [...prev, ballot]);
      setVoteChoice("");
      setTally(null);
      sound.success();
    } catch (e) {
      setError(`// ${e instanceof Error ? e.message : "Error"}`);
      sound.error();
    }
  }, [poll, attribute, voteChoice, voterSecret]);

  const handleTally = useCallback(async () => {
    if (!poll || ballots.length === 0) return;
    const result = await tallyVotes(ballots, poll);
    setTally(result);
    sound.success();
  }, [poll, ballots]);

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">🗳️ THE QUORUM</h1>
      <p className="text-content-secondary text-sm mb-6">
        // anonymous ZK voting — prove eligibility without revealing who you are or how you voted
      </p>

      <div className="space-y-4">
        {!poll ? (
          <TerminalCard title="CREATE POLL" accent="blood">
            <label className="text-xs text-content-dim uppercase">Question</label>
            <input type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
              className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 mb-3" />

            <label className="text-xs text-content-dim uppercase">Duration: {duration}h</label>
            <input type="range" min={1} max={168} value={duration} onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full mb-4" />

            <div className="p-3 border border-border-dim bg-abyss mb-4">
              <p className="text-xs text-warning-amber mb-1">⚠ ELIGIBILITY</p>
              <p className="text-xs text-content-secondary">
                Only members of hunger hotspot countries ({HOTSPOT_ISO3S.length} countries) can vote.
                Eligibility is proven via ZK set-membership — your country is never revealed.
              </p>
            </div>

            <button onClick={handleCreatePoll} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright">
              [ CREATE POLL ]
            </button>
          </TerminalCard>
        ) : (
          <>
            <TerminalCard title="ACTIVE POLL" accent={isPollOpen(poll) ? "green" : "blood"} glow={!isPollOpen(poll)}>
              <h2 className="text-lg font-bold text-content-primary mb-2">{poll.question}</h2>
              <p className="text-sm text-content-secondary mb-3">{poll.description}</p>
              <div className="flex justify-between text-xs text-content-dim">
                <span>⏱ {formatTimeRemaining(poll)}</span>
                <span>{ballots.length} {ballots.length === 1 ? "ballot" : "ballots"} cast</span>
              </div>
            </TerminalCard>

            {isPollOpen(poll) && (
              <TerminalCard title="CAST VOTE" accent="blood">
                <label className="text-xs text-content-dim uppercase">Your Country (proven via ZK — not revealed)</label>
                <select value={attribute} onChange={(e) => setAttribute(e.target.value)}
                  className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary mt-1 mb-3">
                  {HOTSPOT_ISO3S.map((iso3) => {
                    const c = data.countries.find((x) => x.iso3 === iso3);
                    return <option key={iso3} value={iso3}>{c?.name_en ?? iso3} ({iso3})</option>;
                  })}
                </select>

                <label className="text-xs text-content-dim uppercase">Your Vote</label>
                <div className="space-y-2 mt-1 mb-3">
                  {poll.options.map((opt) => (
                    <button key={opt.id} onClick={() => { setVoteChoice(opt.id); sound.select(); }}
                      className={`w-full text-left px-3 py-2 text-sm border transition-colors ${
                        voteChoice === opt.id ? "border-blood bg-blood/10 text-blood-bright" : "border-border-dim text-content-secondary hover:border-blood"
                      }`}>
                      <span className="font-bold">{opt.label}</span>
                      {opt.description && <span className="block text-xs text-content-dim">{opt.description}</span>}
                    </button>
                  ))}
                </div>

                {error && <p className="text-blood-bright text-sm mb-3">{error}</p>}

                <button onClick={handleVote} disabled={!voteChoice}
                  className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright disabled:opacity-30">
                  [ CAST ANONYMOUS VOTE ]
                </button>
              </TerminalCard>
            )}

            {ballots.length > 0 && (
              <TerminalCard title="BALLOTS" accent="amber">
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {ballots.map((b, i) => (
                    <div key={i} className="flex justify-between text-xs border-b border-border-dim py-1">
                      <span className="text-content-dim">Nullifier: {b.nullifier.slice(0, 16)}...</span>
                      <span className="text-terminal-green">✓ Verified</span>
                    </div>
                  ))}
                </div>
                <button onClick={handleTally} className="mt-3 px-4 py-2 text-xs font-bold border border-terminal-green text-terminal-green hover:bg-terminal-green/10">
                  [ TALLY VOTES ]
                </button>
              </TerminalCard>
            )}

            {tally && (
              <TerminalCard title="RESULTS" accent="green">
                <div className="space-y-3">
                  {tally.results.map((r) => (
                    <div key={r.optionId}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-content-primary">{r.label}</span>
                        <span className="text-content-dim">{r.count} ({r.pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-abyss border border-border-dim">
                        <div className="h-full bg-terminal-green transition-all" style={{ width: `${r.pct}%` }} />
                      </div>
                    </div>
                  ))}
                  {tally.winner && (
                    <p className="text-sm text-terminal-green mt-3">
                      🏆 Winner: {tally.winner.label} ({tally.totalVotes} total votes)
                    </p>
                  )}
                  {tally.spoiledBallots > 0 && (
                    <p className="text-xs text-blood-bright">⚠ {tally.spoiledBallots} spoiled (duplicates or invalid)</p>
                  )}
                </div>
              </TerminalCard>
            )}

            <button onClick={() => { setPoll(null); setBallots([]); setTally(null); }}
              className="px-4 py-2 text-xs border border-border-dim text-content-secondary hover:border-blood">
              [ NEW POLL ]
            </button>
          </>
        )}
      </div>
    </div>
  );
}
