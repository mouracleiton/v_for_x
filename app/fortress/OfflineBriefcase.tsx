"use client";

import { useEffect, useRef, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { sound } from "@/lib/sound";
import ShareSheet from "@/components/shared/ShareSheet";

interface BundleProgress {
	type: string;
	done?: number;
	total?: number;
	bytes?: number;
	urls?: number;
	stopped?: boolean;
}

function fmtMB(bytes: number): string {
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * OFFLINE BRIEFCASE — one-tap crawl of the whole static platform into the
 * service-worker cache, with progress reporting. Runs entirely locally.
 */
export default function OfflineBriefcase() {
	const [running, setRunning] = useState(false);
	const [stopped, setStopped] = useState(false);
	const [progress, setProgress] = useState({ done: 0, total: 0, bytes: 0 });
	const [status, setStatus] = useState<{
		urlsCached: number;
		bytes: number;
	} | null>(null);
	const [done, setDone] = useState(false);
	const [message, setMessage] = useState("");

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const data = (event.data || {}) as BundleProgress;
			if (!data || typeof data.type !== "string") return;
			if (data.type === "VFX_BUNDLE_PROGRESS") {
				setProgress({
					done: data.done ?? 0,
					total: data.total ?? 0,
					bytes: data.bytes ?? 0,
				});
				setRunning(true);
			} else if (data.type === "VFX_BUNDLE_DONE") {
				setProgress({
					done: data.urls ?? 0,
					total: data.urls ?? 0,
					bytes: data.bytes ?? 0,
				});
				setRunning(false);
				setDone(true);
				setStopped(false);
				sound.success();
				setMessage(`COMPLETE — ${data.urls} URLs · ${fmtMB(data.bytes ?? 0)}`);
			} else if (data.type === "VFX_BUNDLE_STOPPED") {
				setRunning(false);
				setStopped(true);
				setMessage("STOPPED BY OPERATOR");
			} else if (data.type === "VFX_BUNDLE_STATUS_RESP") {
				setStatus({ urlsCached: data.urls ?? 0, bytes: data.bytes ?? 0 });
			}
		};
		navigator.serviceWorker?.addEventListener("message", onMessage);
		return () =>
			navigator.serviceWorker?.removeEventListener("message", onMessage);
	}, []);

	const post = (payload: Record<string, unknown>) => {
		if (!navigator.serviceWorker?.controller) return false;
		navigator.serviceWorker.controller.postMessage(payload);
		return true;
	};

	const start = () => {
		if (!navigator.serviceWorker?.controller) {
			setMessage("RELOAD ONCE TO ACTIVATE THE SERVICE WORKER");
			sound.error();
			return;
		}
		setDone(false);
		setStopped(false);
		setRunning(true);
		setMessage("CRAWLING — PAGES ARE BEING CACHED LOCALLY");
		post({ type: "VFX_BUNDLE_START" });
		sound.select();
	};

	const stop = () => {
		post({ type: "VFX_BUNDLE_STOP" });
		sound.select();
	};

	const query = () => {
		if (!post({ type: "VFX_BUNDLE_STATUS" })) {
			setMessage("SERVICE WORKER NOT ACTIVE YET — RELOAD ONCE");
		}
		sound.select();
	};

	const percent =
		progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

	return (
		<>
			<div className="mb-4">
				<ShareSheet
					mode="inline"
					label="offline-briefcase"
					description="Fortress offline pack"
				/>
			</div>
			<TerminalCard
				title="OFFLINE BRIEFCASE"
				accent="green"
				glow
				className="mb-6"
			>
				<p className="text-xs text-content-secondary mb-3">
					Crawl the whole platform into this device&apos;s cache. Once complete,
					the site runs with zero connectivity — from a USB stick, through an
					outage, under blackout. All pages stay local: nothing leaves the
					device.
				</p>

				<div className="flex flex-wrap items-center gap-2 mb-3">
					<button
						onClick={start}
						disabled={running}
						className="px-3 py-1.5 text-xs border border-terminal-green text-terminal-green hover:bg-terminal-green hover:text-void disabled:opacity-30 disabled:cursor-not-allowed"
					>
						{running ? "CRAWLING…" : "CRAWL & CACHE"}
					</button>
					<button
						onClick={stop}
						disabled={!running}
						className="px-3 py-1.5 text-xs border border-blood text-blood-bright hover:bg-blood hover:text-void disabled:opacity-30 disabled:cursor-not-allowed"
					>
						STOP
					</button>
					<button
						onClick={query}
						className="px-3 py-1.5 text-xs border border-command text-command-bright hover:bg-command hover:text-void"
					>
						STATUS
					</button>
				</div>

				{running && (
					<div className="mb-3">
						<div className="h-1.5 bg-panel border border-border-dim">
							<div
								className="h-full bg-terminal-green"
								style={{ width: `${percent}%` }}
							/>
						</div>
						<div className="text-[10px] text-content-dim mt-1">
							{progress.done} / {progress.total} URLs · {fmtMB(progress.bytes)}
						</div>
					</div>
				)}

				{(done || stopped || message) && (
					<div className="text-[11px] mb-2 flex flex-wrap items-center gap-2">
						<StatusPill color={stopped ? "amber" : "green"}>
							{message}
						</StatusPill>
					</div>
				)}

				{status && (
					<div className="text-[10px] text-content-dim mb-3">
						CACHED: {status.urlsCached} URLs · {fmtMB(status.bytes)}
					</div>
				)}

				<p className="text-[10px] text-content-dim">
					▸ The crawl is best-effort: the core 200-country dataset and all page
					shells are included; very large media may be skipped. For a physical
					copy, download the build&apos;s{" "}
					<span className="text-terminal-green">out/</span> directory and serve
					it with <span className="text-terminal-green">npx serve</span>.
				</p>
			</TerminalCard>
		</>
	);
}
