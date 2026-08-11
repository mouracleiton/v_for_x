/**
 * V FOR X — Registry Safety Engine
 *
 * Anti-witch-hunt protection and safety checks for registry dossiers.
 * Provides 6 safety gates to prevent malicious use and protect subjects.
 * VFXERR1 errata format for corrections and dispute resolution.
 *
 * The 6 safety gates:
 *   1. CORROBORATION: Require multiple independent sources
 *   2. VERIFIABILITY: Cryptographic signatures and evidence chains
 *   3. MINIMIZATION: Data minimization - only essential info
 *   4. CONSENT: Consent tracking and harm reduction
 *   5. CONTEXT: Full context, not decontextualized snippets
 *   6. ACCOUNTABILITY: Author accountability and contact info
 *
 * Storage: localStorage key "vfx_safety_gates"
 */

// Simple UUID generator (reused from idb pattern)
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

export type SafetyGateId =
  | "corroboration"
  | "verifiability"
  | "minimization"
  | "consent"
  | "context"
  | "accountability";

export interface SafetyGate {
  /** Gate identifier */
  id: SafetyGateId;
  /** Gate name */
  name: string;
  /** Description of what this gate checks */
  description: string;
  /** Whether this gate is enabled */
  enabled: boolean;
  /** Severity level for violations */
  severity: "low" | "medium" | "high" | "critical";
  /** Check function - returns true if passes */
  check: (context: SafetyContext) => Promise<SafetyCheckResult>;
}

export interface SafetyContext {
  /** Dossier ID being checked */
  dossierId?: string;
  /** Content being published */
  content?: string;
  /** Sources cited */
  sources?: string[];
  /** Evidence tokens */
  evidenceTokens?: string[];
  /** Author identity */
  authorIdentity?: string;
  /** Subject consent status */
  subjectConsent?: boolean;
  /** Metadata about the content */
  metadata?: Record<string, unknown>;
}

export interface SafetyCheckResult {
  /** Whether the check passed */
  passed: boolean;
  /** Gate that was checked */
  gate: SafetyGateId;
  /** Warning or error message */
  message: string;
  /** Specific issues found */
  issues: string[];
  /** Severity of any violations */
  severity: "low" | "medium" | "high" | "critical";
  /** Suggestions for fixing issues */
  suggestions: string[];
}

export interface SafetyReport {
  /** Overall safety assessment */
  safe: boolean;
  /** Results from all gates */
  results: SafetyCheckResult[];
  /** Total issues found */
  totalIssues: number;
  /** Critical issues count */
  criticalIssues: number;
  /** High-severity issues count */
  highIssues: number;
  /** Overall risk score (0-100) */
  riskScore: number;
  /** Whether to block publication */
  shouldBlock: boolean;
}

/* ═══════════════════════════════════════════════════════════════
   VFXERR1 Errata Types
   ═══════════════════════════════════════════════════════════════ */

export type ErrataType = "correction" | "retraction" | "update" | "dispute" | "clarification";

export interface ErrataEntry {
  /** Unique entry ID */
  id: string;
  /** Type of errata */
  type: ErrataType;
  /** Original content that needs correction */
  originalContent: string;
  /** Corrected content */
  correctedContent: string;
  /** Reason for the errata */
  reason: string;
  /** When the errata was issued */
  timestamp: number;
  /** Who issued the errata */
  issuer: string;
  /** Signature over the errata entry */
  signature?: string;
}

export interface ErrataChain {
  /** Dossier ID this errata chain belongs to */
  dossierId: string;
  /** All errata entries in chronological order */
  entries: ErrataEntry[];
  /** When the chain was created */
  createdAt: number;
  /** Last updated timestamp */
  lastUpdated: number;
}

/* ═══════════════════════════════════════════════════════════════
   Safety Gate Definitions
   ═══════════════════════════════════════════════════════════════ */

