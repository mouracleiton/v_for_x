"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/stores/useStore";
import { tc } from "@/lib/i18n-content";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import {
  PERSONAS,
  getCurrentPersona,
  type Persona,
  type PersonaId,
} from "@/lib/personas";
import {
  getAllPlaybooks,
  getPlaybook,
  getPlaybooksForPersona,
  getPlaybooksByCategory,
  getPlaybooksBySeverity,
  getCompletedPlaybooks,
  getInProgressPlaybooks,
  getNotStartedPlaybooks,
  getPlaybookCompletion,
  getChecklistCompletion,
  isChecklistItemCompleted,
  completeChecklistItem,
  uncompleteChecklistItem,
  resetPlaybookProgress,
  exportPlaybookProgress,
  importPlaybookProgress,
  getPlaybookStats,
  getSeverityDescription,
  getCategoryDisplayName,
  getCategoryIcon,
  type Playbook,
  type PlaybookId,
  type Checklist,
  type PlaybookCategory,
  type PlaybookSeverity,
} from "@/lib/playbooks";

/* ═══════════════════════════════════════════════════════════════
   Component State
   ═══════════════════════════════════════════════════════════════ */

type FilterType = "all" | "completed" | "in_progress" | "not_started";
type CategoryFilter = PlaybookCategory | "all";
type SeverityFilter = PlaybookSeverity | "all";

