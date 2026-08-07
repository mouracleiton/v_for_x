/**
 * V FOR X — Cross-branch link generator
 * Generates contextual links between branches based on data context.
 */

export interface CrossLink {
  href: string;
  label: string;
  description: string;
}

export function countryToEquation(iso3: string): CrossLink {
  return {
    href: `/equation/?country=${iso3}`,
    label: "MODEL THE SOLUTION",
    description: "See the cost to fix this country's hunger crisis",
  };
}

export function countryToProtocol(iso3: string, crisisProfile: {
  isHotspot: boolean;
  conflictIntensity: number;
  famineRisk: number;
  connectivity: number;
}): CrossLink {
  return {
    href: `/protocol-x/?country=${iso3}`,
    label: "RELEVANT BLUEPRINTS",
    description: crisisProfile.conflictIntensity >= 3
      ? "Survival and resistance tactics for active conflict zones"
      : crisisProfile.famineRisk >= 3
        ? "Food security and emergency agriculture blueprints"
        : "Resilience and preparedness guides for this region",
  };
}

export function countryToRegistry(iso3: string): CrossLink {
  return {
    href: `/registry/?country=${iso3}`,
    label: "SEE RESPONSIBLE ACTORS",
    description: "Dossiers on governance and corruption in this country",
  };
}

export function countryToTrilha(iso3: string): CrossLink {
  return {
    href: `/the-trail/?need=${iso3}`,
    label: "ROUTE RESOURCES HERE",
    description: "Connect this region to aid and logistics networks",
  };
}

export function equationToTrilha(): CrossLink {
  return {
    href: "/the-trail/",
    label: "FUND THE SOLUTION",
    description: "Route resources based on the financing allocation",
  };
}

export function equationToProtocol(): CrossLink {
  return {
    href: "/protocol-x/",
    label: "IMPLEMENTATION GUIDES",
    description: "How to advocate for and execute each financing mechanism",
  };
}

export function equationToRegistry(): CrossLink {
  return {
    href: "/registry/",
    label: "DOCUMENT FOR TRIBUNAL",
    description: "War crimes documentation → ICJ accountability flow",
  };
}

export const branchLinks = [
  { href: "/", label: "BRIEFING", code: "00" },
  { href: "/sorrow-map/", label: "SORROW MAP", code: "01" },
  { href: "/equation/", label: "THE EQUATION", code: "02" },
  { href: "/protocol-x/", label: "PROTOCOL X", code: "03" },
  { href: "/registry/", label: "REGISTRY", code: "04" },
  { href: "/the-web/", label: "THE WEB", code: "05" },
  { href: "/the-trail/", label: "THE TRAIL", code: "06" },
  { href: "/fortress/", label: "FORTRESS", code: "07" },
  { href: "/the-mask/", label: "MASK", code: "08" },
] as const;