const SAFETY_GATES: Record<SafetyGateId, SafetyGate> = {
  corroboration: {
    id: "corroboration",
    name: "Multiple Source Corroboration",
    description: "Content should be backed by multiple independent sources",
    enabled: true,
    severity: "high",
    check: async (context: SafetyContext): Promise<SafetyCheckResult> => {
      const issues: string[] = [];
      const suggestions: string[] = [];

      if (!context.sources || context.sources.length < 2) {
        issues.push("Fewer than 2 independent sources cited");
        suggestions.push("Add at least 2 independent sources to corroborate claims");
      }

      // Check for source diversity
      if (context.sources && context.sources.length > 0) {
        const domains = context.sources.map((s: string) => {
          try {
            return new URL(s).hostname;
          } catch {
            return s;
          }
        });
        const uniqueDomains = new Set(domains);

        if (uniqueDomains.size < 2) {
          issues.push("All sources come from the same domain");
          suggestions.push("Include sources from diverse, independent domains");
        }
      }

      return {
        passed: issues.length === 0,
        gate: "corroboration",
        message: issues.length === 0
          ? "Content is properly corroborated"
          : "Corroboration issues detected",
        issues,
        severity: issues.length > 0 ? "high" : "low",
        suggestions,
      };
    },
  },

  verifiability: {
    id: "verifiability",
    name: "Cryptographic Verifiability",
    description: "Claims should be signed and verifiable",
    enabled: true,
    severity: "critical",
    check: async (context: SafetyContext): Promise<SafetyCheckResult> => {
      const issues: string[] = [];
      const suggestions: string[] = [];

      if (!context.authorIdentity) {
        issues.push("No author identity provided - content cannot be attributed");
        suggestions.push("Add author identity for accountability");
      }

      if (!context.evidenceTokens || context.evidenceTokens.length === 0) {
        issues.push("No verifiable evidence tokens provided");
        suggestions.push("Include VFX* tokens for evidence (VFXWIT1, VFXEV1, etc.)");
      }

      // Check for proper token formats
      if (context.evidenceTokens) {
        const invalidTokens = context.evidenceTokens.filter(
          (t) => !/^VFX[A-Z0-9]+:/i.test(t)
        );

        if (invalidTokens.length > 0) {
          issues.push(`${invalidTokens.length} invalid token format(s) detected`);
          suggestions.push("Ensure all evidence tokens use proper VFX* format");
        }
      }

      return {
        passed: issues.length === 0,
        gate: "verifiability",
        message: issues.length === 0
          ? "Content is cryptographically verifiable"
          : "Verifiability issues detected",
        issues,
        severity: issues.length > 0 ? "critical" : "low",
        suggestions,
      };
    },
  },

  minimization: {
    id: "minimization",
    name: "Data Minimization",
    description: "Only include essential information, minimize personal data",
    enabled: true,
    severity: "medium",
    check: async (context: SafetyContext): Promise<SafetyCheckResult> => {
      const issues: string[] = [];
      const suggestions: string[] = [];

      if (!context.content) {
        return {
          passed: true,
          gate: "minimization",
          message: "No content to check",
          issues: [],
          severity: "low",
          suggestions: [],
        };
      }

      // Check for potential personal identifiers
      const personalInfoPatterns = [
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
        /\b\d{3}-\d{3}-\d{4}\b/g, // Phone pattern
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email pattern
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP pattern
      ];

      const content = context.content.toLowerCase();
      for (const pattern of personalInfoPatterns) {
        const matches = context.content!.match(pattern);
        if (matches && matches.length > 0) {
          issues.push(`Potential personal identifiers detected: ${matches.length} instances`);
          suggestions.push("Remove or redact personal identification information");
        }
      }

      // Check content length
      if (context.content.length > 10000) {
        issues.push("Content is unusually long - consider data minimization");
        suggestions.push("Break into smaller, focused entries or summarize");
      }

      return {
        passed: issues.length === 0,
        gate: "minimization",
        message: issues.length === 0
          ? "Content follows data minimization principles"
          : "Data minimization issues detected",
        issues,
        severity: issues.length > 0 ? "medium" : "low",
        suggestions,
      };
    },
  },

  consent: {
    id: "consent",
    name: "Subject Consent & Harm Reduction",
    description: "Track consent status and minimize harm to subjects",
    enabled: true,
    severity: "critical",
    check: async (context: SafetyContext): Promise<SafetyCheckResult> => {
      const issues: string[] = [];
      const suggestions: string[] = [];

      if (context.subjectConsent === false) {
        issues.push("Subject has not consented to inclusion");
        suggestions.push("Consider removing content or obtaining consent");
      }

      if (context.subjectConsent === undefined && context.metadata?.["involves_minors"]) {
        issues.push("Content may involve minors without explicit consent");
        suggestions.push("Extra caution required for content involving minors");
      }

      // Check for potentially harmful content
      const harmfulKeywords = [
        "doxxing",
        "doxing",
        "home address",
        "home address:",
        "lives at",
        "resides at",
      ];

      if (context.content) {
        const content = context.content.toLowerCase();
        for (const keyword of harmfulKeywords) {
          if (content.includes(keyword)) {
            issues.push(`Potentially harmful content detected: "${keyword}"`);
            suggestions.push("Remove personally identifying information");
          }
        }
      }

      return {
        passed: issues.length === 0,
        gate: "consent",
        message: issues.length === 0
          ? "Consent and harm reduction checks passed"
          : "Consent/harm reduction issues detected",
        issues,
        severity: issues.length > 0 ? "critical" : "low",
        suggestions,
      };
    },
  },

  context: {
    id: "context",
    name: "Full Context Preservation",
    description: "Provide full context, avoid decontextualized snippets",
    enabled: true,
    severity: "medium",
    check: async (context: SafetyContext): Promise<SafetyCheckResult> => {
      const issues: string[] = [];
      const suggestions: string[] = [];

      if (!context.content) {
        return {
          passed: true,
          gate: "context",
          message: "No content to check",
          issues: [],
          severity: "low",
          suggestions: [],
        };
      }

      // Check for quote fragments without context
      const quoteFragments = context.content.match(/"[^"]{5,30}"/g);
      if (quoteFragments && quoteFragments.length > 3) {
        issues.push("Multiple short quote fragments detected - may lack context");
        suggestions.push("Provide full quotes or more context for fragments");
      }

      // Check content length for adequate context
      if (context.content.length < 200) {
        issues.push("Content is very short - may lack adequate context");
        suggestions.push("Expand content to provide sufficient background and context");
      }

      // Check for ellipses that might indicate omitted content
      if ((context.content.match(/\.\.\./g) || []).length > 2) {
        issues.push("Multiple ellipses detected - content may be incomplete");
        suggestions.push("Ensure omitted content doesn't change meaning or remove important context");
      }

      return {
        passed: issues.length === 0,
        gate: "context",
        message: issues.length === 0
          ? "Content provides adequate context"
          : "Context preservation issues detected",
        issues,
        severity: issues.length > 0 ? "medium" : "low",
        suggestions,
      };
    },
  },

  accountability: {
    id: "accountability",
    name: "Author Accountability",
    description: "Author information and contact for verification",
    enabled: true,
    severity: "high",
    check: async (context: SafetyContext): Promise<SafetyCheckResult> => {
      const issues: string[] = [];
      const suggestions: string[] = [];

      if (!context.authorIdentity) {
        issues.push("No author identity provided");
        suggestions.push("Include author identity for accountability");
      }

      if (!context.metadata?.["contact"] && !context.metadata?.["verification_url"]) {
        issues.push("No contact or verification method provided");
        suggestions.push("Add contact information or verification URL");
      }

      // Check for timestamp
      if (!context.metadata?.["created_at"] && !context.metadata?.["timestamp"]) {
        issues.push("No creation timestamp provided");
        suggestions.push("Include creation timestamp for temporal accountability");
      }

      return {
        passed: issues.length === 0,
        gate: "accountability",
        message: issues.length === 0
          ? "Author accountability measures in place"
          : "Accountability issues detected",
        issues,
        severity: issues.length > 0 ? "high" : "low",
        suggestions,
      };
    },
  },
};

