import { describe, it, expect, beforeEach, vi } from "vitest";
import backbone from "../data/world_backbone.json";
import type { WorldBackbone } from "../lib/types";
import {
  COURSES,
  getCourseProgress,
  saveProgress,
  getCertificate,
  type Course,
} from "../lib/education";

const data = backbone as WorldBackbone;

// localStorage is not provided by this jsdom build — stub it like other tests.
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
};
vi.stubGlobal("localStorage", localStorageMock);

/** Read a dotted key path from a country record. */
function lookup(country: Record<string, unknown>, path: string): unknown {
  let node: unknown = country;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

const VALID_DIFFICULTIES: Course["difficulty"][] = [
  "beginner",
  "intermediate",
  "advanced",
];

beforeEach(() => {
  localStorage.clear();
});

describe("COURSES catalog", () => {
  it("contains exactly four courses", () => {
    expect(COURSES).toHaveLength(4);
  });

  it("has globally unique course ids", () => {
    const ids = COURSES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each course has valid metadata", () => {
    for (const course of COURSES) {
      expect(course.title.length).toBeGreaterThan(0);
      expect(course.description.length).toBeGreaterThan(0);
      expect(course.duration).toMatch(/min/);
      expect(VALID_DIFFICULTIES).toContain(course.difficulty);
      expect(course.modules.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("modules are well-formed with unique ids per course", () => {
    for (const course of COURSES) {
      const ids = course.modules.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const m of course.modules) {
        expect(m.title.length).toBeGreaterThan(0);
        expect(m.content.length).toBeGreaterThan(0);
      }
    }
  });

  it("quiz correctIndex values are in range and explanations exist", () => {
    for (const course of COURSES) {
      for (const m of course.modules) {
        if (!m.quiz) continue;
        for (const q of m.quiz) {
          expect(q.options.length).toBeGreaterThanOrEqual(2);
          expect(q.correctIndex).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex).toBeLessThan(q.options.length);
          expect(q.explanation.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("data exploration metric keys", () => {
  it("every dataExploration metricKey resolves in the real dataset", () => {
    for (const course of COURSES) {
      for (const m of course.modules) {
        if (!m.dataExploration) continue;
        const { metricKey, iso3 } = m.dataExploration;

        if (iso3) {
          const country = data.countries.find(
            (c) => c.iso3.toUpperCase() === iso3.toUpperCase(),
          );
          expect(country, `country ${iso3} for ${metricKey}`).toBeDefined();
          expect(
            lookup(country as unknown as Record<string, unknown>, metricKey),
            `metric ${metricKey} in ${iso3}`,
          ).toBeDefined();
        } else {
          // No country hint — check the global indicators section first.
          const inGlobal =
            lookup(
              data.global_indicators as unknown as Record<string, unknown>,
              metricKey.replace("global_indicators.", ""),
            ) !== undefined;
          // Otherwise fall back to the first country that has it.
          const withData = inGlobal
            ? []
            : data.countries.filter(
                (c) =>
                  lookup(c as unknown as Record<string, unknown>, metricKey) !==
                  undefined,
              );
          expect(
            inGlobal || withData.length > 0,
            `metric ${metricKey} found nowhere in dataset`,
          ).toBe(true);
        }
      }
    }
  });

  it("each data exploration has a prompt", () => {
    for (const course of COURSES) {
      for (const m of course.modules) {
        if (m.dataExploration) {
          expect(m.dataExploration.prompt.length).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("progress persistence", () => {
  it("returns empty progress when nothing is stored", () => {
    const progress = getCourseProgress(COURSES[0].id);
    expect(progress.completedModules).toEqual([]);
    expect(progress.quizScores).toEqual({});
  });

  it("saveProgress marks a module complete", () => {
    const course = COURSES[0];
    const moduleId = course.modules[0].id;
    saveProgress(course.id, moduleId, 100);
    const progress = getCourseProgress(course.id);
    expect(progress.completedModules).toContain(moduleId);
  });

  it("keeps the higher quiz score on re-save", () => {
    const course = COURSES[0];
    const moduleId = course.modules[0].id;
    saveProgress(course.id, moduleId, 50);
    saveProgress(course.id, moduleId, 90);
    expect(getCourseProgress(course.id).quizScores[moduleId]).toBe(90);
    saveProgress(course.id, moduleId, 30);
    expect(getCourseProgress(course.id).quizScores[moduleId]).toBe(90);
  });

  it("does not duplicate completed module ids", () => {
    const course = COURSES[0];
    const moduleId = course.modules[0].id;
    saveProgress(course.id, moduleId);
    saveProgress(course.id, moduleId);
    const progress = getCourseProgress(course.id);
    expect(progress.completedModules.filter((m) => m === moduleId)).toHaveLength(1);
  });
});

describe("getCertificate", () => {
  it("returns null until all modules are complete", () => {
    const course = COURSES[0];
    saveProgress(course.id, course.modules[0].id, 80);
    expect(getCertificate(course.id)).toBeNull();
  });

  it("returns a certificate once all modules are complete", () => {
    const course = COURSES[0];
    for (const m of course.modules) {
      saveProgress(course.id, m.id, 75);
    }
    const cert = getCertificate(course.id);
    expect(cert).not.toBeNull();
    expect(cert!.courseTitle).toBe(course.title);
    expect(cert!.score).toBe(75);
    expect(Date.parse(cert!.date)).not.toBeNaN();
  });

  it("averages quiz scores across modules", () => {
    const course = COURSES[0];
    course.modules.forEach((m, i) => saveProgress(course.id, m.id, i * 10));
    const cert = getCertificate(course.id);
    expect(cert).not.toBeNull();
    const expected = Math.round(
      (course.modules.reduce((sum, _, i) => sum + i * 10, 0) /
        course.modules.length),
    );
    expect(cert!.score).toBe(expected);
  });

  it("defaults to 100 when no quiz scores are stored", () => {
    const course = COURSES[0];
    for (const m of course.modules) saveProgress(course.id, m.id);
    const cert = getCertificate(course.id);
    expect(cert).not.toBeNull();
    expect(cert!.score).toBe(100);
  });

  it("returns null for an unknown course id", () => {
    expect(getCertificate("does-not-exist")).toBeNull();
  });
});
