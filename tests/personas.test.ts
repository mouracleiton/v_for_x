import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  PERSONAS,
  getPersona,
  setPersona,
  clearPersona,
  getCurrentPersona,
  getFullNav,
  setFullNav,
  toggleFullNav,
  getRouteVisibility,
  isRouteVisible,
  isRoutePrimary,
  getAllRouteCodes,
  filterVisibleRoutes,
  sortRoutesByVisibility,
  recommendPersona,
  getAllPersonas,
  getPersonaById,
  getPersonaPrimaryCount,
  getPersonaVisibleCount,
  getPersonaThreatLevel,
  getThreatLevelDescription,
  type PersonaId,
  type PersonaQuestionnaire,
} from "../lib/personas";

describe("personas.ts", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
  });

  describe("PERSONAS constant", () => {
    it("should have exactly 5 personas", () => {
      expect(Object.keys(PERSONAS)).toHaveLength(5);
    });

    it("should have all required persona IDs", () => {
      const expectedIds: PersonaId[] = ["journalist", "aid_worker", "activist", "researcher", "civilian"];
      expectedIds.forEach((id) => {
        expect(PERSONAS[id]).toBeDefined();
      });
    });

    it("should have valid persona structure", () => {
      Object.values(PERSONAS).forEach((persona) => {
        expect(persona.id).toBeDefined();
        expect(persona.name).toBeDefined();
        expect(persona.description).toBeDefined();
        expect(persona.icon).toBeDefined();
        expect(persona.color).toBeDefined();
        expect(Array.isArray(persona.primaryRoutes)).toBe(true);
        expect(Array.isArray(persona.secondaryRoutes)).toBe(true);
        expect(Array.isArray(persona.hiddenRoutes)).toBe(true);
        expect(["low", "medium", "high", "extreme"]).toContain(persona.threatLevel);
      });
    });
  });

  describe("getPersona and setPersona", () => {
    it("should return null when no persona is set", () => {
      expect(getPersona()).toBeNull();
    });

    it("should set and retrieve persona correctly", () => {
      setPersona("journalist");
      expect(getPersona()).toBe("journalist");
    });

    it("should persist persona across calls", () => {
      setPersona("activist");
      expect(getPersona()).toBe("activist");
      expect(getPersona()).toBe("activist"); // Should still be there
    });

    it("should clear persona correctly", () => {
      setPersona("researcher");
      expect(getPersona()).toBe("researcher");
      clearPersona();
      expect(getPersona()).toBeNull();
    });

    it("should throw error for invalid persona ID", () => {
      expect(() => setPersona("invalid" as PersonaId)).toThrow("Invalid persona ID");
    });

    it("should clear invalid stored persona", () => {
      localStorage.setItem("vfx_persona", "invalid");
      expect(getPersona()).toBeNull();
      expect(localStorage.getItem("vfx_persona")).toBeNull();
    });
  });

  describe("getCurrentPersona", () => {
    it("should return null when no persona is set", () => {
      expect(getCurrentPersona()).toBeNull();
    });

    it("should return persona object when persona is set", () => {
      setPersona("aid_worker");
      const persona = getCurrentPersona();
      expect(persona).not.toBeNull();
      expect(persona!.id).toBe("aid_worker");
      expect(persona!.name).toBe("Aid Worker");
    });

    it("should return complete persona data", () => {
      setPersona("activist");
      const persona = getCurrentPersona();
      expect(persona).toMatchObject({
        id: "activist",
        name: "Activist",
        icon: "✊",
        threatLevel: "extreme",
      });
      expect(Array.isArray(persona!.primaryRoutes)).toBe(true);
      expect(Array.isArray(persona!.secondaryRoutes)).toBe(true);
      expect(Array.isArray(persona!.hiddenRoutes)).toBe(true);
    });
  });

  describe("getFullNav, setFullNav, toggleFullNav", () => {
    it("should return false by default", () => {
      expect(getFullNav()).toBe(false);
    });

    it("should set and retrieve full nav state", () => {
      setFullNav(true);
      expect(getFullNav()).toBe(true);
      setFullNav(false);
      expect(getFullNav()).toBe(false);
    });

    it("should toggle full nav correctly", () => {
      expect(toggleFullNav()).toBe(true); // false -> true
      expect(getFullNav()).toBe(true);
      expect(toggleFullNav()).toBe(false); // true -> false
      expect(getFullNav()).toBe(false);
    });

    it("should persist full nav state", () => {
      setFullNav(true);
      expect(getFullNav()).toBe(true);
      // Simulate new session
      expect(localStorage.getItem("vfx_full_nav")).toBe("true");
    });
  });

  describe("getRouteVisibility", () => {
    it("should return all routes as primary when full nav is enabled", () => {
      setFullNav(true);
      const visibility = getRouteVisibility();
      expect(visibility.primary).toEqual(getAllRouteCodes());
      expect(visibility.secondary).toEqual([]);
      expect(visibility.hidden).toEqual([]);
    });

    it("should return all routes as primary when no persona is set", () => {
      const visibility = getRouteVisibility();
      expect(visibility.primary).toEqual(getAllRouteCodes());
      expect(visibility.secondary).toEqual([]);
      expect(visibility.hidden).toEqual([]);
    });

    it("should return persona-specific visibility when persona is set", () => {
      setPersona("journalist");
      const visibility = getRouteVisibility();
      const persona = PERSONAS.journalist;

      expect(visibility.primary).toEqual(persona.primaryRoutes);
      expect(visibility.secondary).toEqual(persona.secondaryRoutes);
      expect(visibility.hidden).toEqual(persona.hiddenRoutes);
    });

    it("should honor hidden routes for activist persona", () => {
      setPersona("activist");
      const visibility = getRouteVisibility();
      expect(visibility.hidden).toContain("24"); // Ledger should be hidden
    });

    it("should honor hidden routes for civilian persona", () => {
      setPersona("civilian");
      const visibility = getRouteVisibility();
      expect(visibility.hidden).toContain("24"); // Ledger
      expect(visibility.hidden).toContain("54"); // Quorum
      expect(visibility.hidden).toContain("56"); // Onion
    });
  });

  describe("isRouteVisible and isRoutePrimary", () => {
    it("should return true for all routes when no persona is set", () => {
      expect(isRouteVisible("01")).toBe(true);
      expect(isRouteVisible("02")).toBe(true);
      expect(isRouteVisible("12")).toBe(true);
      // Unknown routes are not visible
      expect(isRouteVisible("99")).toBe(false); // Unknown route
    });

    it("should return true for primary routes", () => {
      setPersona("journalist");
      expect(isRouteVisible("01")).toBe(true); // Sorrow Map is primary for journalist
      expect(isRoutePrimary("01")).toBe(true);
    });

    it("should return true for secondary routes", () => {
      setPersona("journalist");
      expect(isRouteVisible("29")).toBe(true); // Oracle is secondary for journalist
      expect(isRoutePrimary("29")).toBe(false);
    });

    it("should return false for hidden routes", () => {
      setPersona("activist");
      expect(isRouteVisible("24")).toBe(false); // Ledger is hidden for activist
      expect(isRoutePrimary("24")).toBe(false);
    });

    it("should handle unknown route codes", () => {
      setPersona("journalist");
      expect(isRouteVisible("99")).toBe(false); // Unknown route
      expect(isRoutePrimary("99")).toBe(false);
    });
  });

  describe("getAllRouteCodes", () => {
    it("should return an array of route code strings", () => {
      const codes = getAllRouteCodes();
      expect(Array.isArray(codes)).toBe(true);
      expect(codes.length).toBeGreaterThan(0);
      codes.forEach((code) => {
        expect(typeof code).toBe("string");
      });
    });

    it("should contain expected route codes", () => {
      const codes = getAllRouteCodes();
      expect(codes).toContain("01"); // Sorrow Map
      expect(codes).toContain("02"); // Equation
      expect(codes).toContain("12"); // Act
      expect(codes).toContain("06"); // Trail
    });
  });

  describe("filterVisibleRoutes", () => {
    it("should return all routes when no persona is set", () => {
      const input = ["01", "02", "12", "24"];
      const filtered = filterVisibleRoutes(input);
      expect(filtered).toEqual(input);
    });

    it("should filter to visible routes for persona", () => {
      setPersona("activist");
      const input = ["01", "12", "24"]; // Sorrow Map, Act, Ledger
      const filtered = filterVisibleRoutes(input);
      expect(filtered).toContain("01"); // Visible
      expect(filtered).toContain("12"); // Visible
      expect(filtered).not.toContain("24"); // Hidden for activist
    });

    it("should handle empty input", () => {
      expect(filterVisibleRoutes([])).toEqual([]);
    });

    it("should handle all hidden routes", () => {
      setPersona("activist");
      const input = ["24"]; // Only hidden route
      const filtered = filterVisibleRoutes(input);
      expect(filtered).toEqual([]);
    });
  });

  describe("sortRoutesByVisibility", () => {
    it("should maintain order when no persona is set", () => {
      const input = ["12", "01", "02"];
      const sorted = sortRoutesByVisibility(input);
      expect(sorted).toEqual(input);
    });

    it("should sort primary routes before secondary", () => {
      setPersona("journalist");
      const input = ["29", "01", "08"]; // Oracle, Sorrow Map, Mask (01 is primary, 29/08 are secondary)
      const sorted = sortRoutesByVisibility(input);
      expect(sorted[0]).toBe("01"); // Primary route comes first
    });

    it("should maintain relative order within same tier", () => {
      setPersona("journalist");
      const input = ["29", "08", "50"]; // All secondary for journalist
      const sorted = sortRoutesByVisibility(input);
      expect(sorted).toEqual(["29", "08", "50"]); // Order maintained
    });

    it("should handle empty input", () => {
      expect(sortRoutesByVisibility([])).toEqual([]);
    });
  });

  describe("recommendPersona", () => {
    it("should recommend journalist for verify use", () => {
      const questionnaire: PersonaQuestionnaire = { primaryUse: "verify" };
      expect(recommendPersona(questionnaire)).toBe("journalist");
    });

    it("should recommend aid_worker for coordinate use", () => {
      const questionnaire: PersonaQuestionnaire = { primaryUse: "coordinate" };
      expect(recommendPersona(questionnaire)).toBe("aid_worker");
    });

    it("should recommend activist for act use with high risk", () => {
      const questionnaire: PersonaQuestionnaire = { primaryUse: "act", riskConcern: "high" };
      expect(recommendPersona(questionnaire)).toBe("activist");
    });

    it("should recommend civilian for act use with low risk", () => {
      const questionnaire: PersonaQuestionnaire = { primaryUse: "act", riskConcern: "low" };
      expect(recommendPersona(questionnaire)).toBe("civilian");
    });

    it("should recommend researcher for analyze use", () => {
      const questionnaire: PersonaQuestionnaire = { primaryUse: "analyze" };
      expect(recommendPersona(questionnaire)).toBe("researcher");
    });

    it("should recommend researcher for stay_informed with advanced technical level", () => {
      const questionnaire: PersonaQuestionnaire = {
        primaryUse: "stay_informed",
        technicalLevel: "advanced",
      };
      expect(recommendPersona(questionnaire)).toBe("researcher");
    });

    it("should recommend civilian for stay_informed with basic technical level", () => {
      const questionnaire: PersonaQuestionnaire = {
        primaryUse: "stay_informed",
        technicalLevel: "basic",
      };
      expect(recommendPersona(questionnaire)).toBe("civilian");
    });

    it("should return null for incomplete questionnaire", () => {
      const questionnaire: PersonaQuestionnaire = {};
      expect(recommendPersona(questionnaire)).toBeNull();
    });
  });

  describe("getAllPersonas", () => {
    it("should return all 5 personas", () => {
      const personas = getAllPersonas();
      expect(personas).toHaveLength(5);
      expect(personas).toEqual(Object.values(PERSONAS));
    });

    it("should return persona objects with all required fields", () => {
      const personas = getAllPersonas();
      personas.forEach((persona) => {
        expect(persona).toHaveProperty("id");
        expect(persona).toHaveProperty("name");
        expect(persona).toHaveProperty("description");
        expect(persona).toHaveProperty("icon");
        expect(persona).toHaveProperty("color");
        expect(persona).toHaveProperty("primaryRoutes");
        expect(persona).toHaveProperty("secondaryRoutes");
        expect(persona).toHaveProperty("hiddenRoutes");
        expect(persona).toHaveProperty("threatLevel");
      });
    });
  });

  describe("getPersonaById", () => {
    it("should return persona for valid ID", () => {
      expect(getPersonaById("journalist")).toEqual(PERSONAS.journalist);
      expect(getPersonaById("activist")).toEqual(PERSONAS.activist);
    });

    it("should return null for invalid ID", () => {
      expect(getPersonaById("invalid" as PersonaId)).toBeNull();
    });
  });

  describe("getPersonaPrimaryCount and getPersonaVisibleCount", () => {
    it("should return correct primary route count", () => {
      expect(getPersonaPrimaryCount("journalist")).toBe(PERSONAS.journalist.primaryRoutes.length);
      expect(getPersonaPrimaryCount("activist")).toBe(PERSONAS.activist.primaryRoutes.length);
    });

    it("should return correct visible route count", () => {
      const journalistVisible = PERSONAS.journalist.primaryRoutes.length + PERSONAS.journalist.secondaryRoutes.length;
      expect(getPersonaVisibleCount("journalist")).toBe(journalistVisible);
    });

    it("should return 0 for invalid persona", () => {
      expect(getPersonaPrimaryCount("invalid" as PersonaId)).toBe(0);
      expect(getPersonaVisibleCount("invalid" as PersonaId)).toBe(0);
    });
  });

  describe("getPersonaThreatLevel and getThreatLevelDescription", () => {
    it("should return correct threat level for each persona", () => {
      expect(getPersonaThreatLevel("journalist")).toBe("high");
      expect(getPersonaThreatLevel("aid_worker")).toBe("medium");
      expect(getPersonaThreatLevel("activist")).toBe("extreme");
      expect(getPersonaThreatLevel("researcher")).toBe("low");
      expect(getPersonaThreatLevel("civilian")).toBe("medium");
    });

    it("should return null for invalid persona", () => {
      expect(getPersonaThreatLevel("invalid" as PersonaId)).toBeNull();
    });

    it("should return description for all threat levels", () => {
      expect(getThreatLevelDescription("low")).toContain("Low risk");
      expect(getThreatLevelDescription("medium")).toContain("Medium risk");
      expect(getThreatLevelDescription("high")).toContain("High risk");
      expect(getThreatLevelDescription("extreme")).toContain("Extreme risk");
    });
  });

  describe("integration tests", () => {
    it("should handle complete persona workflow", () => {
      // Start with no persona
      expect(getPersona()).toBeNull();

      // Set persona
      setPersona("researcher");
      expect(getCurrentPersona()?.id).toBe("researcher");

      // Check route visibility
      expect(isRouteVisible("02")).toBe(true); // Equation is primary for researcher
      expect(isRoutePrimary("02")).toBe(true);
      expect(isRouteVisible("29")).toBe(true); // Oracle is primary for researcher
      expect(isRoutePrimary("29")).toBe(true);

      // Toggle full nav
      toggleFullNav();
      expect(getFullNav()).toBe(true);

      // Full nav overrides persona filtering
      expect(isRouteVisible("24")).toBe(true); // Now visible despite not being in researcher lists

      // Clear full nav
      setFullNav(false);
      expect(getFullNav()).toBe(false);

      // Clear persona
      clearPersona();
      expect(getPersona()).toBeNull();
    });

    it("should handle persona switching", () => {
      setPersona("journalist");
      expect(isRouteVisible("59")).toBe(true); // Forensics is primary for journalist

      setPersona("civilian");
      expect(isRouteVisible("59")).toBe(false); // Forensics not in civilian lists

      setPersona("activist");
      expect(isRouteVisible("24")).toBe(false); // Ledger is hidden for activist
    });

    it("should work with route filtering and sorting together", () => {
      setPersona("aid_worker");
      const allRoutes = ["01", "06", "12", "15", "24", "39", "42"];
      const visible = filterVisibleRoutes(allRoutes);
      const sorted = sortRoutesByVisibility(visible);

      // Primary routes (06, 15, 39, 42, 12) should come before secondary (01)
      const trailIndex = sorted.indexOf("06"); // Trail is primary
      const sorrowMapIndex = sorted.indexOf("01"); // Sorrow Map is secondary
      expect(trailIndex).toBeLessThan(sorrowMapIndex);
    });
  });
});