/* ═══════════════════════════════════════════════════════════════
   Safety Check Functions
   ═══════════════════════════════════════════════════════════════ */

/**
 * Run all enabled safety gates and generate a safety report.
 */
export async function runSafetyChecks(context: SafetyContext): Promise<SafetyReport> {
  const results: SafetyCheckResult[] = [];
  let totalIssues = 0;
  let criticalIssues = 0;
  let highIssues = 0;

  for (const gate of Object.values(SAFETY_GATES)) {
    if (!gate.enabled) continue;

    const result = await gate.check(context);
    results.push(result);

    totalIssues += result.issues.length;
    if (result.severity === "critical") criticalIssues++;
    if (result.severity === "high") highIssues++;
  }

  // Calculate risk score (0-100)
  const riskScore = calculateRiskScore(results);

  // Determine if should block
  const shouldBlock = criticalIssues > 0 || highIssues > 1;

  return {
    safe: totalIssues === 0,
    results,
    totalIssues,
    criticalIssues,
    highIssues,
    riskScore,
    shouldBlock,
  };
}

/**
 * Calculate overall risk score from safety check results.
 */
function calculateRiskScore(results: SafetyCheckResult[]): number {
  if (results.length === 0) return 0;

  let totalScore = 0;

  for (const result of results) {
    if (!result.passed) {
      switch (result.severity) {
        case "critical":
          totalScore += 25;
          break;
        case "high":
          totalScore += 15;
          break;
        case "medium":
          totalScore += 8;
          break;
        case "low":
          totalScore += 3;
          break;
      }

      // Add points for each issue
      totalScore += result.issues.length * 2;
    }
  }

  return Math.min(100, totalScore);
}

/**
 * Get a specific safety gate by ID.
 */
export function getSafetyGate(gateId: SafetyGateId): SafetyGate | null {
  return SAFETY_GATES[gateId] || null;
}

/**
 * Get all safety gates.
 */
export function getAllSafetyGates(): SafetyGate[] {
  return Object.values(SAFETY_GATES);
}

/**
 * Enable or disable a specific safety gate.
 */
export function setSafetyGateEnabled(gateId: SafetyGateId, enabled: boolean): void {
  const gate = SAFETY_GATES[gateId];
  if (gate) {
    gate.enabled = enabled;
    saveSafetyGatesConfig();
  }
}