export default function ThePlaybooksPage() {
  const { lang } = useStore();

  // Current persona
  const [currentPersona, setCurrentPersona] = useState<Persona | null>(null);

  // Playbooks display
  const [allPlaybooks, setAllPlaybooks] = useState<Playbook[]>([]);
  const [filteredPlaybooks, setFilteredPlaybooks] = useState<Playbook[]>([]);
  const [expandedPlaybook, setExpandedPlaybook] = useState<PlaybookId | null>(null);
  const [expandedChecklists, setExpandedChecklists] = useState<Set<string>>(new Set());

  // Filters
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  // Stats
  const [stats, setStats] = useState(getPlaybookStats());

  // Import/Export
  const [exportToken, setExportToken] = useState<string>("");
  const [importToken, setImportToken] = useState<string>("");
  const [importStatus, setImportStatus] = useState<string>("");

  /* ═══════════════════════════════════════════════════════════════
     Initialization
     ═══════════════════════════════════════════════════════════════ */

  useEffect(() => {
    // Load current persona
    const persona = getCurrentPersona();
    setCurrentPersona(persona);

    // Load all playbooks
    const playbooks = getAllPlaybooks();
    setAllPlaybooks(playbooks);
    setFilteredPlaybooks(playbooks);

    // Load stats
    setStats(getPlaybookStats());
  }, []);

  /* ═══════════════════════════════════════════════════════════════
     Filtering
     ═══════════════════════════════════════════════════════════════ */

  useEffect(() => {
    let filtered = allPlaybooks;

    // Apply status filter
    switch (filterType) {
      case "completed":
        filtered = getCompletedPlaybooks();
        break;
      case "in_progress":
        filtered = getInProgressPlaybooks();
        break;
      case "not_started":
        filtered = getNotStartedPlaybooks();
        break;
      default:
        filtered = allPlaybooks;
    }

    // Apply persona filter
    if (currentPersona) {
      const personaPlaybooks = getPlaybooksForPersona(currentPersona.id);
      filtered = filtered.filter((p) => personaPlaybooks.some((pp) => pp.id === p.id));
    }

    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    // Apply severity filter
    if (severityFilter !== "all") {
      filtered = filtered.filter((p) => p.severity === severityFilter);
    }

    setFilteredPlaybooks(filtered);
  }, [filterType, categoryFilter, severityFilter, currentPersona, allPlaybooks]);

  /* ═══════════════════════════════════════════════════════════════
     Event Handlers
     ═══════════════════════════════════════════════════════════════ */

  const handleToggleChecklistItem = useCallback((playbookId: PlaybookId, checklistId: string, itemIndex: number) => {
    const isCompleted = isChecklistItemCompleted(playbookId, checklistId, itemIndex);

    if (isCompleted) {
      uncompleteChecklistItem(playbookId, checklistId, itemIndex);
    } else {
      completeChecklistItem(playbookId, checklistId, itemIndex);
    }

    // Update stats
    setStats(getPlaybookStats());
    sound.select();
  }, []);

  const handleToggleChecklist = useCallback((checklistId: string) => {
    setExpandedChecklists((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(checklistId)) {
        newSet.delete(checklistId);
      } else {
        newSet.add(checklistId);
      }
      return newSet;
    });
    sound.select();
  }, []);

  const handleResetPlaybook = useCallback((playbookId: PlaybookId) => {
    if (confirm(tc(lang, "confirm.reset_progress"))) {
      resetPlaybookProgress(playbookId);
      setStats(getPlaybookStats());
      sound.success();
    }
  }, []);

  const handleExportAllProgress = useCallback(() => {
    try {
      const token = exportPlaybookProgress();
      setExportToken(token);
      sound.success();
    } catch (error) {
      sound.error();
      console.error("Export error:", error);
    }
  }, []);

  const handleImportProgress = useCallback(() => {
    const trimmed = importToken.trim();
    if (!trimmed) {
      setImportStatus(tc(lang, "import.no_token"));
      sound.error();
      return;
    }

    try {
      const success = importPlaybookProgress(trimmed);
      if (success) {
        setImportStatus(tc(lang, "import.success"));
        sound.success();
        setStats(getPlaybookStats());
      } else {
        setImportStatus(tc(lang, "import.invalid_token"));
        sound.error();
      }
    } catch (error) {
      setImportStatus(tc(lang, "import.failed"));
      sound.error();
      console.error("Import error:", error);
    }
  }, [importToken]);

  /* ═══════════════════════════════════════════════════════════════
     Render Helpers
     ═══════════════════════════════════════════════════════════════ */

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getPlaybookStatus = (playbook: Playbook): { label: string; color: "green" | "amber" | "blood" } => {
    const completion = getPlaybookCompletion(playbook.id);
    if (completion === 100) return { label: "COMPLETED", color: "green" };
    if (completion > 0) return { label: `${completion.toFixed(0)}%`, color: "amber" };
    return { label: "NOT STARTED", color: "blood" };
  };

  const getSeverityColor = (severity: PlaybookSeverity): "blood" | "amber" | "green" => {
    switch (severity) {
      case "critical": return "blood";
      case "high": return "amber";
      default: return "green";
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="p-3 sm:p-6 md:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 pt-4">
        <div className="text-xs text-content-dim mb-1">{tc(lang, "playbooks.section_label")}</div>
        <h1 className="text-2xl md:text-3xl text-blood-bright font-bold glow-blood">
          {tc(lang, "playbooks.title")}
        </h1>
        <p className="text-content-secondary text-sm mt-2">
          {tc(lang, "playbooks.subtitle")}
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <TerminalCard title={tc(lang, "playbooks.total")} accent="green">
          <div className="text-2xl font-bold text-content-primary">{stats.totalPlaybooks}</div>
          <div className="text-xs text-content-dim">{tc(lang, "playbooks.playbooks")}</div>
        </TerminalCard>
        <TerminalCard title={tc(lang, "playbooks.completed_filter")} accent="green">
          <div className="text-2xl font-bold text-terminal-green">{stats.completedPlaybooks}</div>
          <div className="text-xs text-content-dim">{tc(lang, "playbooks.done")}</div>
        </TerminalCard>
        <TerminalCard title={tc(lang, "playbooks.in_progress_filter")} accent="amber">
          <div className="text-2xl font-bold text-warning-amber">{stats.inProgressPlaybooks}</div>
          <div className="text-xs text-content-dim">{tc(lang, "playbooks.active")}</div>
        </TerminalCard>
        <TerminalCard title={tc(lang, "playbooks.not_started_filter")} accent="blood">
          <div className="text-2xl font-bold text-content-dim">{stats.notStartedPlaybooks}</div>
          <div className="text-xs text-content-dim">{tc(lang, "playbooks.remaining")}</div>
        </TerminalCard>
        <TerminalCard title={tc(lang, "playbooks.overall")} accent="blood">
          <div className="text-2xl font-bold text-blood-bright">{stats.overallCompletion.toFixed(0)}%</div>
          <div className="text-xs text-content-dim">{tc(lang, "playbooks.overall")}</div>
        </TerminalCard>
      </div>

      {/* Filters */}
      <TerminalCard title={tc(lang, "playbooks.filters")} accent="amber" className="mb-6">
        <div className="space-y-4">
          {/* Status Filter */}
          <div>
            <label className="text-xs text-content-dim mb-2 block">{tc(lang, "playbooks.status")}</label>
            <div className="flex flex-wrap gap-2">
              {(["all", "completed", "in_progress", "not_started"] as FilterType[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterType(filter)}
                  className={`px-3 py-1 text-xs border transition-colors ${
                    filterType === filter
                      ? "border-blood text-blood-bright bg-blood/10"
                      : "border-border-dim text-content-secondary hover:border-blood hover:text-blood"
                  }`}
                >
                  {filter === "all" ? tc(lang, "playbooks.all") : filter === "completed" ? tc(lang, "playbooks.completed_filter") : filter === "in_progress" ? tc(lang, "playbooks.in_progress_filter") : tc(lang, "playbooks.not_started_filter")}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="text-xs text-content-dim mb-2 block">{tc(lang, "playbooks.category")}</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1 text-xs border transition-colors ${
                  categoryFilter === "all"
                    ? "border-blood text-blood-bright bg-blood/10"
                    : "border-border-dim text-content-secondary hover:border-blood hover:text-blood"
                }`}
              >
                {tc(lang, "playbooks.all")}
              </button>
              {(["legal", "infrastructure", "humanitarian", "health", "security", "evidence"] as PlaybookCategory[]).map((category) => (
                <button
                  key={category}
                  onClick={() => setCategoryFilter(category)}
                  className={`px-3 py-1 text-xs border transition-colors ${
                    categoryFilter === category
                      ? "border-blood text-blood-bright bg-blood/10"
                      : "border-border-dim text-content-secondary hover:border-blood hover:text-blood"
                  }`}
                >
                  {getCategoryIcon(category)} {getCategoryDisplayName(category)}
                </button>
              ))}
            </div>
          </div>

          {/* Severity Filter */}
          <div>
            <label className="text-xs text-content-dim mb-2 block">{tc(lang, "playbooks.severity")}</label>
            <div className="flex flex-wrap gap-2">
              {(["all", "critical", "high", "medium", "low"] as SeverityFilter[]).map((severity) => (
                <button
                  key={severity}
                  onClick={() => setSeverityFilter(severity)}
                  disabled={severity === "medium" || severity === "low"}
                  className={`px-3 py-1 text-xs border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                    severityFilter === severity
                      ? "border-blood text-blood-bright bg-blood/10"
                      : "border-border-dim text-content-secondary hover:border-blood hover:text-blood"
                  }`}
                >
                  {severity === "all" ? tc(lang, "playbooks.all") : severity === "critical" ? tc(lang, "playbooks.critical") : severity === "high" ? tc(lang, "playbooks.high") : severity === "medium" ? tc(lang, "playbooks.medium") : tc(lang, "playbooks.low")}
                </button>
              ))}
            </div>
          </div>
        </div>
      </TerminalCard>

      {/* Current Persona Display */}
      {currentPersona && (
        <TerminalCard title={tc(lang, "missions.current_persona")} accent="green" className="mb-6">
          <div className="flex items-center gap-4">
            <span className="text-3xl">{currentPersona.icon}</span>
            <div>
              <div className="text-lg font-bold text-content-primary">{currentPersona.name}</div>
              <div className="text-xs text-content-dim">{currentPersona.description}</div>
            </div>
          </div>
        </TerminalCard>
      )}

      {/* Playbooks List */}
      <div className="space-y-4 mb-6">
        {filteredPlaybooks.length === 0 ? (
          <TerminalCard title="NO PLAYBOOKS FOUND" accent="amber">
            <p className="text-xs text-content-dim">
              No playbooks match your current filters. Try adjusting your filter settings.
            </p>
          </TerminalCard>
        ) : (
          filteredPlaybooks.map((playbook) => {
            const status = getPlaybookStatus(playbook);
            const isExpanded = expandedPlaybook === playbook.id;
            const completion = getPlaybookCompletion(playbook.id);

            return (
              <TerminalCard
                key={playbook.id}
                title={`${playbook.icon} ${playbook.name.toUpperCase()}`}
                accent={status.color}
                glow={isExpanded}
              >
                {/* Playbook Header */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm text-content-secondary mb-2">{playbook.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-content-dim">
                        <span>{getCategoryIcon(playbook.category)} {getCategoryDisplayName(playbook.category)}</span>
                        <span>•</span>
                        <span>{formatTime(playbook.estimatedTime)}</span>
                        <span>•</span>
                        <span>{playbook.checklists.length} checklists</span>
                      </div>
                    </div>
                    <StatusPill color={status.color}>{status.label}</StatusPill>
                  </div>

                  {/* Severity Badge */}
                  <div>
                    <StatusPill color={getSeverityColor(playbook.severity)}>
                      {getSeverityDescription(playbook.severity)}
                    </StatusPill>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-panel border border-border-dim">
                    <div
                      className="bg-terminal-green h-2"
                      style={{ width: `${completion}%` }}
                    />
                  </div>

                  {/* Expand/Collapse Button */}
                  <button
                    onClick={() => setExpandedPlaybook(isExpanded ? null : playbook.id)}
                    className="w-full py-2 border border-blood text-blood-bright hover:bg-blood hover:text-void text-xs font-bold"
                  >
                    {isExpanded ? tc(lang, "playbooks.collapse") : tc(lang, "playbooks.expand")}
                  </button>
                </div>

                {/* Expanded Checklists */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-border-dim space-y-4">
                    {/* Checklists */}
                    {playbook.checklists.map((checklist) => {
                      const checklistCompletion = getChecklistCompletion(playbook.id, checklist.id);
                      const isChecklistExpanded = expandedChecklists.has(checklist.id);

                      return (
                        <div key={checklist.id} className="border border-border-dim">
                          {/* Checklist Header */}
                          <button
                            onClick={() => handleToggleChecklist(checklist.id)}
                            className="w-full p-3 flex items-center justify-between hover:bg-panel transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg">{isChecklistExpanded ? "▼" : "▶"}</span>
                              <div className="text-left">
                                <div className="text-sm font-bold text-content-primary">{checklist.title}</div>
                                <div className="text-xs text-content-dim">
                                  {checklistCompletion.toFixed(0)}% complete • {checklist.items.length} items
                                </div>
                              </div>
                            </div>
                            <div className="w-16 bg-panel border border-border-dim">
                              <div
                                className="h-1.5 bg-terminal-green"
                                style={{ width: `${checklistCompletion}%` }}
                              />
                            </div>
                          </button>

                          {/* Checklist Items */}
                          {isChecklistExpanded && (
                            <div className="p-3 pt-0 space-y-2">
                              {checklist.items.map((item, index) => {
                                const isCompleted = isChecklistItemCompleted(playbook.id, checklist.id, index);

                                return (
                                  <button
                                    key={index}
                                    onClick={() => handleToggleChecklistItem(playbook.id, checklist.id, index)}
                                    className="w-full p-2 flex items-start gap-3 text-left border border-border-dim hover:border-terminal-green transition-colors"
                                  >
                                    <span className={`mt-0.5 ${isCompleted ? "text-terminal-green" : "text-content-dim"}`}>
                                      {isCompleted ? tc(lang, "ui.checked") : tc(lang, "ui.unchecked")}
                                    </span>
                                    <span className={`text-xs flex-1 ${isCompleted ? "line-through text-content-dim" : "text-content-primary"}`}>
                                      {item}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Resources */}
                    {playbook.resources.length > 0 && (
                      <div className="p-3 bg-panel border border-border-dim">
                        <div className="text-xs text-content-dim mb-2">{tc(lang, "playbooks.related_resources")}</div>
                        <div className="space-y-1">
                          {playbook.resources.map((resource, index) => (
                            <div key={index} className="flex items-center gap-2 text-xs">
                              <span className="text-content-dim">→</span>
                              {resource.route ? (
                                <a
                                  href={resource.route}
                                  className="text-terminal-green hover:underline"
                                >
                                  {resource.name}
                                </a>
                              ) : resource.url ? (
                                <a
                                  href={resource.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-terminal-green hover:underline"
                                >
                                  {resource.name} ↗
                                </a>
                              ) : (
                                <span className="text-content-primary">{resource.name}</span>
                              )}
                              {resource.description && (
                                <span className="text-content-dim">— {resource.description}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reset Progress Button */}
                    <button
                      onClick={() => handleResetPlaybook(playbook.id)}
                      className="w-full py-2 border border-border-dim text-content-secondary hover:border-blood hover:text-blood text-xs"
                    >
                      RESET PROGRESS
                    </button>
                  </div>
                )}
              </TerminalCard>
            );
          })
        )}
      </div>

      {/* Import/Export */}
      <TerminalCard title="IMPORT / EXPORT PROGRESS" accent="green" className="mb-6">
        <p className="text-xs text-content-dim mb-3">
          Export your playbook progress for backup or share with trusted allies. Import progress to sync across devices.
        </p>

        <div className="space-y-3">
          <button
            onClick={handleExportAllProgress}
            className="w-full py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void text-xs font-bold"
          >
            EXPORT ALL PROGRESS
          </button>

          {exportToken && (
            <div>
              <label className="text-xs text-content-dim">Exported Token</label>
              <textarea
                readOnly
                value={exportToken}
                className="w-full p-2 bg-abyss border border-border-dim text-[10px] font-mono resize-y min-h-[60px] mt-1"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-content-dim">Import Progress Token</label>
            <input
              type="text"
              value={importToken}
              onChange={(e) => setImportToken(e.target.value)}
              placeholder="Paste playbook progress token..."
              className="w-full p-2 bg-abyss border border-border-dim text-xs focus:border-terminal-green focus:outline-none mt-1"
            />
          </div>

          <button
            onClick={handleImportProgress}
            disabled={!importToken.trim()}
            className="w-full py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed"
          >
            IMPORT PROGRESS
          </button>

          {importStatus && (
            <div className="text-xs font-mono">{importStatus}</div>
          )}
        </div>
      </TerminalCard>

      {/* Info Card */}
      <TerminalCard title={tc(lang, "playbooks.about_playbooks")} accent="amber">
        <div className="space-y-2 text-xs text-content-secondary">
          <p>
            <strong className="text-content-primary">{tc(lang, "playbooks.what_are")}</strong> {tc(lang, "playbooks.what_are_desc")}
          </p>
          <p>
            <strong className="text-content-primary">{tc(lang, "playbooks.how_work")}</strong> {tc(lang, "playbooks.how_work_desc")}
          </p>
          <p>
            <strong className="text-content-primary">{tc(lang, "playbooks.tailored")}</strong> {tc(lang, "playbooks.tailored_desc")}
          </p>
          <p>
            <strong className="text-content-primary">{tc(lang, "playbooks.saved")}</strong> {tc(lang, "playbooks.saved_desc")}
          </p>
          <p className="text-blood-bright">
            <strong>{tc(lang, "playbooks.important")}</strong> {tc(lang, "playbooks.legal_warning")}
          </p>
        </div>
      </TerminalCard>
    </div>
  );
}
