"use client";

import { useEffect, useState } from "react";
import StatusPill from "@/components/ui/StatusPill";
import {
	getCurrentBuildStatus,
	getBuildStatusBadge,
	formatBuildId,
	type BuildVerifyResult,
} from "@/lib/build-attest";

/**
 * Verifies the served build attestation on mount and shows a StatusPill.
 * Fails soft to amber/UNKNOWN when fetch/verify fails.
 */
export default function BuildAuthBadge() {
	const [badge, setBadge] = useState<{
		text: string;
		color: "green" | "amber" | "blood";
	}>({ text: "…", color: "amber" });
	const [title, setTitle] = useState("Verifying build…");

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const result: BuildVerifyResult = await getCurrentBuildStatus();
				if (cancelled) return;
				const next = getBuildStatusBadge(result);
				setBadge(next);
				const id = result.attestation?.buildId
					? formatBuildId(result.attestation.buildId)
					: result.status.ok === "unknown"
						? result.status.reason
						: "no attestation";
				setTitle(`Build: ${id}`);
			} catch {
				if (cancelled) return;
				setBadge({ text: "UNKNOWN", color: "amber" });
				setTitle("Build verification failed");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<span title={title} className="inline-flex items-center">
			<StatusPill color={badge.color}>{badge.text}</StatusPill>
		</span>
	);
}