/**
 * Save safety gates configuration to localStorage.
 */
function saveSafetyGatesConfig(): void {
  if (typeof window === "undefined") return;

  const config: Record<string, boolean> = {};
  for (const [id, gate] of Object.entries(SAFETY_GATES)) {
    config[id] = gate.enabled;
  }

  try {
    localStorage.setItem("vfx_safety_gates", JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save safety gates config:", error);
  }
}

/**
 * Load safety gates configuration from localStorage.
 */
export function loadSafetyGatesConfig(): void {
  if (typeof window === "undefined") return;

  try {
    const stored = localStorage.getItem("vfx_safety_gates");
    if (!stored) return;

    const config = JSON.parse(stored) as Record<string, boolean>;

    for (const [id, enabled] of Object.entries(config)) {
      const gate = SAFETY_GATES[id as SafetyGateId];
      if (gate) {
        gate.enabled = enabled;
      }
    }
  } catch (error) {
    console.error("Failed to load safety gates config:", error);
  }
}

/* ═══════════════════════════════════════════════════════════════
   VFXERR1 Errata Functions
   ═══════════════════════════════════════════════════════════════ */

const ERRATA_STORAGE_KEY = "vfx_errata_chains";

/**
 * Get errata chain for a dossier.
 */
export function getErrataChain(dossierId: string): ErrataChain | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(`${ERRATA_STORAGE_KEY}_${dossierId}`);
    if (!stored) return null;

    return JSON.parse(stored) as ErrataChain;
  } catch {
    return null;
  }
}

/**
 * Create a new errata chain for a dossier.
 */
export function createErrataChain(dossierId: string): ErrataChain {
  const chain: ErrataChain = {
    dossierId,
    entries: [],
    createdAt: Date.now(),
    lastUpdated: Date.now(),
  };

  saveErrataChain(chain);
  return chain;
}

/**
 * Add an errata entry to a chain.
 */
export function addErrataEntry(
  dossierId: string,
  type: ErrataType,
  originalContent: string,
  correctedContent: string,
  reason: string,
  issuer: string,
  signature?: string
): ErrataEntry {
  let chain = getErrataChain(dossierId);

  if (!chain) {
    chain = createErrataChain(dossierId);
  }

  const entry: ErrataEntry = {
    id: generateUUID(),
    type,
    originalContent,
    correctedContent,
    reason,
    timestamp: Date.now(),
    issuer,
    signature,
  };

  chain.entries.push(entry);
  chain.lastUpdated = Date.now();

  saveErrataChain(chain);
  return entry;
}

/**
 * Save an errata chain to localStorage.
 */
function saveErrataChain(chain: ErrataChain): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(`${ERRATA_STORAGE_KEY}_${chain.dossierId}`, JSON.stringify(chain));
  } catch (error) {
    console.error("Failed to save errata chain:", error);
  }
}

/**
 * Encode an errata chain as VFXERR1 token.
 */
export function encodeErrataToken(chain: ErrataChain): string {
  const token = {
    v: 1,
    id: chain.dossierId,
    e: chain.entries.map((entry) => ({
      t: entry.type,
      o: entry.originalContent,
      c: entry.correctedContent,
      r: entry.reason,
      ts: entry.timestamp,
      i: entry.issuer,
      s: entry.signature,
    })),
    ca: chain.createdAt,
    lu: chain.lastUpdated,
  };

  const json = JSON.stringify(token);
  const base64 = btoa(json);
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

  return `VFXERR1:${base64url}`;
}

/**
 * Decode a VFXERR1 token.
 */
export function decodeErrataToken(token: string): ErrataChain | null {
  if (!token.startsWith("VFXERR1:")) {
    return null;
  }

  try {
    const base64url = token.slice(8); // Remove "VFXERR1:"
    const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const data = JSON.parse(json) as {
      v: number;
      id: string;
      e: Array<{
        t: ErrataType;
        o: string;
        c: string;
        r: string;
        ts: number;
        i: string;
        s?: string;
      }>;
      ca: number;
      lu: number;
    };

    if (data.v !== 1 || !data.id || !Array.isArray(data.e)) {
      return null;
    }

    const chain: ErrataChain = {
      dossierId: data.id,
      entries: data.e.map((entry) => ({
        id: generateUUID(),
        type: entry.t,
        originalContent: entry.o,
        correctedContent: entry.c,
        reason: entry.r,
        timestamp: entry.ts,
        issuer: entry.i,
        signature: entry.s,
      })),
      createdAt: data.ca,
      lastUpdated: data.lu,
    };

    return chain;
  } catch {
    return null;
  }
}

// Load safety gates config on module load
if (typeof window !== "undefined") {
  loadSafetyGatesConfig();
}