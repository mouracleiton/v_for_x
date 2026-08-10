"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import { useStore } from "@/stores/useStore";
import type { Lang } from "@/lib/i18n";
import {
  SEED_STORIES,
  computeStats,
  filterStories,
  formatAudioDuration,
  getConsentBadge,
  getAnonymizationBadge,
  createStorySubmission,
  validateSubmission,
  suggestPseudonym,
  causeToLivesKey,
  type FaceStory,
  type StoryFormat,
  type StoryCause,
  type ConsentLevel,
  type AnonymizationLevel,
  type StorySubmission,
} from "@/lib/faces";
import { ft } from "@/lib/faces-i18n";

const SUBMISSIONS_KEY = "vfx-faces-submissions";
const VIEWED_KEY = "vfx-faces-viewed";

export default function TheFacesPage() {
  const { lang } = useStore();
  const L = ft(lang);

  const [filterFormat, setFilterFormat] = useState<StoryFormat | "all">("all");
  const [filterCause, setFilterCause] = useState<StoryCause | "all">("all");
  const [activeStory, setActiveStory] = useState<FaceStory | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [submissions, setSubmissions] = useState<StorySubmission[]>([]);
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set());

  // Form state
  const [fName, setFName] = useState("");
  const [fAge, setFAge] = useState("");
  const [fRole, setFRole] = useState("");
  const [fRegion, setFRegion] = useState("");
  const [fFormat, setFFormat] = useState<StoryFormat>("text");
  const [fCause, setFCause] = useState<StoryCause>("hunger");
  const [fTitle, setFTitle] = useState("");
  const [fBody, setFBody] = useState("");
  const [fConsent, setFConsent] = useState<ConsentLevel>("consented_pseudonym");
  const [fAnon, setFAnon] = useState<AnonymizationLevel>("pseudonym");
  const [fContact, setFContact] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  const stats = useMemo(() => computeStats(), []);
  const filteredStories = useMemo(
    () => filterStories(SEED_STORIES, { format: filterFormat, cause: filterCause }),
    [filterFormat, filterCause],
  );

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SUBMISSIONS_KEY);
      if (stored) setSubmissions(JSON.parse(stored));
      const viewed = localStorage.getItem(VIEWED_KEY);
      if (viewed) setViewedIds(new Set(JSON.parse(viewed)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(submissions));
  }, [submissions]);

  const openStory = (story: FaceStory) => {
    setActiveStory(story);
    setPhotoIdx(0);
    if (!viewedIds.has(story.id)) {
      const next = new Set(viewedIds);
      next.add(story.id);
      setViewedIds(next);
      localStorage.setItem(VIEWED_KEY, JSON.stringify([...next]));
    }
    sound.select();
  };

  const closeStory = () => {
    setActiveStory(null);
    sound.nav();
  };

  const handleSubmit = () => {
    setFormError(null);
    const error = validateSubmission({ title: fTitle, body: fBody, pseudonym: fName, consent: fConsent });
    if (error) {
      setFormError(error);
      sound.error();
      return;
    }
    const sub = createStorySubmission({
      format: fFormat,
      cause: fCause,
      region: fRegion || "Undisclosed",
      pseudonym: fName,
      age: fAge ? Number(fAge) : undefined,
      role: fRole || "Survivor",
      title: fTitle,
      body: fBody,
      consent: fConsent,
      anonymization: fAnon,
      contactBack: fContact,
    });
    setSubmissions((prev) => [sub, ...prev]);
    setFormSuccess(true);
    sound.success();
    setTimeout(() => {
      setFormSuccess(false);
      setShowForm(false);
      setFName(""); setFAge(""); setFRole(""); setFRegion("");
      setFTitle(""); setFBody(""); setFContact(false);
    }, 2500);
  };

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">🕯️ THE FACES</h1>
      <p className="text-content-secondary text-sm mb-1">// {L.tagline}</p>
      <p className="text-base text-content-primary mt-4 mb-2 italic">
        &ldquo;{L.statistics_inform} <span className="text-blood-bright font-bold not-italic">{L.stories_move}</span>&rdquo;
      </p>
      <p className="text-content-secondary text-sm mb-6">{L.intro}</p>

      {/* Stats strip */}
      <TerminalCard title="THE ARCHIVE" accent="amber" glow>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBlock value={stats.total} label={L.voices_count} icon="🗣️" />
          <StatBlock value={stats.countries} label={L.countries_count} icon="🌍" />
          <StatBlock value={stats.audioHours} label={L.audio_hours} icon="🎙️" />
          <StatBlock value={stats.byFormat.photo_essay} label={L.photo_essays} icon="📷" />
        </div>
      </TerminalCard>

      {/* Filters */}
      <div className="mt-4 flex flex-wrap gap-4 items-start">
        <div className="flex-shrink-0">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">{L.filter_by_format}</div>
          <FilterPills
            value={filterFormat}
            onChange={(v) => { setFilterFormat(v); sound.nav(); }}
            options={[
              { value: "all", label: L.all },
              { value: "text", label: L.format_text },
              { value: "audio", label: L.format_audio },
              { value: "photo_essay", label: L.format_photo },
            ]}
          />
        </div>
        <div className="flex-shrink-0">
          <div className="text-[10px] text-content-dim uppercase tracking-widest mb-1">{L.filter_by_cause}</div>
          <FilterPills
            value={filterCause}
            onChange={(v) => { setFilterCause(v); sound.nav(); }}
            options={[
              { value: "all", label: L.all },
              { value: "hunger", label: L.cause_hunger },
              { value: "conflict", label: L.cause_conflict },
              { value: "water", label: L.cause_water },
              { value: "disease", label: L.cause_disease },
              { value: "displacement", label: L.cause_displacement },
              { value: "poverty", label: L.cause_poverty },
            ]}
          />
        </div>
      </div>

      {/* Story cards */}
      {filteredStories.length === 0 ? (
        <div className="mt-6 text-center text-content-dim text-sm py-8">{L.no_stories}</div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredStories.map((story) => (
            <StoryCard
              key={story.id}
              story={story}
              lang={lang}
              L={L}
              viewed={viewedIds.has(story.id)}
              onOpen={() => openStory(story)}
            />
          ))}
        </div>
      )}

      {/* Cross-links */}
      <TerminalCard title="THE TRIAD" accent="green" className="mt-6">
        <p className="text-xs text-content-dim mb-3">
          {L.statistics_inform} {L.stories_move} — three layers, one truth:
        </p>
        <div className="space-y-2">
          <Link href="/the-lives/" className="block p-3 border border-border-dim hover:border-blood transition-colors" onClick={() => sound.nav()}>
            <span className="text-blood-bright text-sm font-bold">🕯️ THE LIVES</span>
            <span className="text-xs text-content-secondary ml-2">{L.linked_lives}</span>
          </Link>
          <Link href="/the-testimony/" className="block p-3 border border-border-dim hover:border-blood transition-colors" onClick={() => sound.nav()}>
            <span className="text-blood-bright text-sm font-bold">📝 THE TESTIMONY</span>
            <span className="text-xs text-content-secondary ml-2">{L.linked_testimony}</span>
          </Link>
          <Link href="/the-stories/" className="block p-3 border border-border-dim hover:border-blood transition-colors" onClick={() => sound.nav()}>
            <span className="text-blood-bright text-sm font-bold">📖 THE STORIES</span>
            <span className="text-xs text-content-secondary ml-2">{L.linked_stories}</span>
          </Link>
        </div>
      </TerminalCard>

      {/* Ethical note */}
      <div className="mt-4 p-3 border border-terminal-green/30 bg-terminal-green/5">
        <p className="text-xs text-terminal-green/80">{L.ethical_note}</p>
      </div>

      {/* Submit button */}
      {!showForm && (
        <button
          onClick={() => { setShowForm(true); sound.select(); }}
          className="mt-4 w-full px-4 py-3 text-sm font-bold border border-blood text-blood-bright hover:bg-blood hover:text-white transition-colors"
        >
          [ + {L.submit_story} ]
        </button>
      )}

      {/* Submission form */}
      {showForm && (
        <TerminalCard title={L.submit_title} accent="blood" className="mt-4">
          <p className="text-sm text-content-secondary mb-4">{L.submit_desc}</p>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-content-dim uppercase tracking-widest">{L.name_pseudonym}</label>
                <div className="flex gap-2">
                  <input type="text" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="..." className="flex-1 bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
                  <button onClick={() => { setFName(suggestPseudonym()); sound.select(); }} className="px-2 py-2 text-[10px] border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright whitespace-nowrap">{L.suggest_name}</button>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-content-dim uppercase tracking-widest">{L.age_optional}</label>
                <input type="number" value={fAge} onChange={(e) => setFAge(e.target.value)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-content-dim uppercase tracking-widest">{L.role}</label>
                <input type="text" value={fRole} onChange={(e) => setFRole(e.target.value)} placeholder="Mother, teacher, survivor..." className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
              </div>
              <div>
                <label className="text-[10px] text-content-dim uppercase tracking-widest">{L.region_location}</label>
                <input type="text" value={fRegion} onChange={(e) => setFRegion(e.target.value)} placeholder="Region (not exact address)" className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-content-dim uppercase tracking-widest">{L.format}</label>
                <select value={fFormat} onChange={(e) => setFFormat(e.target.value as StoryFormat)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary">
                  <option value="text">{L.format_text}</option>
                  <option value="audio">{L.format_audio}</option>
                  <option value="photo_essay">{L.format_photo}</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-content-dim uppercase tracking-widest">{L.cause_label}</label>
                <select value={fCause} onChange={(e) => setFCause(e.target.value as StoryCause)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary">
                  <option value="hunger">{L.cause_hunger}</option>
                  <option value="conflict">{L.cause_conflict}</option>
                  <option value="water">{L.cause_water}</option>
                  <option value="disease">{L.cause_disease}</option>
                  <option value="displacement">{L.cause_displacement}</option>
                  <option value="poverty">{L.cause_poverty}</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-content-dim uppercase tracking-widest">{L.story_title}</label>
              <input type="text" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="A headline from your own words..." className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary" />
            </div>
            <div>
              <label className="text-[10px] text-content-dim uppercase tracking-widest">{L.your_testimony}</label>
              <textarea value={fBody} onChange={(e) => setFBody(e.target.value)} rows={5} placeholder="I witnessed... I survived... I lost..." className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary font-mono" />
              <div className="text-[10px] text-content-dim mt-1">{fBody.length} chars (min 50)</div>
            </div>
            <div>
              <label className="text-[10px] text-content-dim uppercase tracking-widest">{L.consent_label} *</label>
              <select value={fConsent} onChange={(e) => setFConsent(e.target.value as ConsentLevel)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary">
                <option value="full_consent">{L.consent_full}</option>
                <option value="consented_pseudonym">{L.consent_pseudonym}</option>
                <option value="consented_composite">{L.consent_composite}</option>
                <option value="family_consent">{L.consent_family}</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-content-dim uppercase tracking-widest">{L.anonymization_label}</label>
              <select value={fAnon} onChange={(e) => setFAnon(e.target.value as AnonymizationLevel)} className="w-full bg-abyss border border-border-dim px-3 py-2 text-sm text-content-primary">
                <option value="first_name_only">{L.anon_first}</option>
                <option value="pseudonym">{L.anon_pseudonym}</option>
                <option value="fully_anonymized">{L.anon_full}</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-content-secondary">
              <input type="checkbox" checked={fContact} onChange={(e) => setFContact(e.target.checked)} />
              {L.contact_back}
            </label>
            {formError && <p className="text-blood-bright text-sm">{`// ${formError}`}</p>}
            {formSuccess && <p className="text-terminal-green text-sm">{L.submission_saved}</p>}
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="px-4 py-2 text-xs font-bold bg-blood text-white hover:bg-blood-bright">
                {L.submit_btn}
              </button>
              <button onClick={() => { setShowForm(false); setFormError(null); sound.nav(); }} className="px-4 py-2 text-xs border border-border-dim text-content-secondary">
                {L.cancel_btn}
              </button>
            </div>
          </div>
        </TerminalCard>
      )}

      {/* User submissions */}
      {submissions.length > 0 && (
        <TerminalCard title={L.your_submissions} accent="amber" className="mt-4">
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {submissions.map((s) => (
              <div key={s.id} className="border border-border-dim p-3 bg-abyss">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-warning-amber">{s.id}</span>
                  <span className="text-[10px] text-content-dim">{new Date(s.submittedAt).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-content-primary font-bold italic">&ldquo;{s.title}&rdquo;</p>
                <p className="text-xs text-content-secondary mt-1 font-mono line-clamp-2">{s.body}</p>
                <p className="text-[10px] text-terminal-green mt-1">✓ PENDING REVIEW</p>
              </div>
            ))}
          </div>
        </TerminalCard>
      )}

      {/* Story detail modal */}
      {activeStory && (
        <StoryModal story={activeStory} lang={lang} L={L} photoIdx={photoIdx} setPhotoIdx={setPhotoIdx} onClose={closeStory} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function StatBlock({ value, label, icon }: { value: number; label: string; icon: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-blood-bright">{value}</div>
      <div className="text-[10px] text-content-dim uppercase tracking-widest">{label}</div>
    </div>
  );
}

function FilterPills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 text-[10px] border transition-colors ${
            value === opt.value
              ? "border-blood text-blood-bright bg-blood/10"
              : "border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function StoryCard({
  story,
  lang,
  L,
  viewed,
  onOpen,
}: {
  story: FaceStory;
  lang: Lang;
  L: ReturnType<typeof ft>;
  viewed: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      onClick={onOpen}
      className="text-left terminal-card p-4 hover:border-blood transition-colors block group"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[10px] text-content-dim uppercase tracking-widest">
          {story.format === "audio" ? "🎙️" : story.format === "photo_essay" ? "📷" : "📝"} {story.region}
        </span>
        {viewed && <span className="text-[9px] text-terminal-green/50">● READ</span>}
      </div>
      <p className="text-sm text-content-primary font-bold italic group-hover:text-blood-bright transition-colors">
        &ldquo;{story.title}&rdquo;
      </p>
      <p className="text-xs text-content-secondary mt-2 line-clamp-3">{story.body.split("\n")[0]}</p>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-dim">
        <span className="text-[10px] text-content-dim">
          {story.pseudonym}, {story.age ?? "?"} · {story.role}
        </span>
        <span className="text-[10px] text-terminal-green">{getConsentBadge(story)}</span>
      </div>
      {story.format === "audio" && story.audioDurationSec && (
        <div className="text-[10px] text-content-dim mt-1">⏱ {formatAudioDuration(story.audioDurationSec, lang)}</div>
      )}
    </button>
  );
}

function StoryModal({
  story,
  lang,
  L,
  photoIdx,
  setPhotoIdx,
  onClose,
}: {
  story: FaceStory;
  lang: Lang;
  L: ReturnType<typeof ft>;
  photoIdx: number;
  setPhotoIdx: (n: number) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-start md:items-center justify-center p-3 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-abyss border border-blood-dim max-w-2xl w-full my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-4 border-b border-border-dim">
          <div>
            <span className="text-[10px] text-content-dim uppercase tracking-widest">
              {story.id} · {story.region} · {story.year}
            </span>
          </div>
          <button onClick={onClose} className="text-content-dim hover:text-blood-bright text-lg leading-none">✕</button>
        </div>

        {/* Modal body */}
        <div className="p-4 md:p-6 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <h2 className="text-xl text-blood-bright font-bold italic mb-1">&ldquo;{story.title}&rdquo;</h2>
          <p className="text-sm text-content-secondary mb-4">
            — {story.pseudonym}, {story.age ?? "?"} · {story.role}
          </p>

          {/* Format-specific media */}
          {story.format === "audio" && (
            <div className="mb-4 p-4 border border-border-dim bg-void text-center">
              <div className="text-4xl mb-2">🎙️</div>
              <button
                onClick={() => sound.success()}
                className="px-4 py-2 text-xs font-bold border border-terminal-green text-terminal-green hover:bg-terminal-green/10"
              >
                {L.play_audio}
              </button>
              {story.audioDurationSec && (
                <p className="text-[10px] text-content-dim mt-2">⏱ {formatAudioDuration(story.audioDurationSec, lang)}</p>
              )}
              <p className="text-[9px] text-content-dim mt-1">// audio playback placeholder — testimony recorded on-site</p>
            </div>
          )}

          {story.format === "photo_essay" && story.photoCaptions && (
            <div className="mb-4">
              <div className="aspect-video bg-void border border-border-dim flex items-center justify-center mb-2 relative">
                <div className="text-center p-4">
                  <div className="text-5xl mb-2">📷</div>
                  <p className="text-xs text-content-dim max-w-sm">{story.photoCaptions[photoIdx]}</p>
                </div>
                {story.photoCaptions.length > 1 && (
                  <>
                    <button
                      onClick={() => setPhotoIdx((photoIdx - 1 + story.photoCaptions!.length) % story.photoCaptions!.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-content-dim hover:text-blood-bright text-2xl"
                    >
                      ‹
                    </button>
                    <button
                      onClick={() => setPhotoIdx((photoIdx + 1) % story.photoCaptions!.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-content-dim hover:text-blood-bright text-2xl"
                    >
                      ›
                    </button>
                  </>
                )}
              </div>
              <div className="flex justify-center gap-1.5">
                {story.photoCaptions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPhotoIdx(i)}
                    className="h-1.5 transition-all"
                    style={{ width: i === photoIdx ? 20 : 6, backgroundColor: i === photoIdx ? "var(--color-blood)" : "var(--color-border-dim)" }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Body */}
          <div className="space-y-3">
            {story.body.split("\n\n").map((para, i) => (
              <p key={i} className="text-sm text-content-primary leading-relaxed">{para}</p>
            ))}
          </div>

          {/* Aftermath */}
          {story.aftermath && (
            <div className="mt-4 p-3 border-l-2 border-terminal-green bg-terminal-green/5">
              <p className="text-[10px] text-terminal-green uppercase tracking-widest mb-1">{L.aftermath}</p>
              <p className="text-xs text-content-secondary">{story.aftermath}</p>
            </div>
          )}

          {/* Consent + anonymization badges */}
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-[10px] text-terminal-green border border-terminal-green/30 px-2 py-0.5">{getConsentBadge(story)}</span>
            <span className="text-[10px] text-content-dim border border-border-dim px-2 py-0.5">{getAnonymizationBadge(story)}</span>
            {story.verified && <span className="text-[10px] text-warning-amber border border-warning-amber/30 px-2 py-0.5">★ {L.verified}</span>}
          </div>

          {/* Source */}
          <div className="mt-4 pt-3 border-t border-border-dim">
            <p className="text-[10px] text-content-dim">
              {L.source}: {story.source}
              {story.sourceUrl && (
                <>
                  {" · "}
                  <a href={story.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-terminal-green hover:underline">
                    link ↗
                  </a>
                </>
              )}
            </p>
          </div>

          {/* Link to /the-lives */}
          <Link
            href={`/the-lives/`}
            className="mt-4 block p-3 border border-border-dim hover:border-blood transition-colors text-center"
            onClick={() => sound.nav()}
          >
            <span className="text-xs text-blood-bright">{L.linked_lives}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
