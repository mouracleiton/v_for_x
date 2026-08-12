"use client";

import FusionRedirect from "@/components/shared/FusionRedirect";

/**
 * FUSION: this route merged into /the-pulse/ (see lib/station-map.ts fusedInto).
 * Original page preserved as page.tsx.orig for porting unique features.
 */
export default function Page() {
  return <FusionRedirect to="/the-pulse/" />;
}
