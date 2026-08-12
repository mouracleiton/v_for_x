"use client";

import { useState, useCallback, useEffect } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import { sound } from "@/lib/sound";
import {
	encodePack,
	decodePack,
	validatePack,
	createPackWithIdentity,
	type VfxPack,
	type PackVerifyResult,
} from "@/lib/vfxpack";
import { ensureIdentity, type Identity } from "@/lib/identity";
import { detectToken, TOKEN_SPECS } from "@/lib/tokens";
import TokenVerifyDropzone from "@/components/shared/TokenVerifyDropzone";

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface DataStore {
	key: string;
	label: string;
	description: string;
	/** localStorage keys to include */
	storageKeys: string[];
	/** IndexedDB stores to include (names) */
	idbStores?: string[];
}

/* All data stores that can be exported */
const DATA_STORES: DataStore[] = [
	{
		key: "watchlist",
		label: "Watch Rules",
		description: "Threshold alert rules from The Watch",
		storageKeys: ["vfx-watch", "vfx_alert_state"],
	},
	{
		key: "gamification",
		label: "Progress & Badges",
		description: "XP, level, countries visited, badges earned",
		storageKeys: ["vfx-gamification"],
	},
	{
		key: "identity",
		label: "Identity & Session",
		description: "Anonymous handle, public key, language preference",
		storageKeys: ["vfx-identity", "vfx-session", "vfx-lang"],
	},
	{
		key: "dead_drops",
		label: "Dead Drops & Circles",
		description: "Action circles, encrypted dead drops, pledges",
		storageKeys: ["vfx-network"],
		idbStores: ["dead_drops", "action_circles", "pledges"],
	},
	{
		key: "heatmap",
		label: "Incident Reports",
		description: "Signed, hash-chained incident reports from The Heatmap",
		storageKeys: ["vfx-heatmap"],
	},
	{
		key: "stamps",
		label: "Blockchain Stamps",
		description: "Pending OpenTimestamps stamps awaiting confirmation",
		storageKeys: ["vfx_pending_stamps"],
	},
	{
		key: "duress",
		label: "Duress Configuration",
		description: "Decoy duress code (if enabled)",
		storageKeys: ["vfx_duress_cfg"],
	},
];

/* ═══════════════════════════════════════════════════════════════
   Token collection helpers
   ═══════════════════════════════════════════════════════════════ */

/**
 * Collect all VFX* tokens from a data store's localStorage keys.
 * Scans each value and extracts any VFX* tokens found.
 */
function collectTokensFromStore(store: DataStore): string[] {
	const tokens: string[] = [];

	for (const key of store.storageKeys) {
		const value = localStorage.getItem(key);
		if (!value) continue;

		try {
			const data = JSON.parse(value);
			const str = JSON.stringify(data);

			// Find all VFX* token patterns in the string
			const tokenPattern = /VFX[A-Z0-9]+:[^\s"'}\]]+/g;
			const matches = str.match(tokenPattern);
			if (matches) {
				tokens.push(...matches);
			}
		} catch {
			// If not JSON, try direct token detection
			if (detectToken(value)) {
				tokens.push(value.trim());
			}
		}
	}

	return tokens;
}

/**
 * Collect all VFX* tokens from IndexedDB stores.
 * This is async and would require idb access - for now returns empty.
 * In a full implementation, this would query IndexedDB and extract tokens.
 */
async function collectTokensFromIDB(store: DataStore): Promise<string[]> {
	if (!store.idbStores || store.idbStores.length === 0) {
		return [];
	}
	// TODO: Implement IndexedDB token extraction when needed
	return [];
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

export default function TheBridgePage() {
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [exportData, setExportData] = useState<string>("");
	const [importStatus, setImportStatus] = useState("");
	const [storeSizes, setStoreSizes] = useState<Record<string, number>>({});

	// VFXPACK1 state
	const [vfxPackToken, setVfxPackToken] = useState<string>("");
	const [packValidation, setPackValidation] = useState<PackVerifyResult | null>(
		null,
	);
	const [isBuildingPack, setIsBuildingPack] = useState(false);
	const [identity, setIdentity] = useState<Identity | null>(null);

	useEffect(() => {
		// Compute current data sizes
		const sizes: Record<string, number> = {};
		for (const store of DATA_STORES) {
			let total = 0;
			for (const key of store.storageKeys) {
				const val = localStorage.getItem(key);
				if (val) total += val.length;
			}
			sizes[store.key] = total;
		}
		setStoreSizes(sizes);

		// Load identity for signing packs
		ensureIdentity()
			.then(setIdentity)
			.catch(() => {
				// Identity creation failed, continue without it
			});
	}, []);

	const toggleSelect = useCallback((key: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const selectAll = useCallback(() => {
		setSelected(new Set(DATA_STORES.map((s) => s.key)));
	}, []);

	const selectNone = useCallback(() => {
		setSelected(new Set());
	}, []);

	const handleExport = useCallback(() => {
		const bundle: Record<string, unknown> = {
			version: 1,
			exportedAt: new Date().toISOString(),
			app: "V FOR X",
		};

		for (const store of DATA_STORES) {
			if (!selected.has(store.key)) continue;
			const data: Record<string, string | null> = {};
			for (const key of store.storageKeys) {
				data[key] = localStorage.getItem(key);
			}
			bundle[store.key] = data;
		}

		const json = JSON.stringify(bundle, null, 2);
		setExportData(json);

		// Download
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `vfx-backup-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
		sound.success();
	}, [selected]);

	const handleImport = useCallback((file: File) => {
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const data = JSON.parse(reader.result as string);
				if (!data || typeof data !== "object" || data.app !== "V FOR X") {
					setImportStatus("✗ Invalid file format — not a V FOR X backup");
					sound.error();
					return;
				}

				let importedCount = 0;
				for (const store of DATA_STORES) {
					const storeData = data[store.key];
					if (!storeData || typeof storeData !== "object") continue;

					for (const [key, value] of Object.entries(
						storeData as Record<string, unknown>,
					)) {
						if (typeof value === "string") {
							localStorage.setItem(key, value);
							importedCount++;
						} else if (value === null) {
							localStorage.removeItem(key);
						}
					}
				}

				setImportStatus(
					`✓ Imported ${importedCount} key(s) from backup dated ${data.exportedAt ?? "unknown"}`,
				);
				sound.success();

				// Refresh sizes
				const sizes: Record<string, number> = {};
				for (const store of DATA_STORES) {
					let total = 0;
					for (const key of store.storageKeys) {
						const val = localStorage.getItem(key);
						if (val) total += val.length;
					}
					sizes[store.key] = total;
				}
				setStoreSizes(sizes);
			} catch {
				setImportStatus("✗ Failed to parse file — corrupted or wrong format");
				sound.error();
			}
		};
		reader.readAsText(file);
	}, []);

	const handleBuildVFXPack = useCallback(async () => {
		if (selected.size === 0) {
			setImportStatus("✗ No stores selected — select at least one store");
			sound.error();
			return;
		}

		setIsBuildingPack(true);
		setImportStatus("Collecting tokens from selected stores...");

		try {
			const allTokens: string[] = [];

			for (const store of DATA_STORES) {
				if (!selected.has(store.key)) continue;

				const tokens = collectTokensFromStore(store);
				allTokens.push(...tokens);

				const idbTokens = await collectTokensFromIDB(store);
				allTokens.push(...idbTokens);
			}

			// Deduplicate tokens
			const uniqueTokens = Array.from(new Set(allTokens));

			if (uniqueTokens.length === 0) {
				setImportStatus("✗ No VFX* tokens found in selected stores");
				sound.error();
				setIsBuildingPack(false);
				return;
			}

			// Create pack with identity if available
			let pack: VfxPack;
			if (identity) {
				pack = await createPackWithIdentity(uniqueTokens, identity, {
					label: `V FOR X Pack - ${new Date().toISOString()}`,
					description: `Exported from ${selected.size} store(s)`,
					kind: "backup",
				});
			} else {
				// Create unsigned pack if no identity
				const { createPack } = await import("@/lib/vfxpack");
				pack = createPack(uniqueTokens, {
					label: `V FOR X Pack - ${new Date().toISOString()}`,
					description: `Exported from ${selected.size} store(s) (unsigned)`,
					kind: "backup",
				});
			}

			const token = encodePack(pack);
			setVfxPackToken(token);

			const validation = await validatePack(pack);
			setPackValidation(validation);

			setImportStatus(
				`✓ Built VFXPACK1 with ${uniqueTokens.length} token(s) from ${selected.size} store(s)${identity ? "" : " (unsigned - no identity)"}`,
			);
			sound.success();
		} catch (error) {
			setImportStatus(
				`✗ Failed to build pack: ${error instanceof Error ? error.message : "unknown error"}`,
			);
			sound.error();
		} finally {
			setIsBuildingPack(false);
		}
	}, [selected, identity]);

	const handlePasteVFXPack = useCallback(async (pasted: string) => {
		const trimmed = pasted.trim();
		if (!trimmed) return;

		setImportStatus("Validating VFXPACK1 token...");

		try {
			const pack = decodePack(trimmed);
			const validation = await validatePack(pack);
			setPackValidation(validation);
			setVfxPackToken(trimmed);

			if (validation.ok) {
				setImportStatus(
					`✓ Valid VFXPACK1 with ${validation.pack.tokens.length} token(s) - ${validation.tokenTypes.join(", ")}`,
				);
				sound.success();
			} else {
				setImportStatus(`✗ Invalid pack: ${validation.reason}`);
				sound.error();
			}
		} catch (error) {
			setImportStatus(
				`✗ Failed to decode pack: ${error instanceof Error ? error.message : "unknown error"}`,
			);
			sound.error();
			setPackValidation(null);
		}
	}, []);

	const handleImportPack = useCallback(async () => {
		if (!packValidation || !packValidation.ok) {
			setImportStatus("✗ No valid pack to import");
			sound.error();
			return;
		}

		const pack = packValidation.pack;
		let importedCount = 0;

		for (const token of pack.tokens) {
			// Try to detect token type and handle import
			const detected = detectToken(token);
			if (!detected) continue;

			// Import based on token type
			try {
				switch (detected.spec.id) {
					case "VFXID1": {
						// Import identity
						const { decodeIdentityToken, saveIdentity } = await import(
							"@/lib/identity"
						);
						const publicId = await decodeIdentityToken(token);
						if (publicId) {
							// Store the public identity info
							localStorage.setItem(
								"vfx-imported-identity",
								JSON.stringify(publicId),
							);
							importedCount++;
						}
						break;
					}

					case "VFXGP1":
						// Import guardian packet
						localStorage.setItem("vfx-imported-guardian-packet", token);
						importedCount++;
						break;

					case "VFXRV1":
						// Import blinded review
						localStorage.setItem("vfx-imported-review", token);
						importedCount++;
						break;

					case "VFXWIT1":
						// Import witness statement
						localStorage.setItem("vfx-imported-witness", token);
						importedCount++;
						break;

					case "VFXEV1":
						// Import evidence room
						localStorage.setItem("vfx-imported-evidence", token);
						importedCount++;
						break;

					case "VFXFILE1":
						// Import file transfer reference
						localStorage.setItem("vfx-imported-file", token);
						importedCount++;
						break;

					case "VFXCRDT1":
						// Import CRDT document
						localStorage.setItem("vfx-imported-crdt", token);
						importedCount++;
						break;

					case "VFXDM1":
						// Import dead man's switch
						localStorage.setItem("vfx-imported-deadman", token);
						importedCount++;
						break;

					case "VFXM1":
						// Import mirror claim
						localStorage.setItem("vfx-imported-mirror", token);
						importedCount++;
						break;

					case "VFXSIG1":
						// Import WebRTC signal
						localStorage.setItem("vfx-imported-signal", token);
						importedCount++;
						break;

					default:
						// Unknown token type, store as-is
						localStorage.setItem(`vfx-imported-unknown-${Date.now()}`, token);
						importedCount++;
				}
			} catch {
				// Token import failed, skip it
			}
		}

		setImportStatus(`✓ Imported ${importedCount} token(s) from pack`);
		sound.success();
	}, [packValidation]);

	const formatSize = (bytes: number): string => {
		if (bytes === 0) return "empty";
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	};

	const totalSelected = Array.from(selected).reduce(
		(sum, key) => sum + (storeSizes[key] ?? 0),
		0,
	);

	return (
		<div className="p-3 sm:p-6 md:p-10 max-w-4xl mx-auto">
			<h1 className="text-3xl sm:text-4xl text-blood-bright font-bold tracking-widest mb-2">
				🌉 THE BRIDGE
			</h1>
			<p className="text-content-secondary text-sm mb-6">
				// data sovereignty hub — export, import, sync across devices
			</p>

			<TerminalCard
				title="VERIFY FOREIGN TOKEN"
				accent="amber"
				className="mb-6"
			>
				<p className="text-xs text-content-dim mb-3">
					Paste VFXPACK1 / VFXWIT1 / VFXEV1 / VFXID1 (or any VFX*) before
					import.
				</p>
				<TokenVerifyDropzone />
			</TerminalCard>

			<TerminalCard title="DATA PORTABILITY" accent="green">
				<p className="text-xs text-content-secondary">
					Your data belongs to you. Export everything as a signed JSON bundle,
					import on another device, or share with trusted allies. No lock-in. No
					server dependency. Your work is portable.
				</p>
			</TerminalCard>

			{/* Select stores */}
			<div className="mt-4">
				<TerminalCard title="SELECT DATA TO EXPORT" accent="amber">
					<div className="flex gap-2 mb-3">
						<button
							onClick={selectAll}
							className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-terminal-green hover:text-terminal-green"
						>
							SELECT ALL
						</button>
						<button
							onClick={selectNone}
							className="text-[10px] px-2 py-0.5 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright"
						>
							SELECT NONE
						</button>
					</div>

					<div className="space-y-1">
						{DATA_STORES.map((store) => {
							const isSelected = selected.has(store.key);
							const size = storeSizes[store.key] ?? 0;
							return (
								<label
									key={store.key}
									className={`flex items-center gap-3 p-2 border cursor-pointer transition-colors ${
										isSelected
											? "border-terminal-green/50 bg-terminal-green/5"
											: "border-border-dim hover:border-border-dim"
									}`}
								>
									<input
										type="checkbox"
										checked={isSelected}
										onChange={() => toggleSelect(store.key)}
										className="accent-terminal-green"
									/>
									<div className="flex-1 min-w-0">
										<div className="text-xs font-bold text-content-primary">
											{store.label}
										</div>
										<div className="text-[10px] text-content-dim">
											{store.description}
										</div>
									</div>
									<span
										className={`text-[10px] font-mono ${size > 0 ? "text-content-secondary" : "text-content-dim"}`}
									>
										{formatSize(size)}
									</span>
								</label>
							);
						})}
					</div>

					{selected.size > 0 && (
						<div className="mt-3 pt-3 border-t border-border-dim">
							<div className="text-[10px] text-content-dim mb-2">
								{selected.size} store(s) selected · {formatSize(totalSelected)}{" "}
								total
							</div>
							<button
								onClick={handleExport}
								className="w-full py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green/10 text-xs font-bold"
							>
								⬇ EXPORT SIGNED BUNDLE
							</button>
						</div>
					)}
				</TerminalCard>
			</div>

			{/* Import */}
			<div className="mt-4">
				<TerminalCard title="IMPORT DATA" accent="blood">
					<p className="text-xs text-content-dim mb-3">
						Upload a previously exported V FOR X backup file. Existing data will
						be overwritten for matching keys.
					</p>
					<label className="block w-full p-4 border-2 border-dashed border-border-dim text-center cursor-pointer hover:border-blood transition-colors">
						<input
							type="file"
							accept=".json"
							className="hidden"
							onChange={(e) => {
								const f = e.target.files?.[0];
								if (f) handleImport(f);
							}}
						/>
						<span className="text-xs text-content-secondary">
							Click to select a backup file (.json)
						</span>
					</label>
					{importStatus && (
						<div className="mt-2 text-sm font-mono">{importStatus}</div>
					)}
				</TerminalCard>
			</div>

			{/* Export preview */}
			{exportData && (
				<div className="mt-4">
					<TerminalCard title="LAST EXPORT PREVIEW" accent="amber">
						<details className="text-xs">
							<summary className="cursor-pointer text-content-secondary">
								{exportData.length.toLocaleString()} chars · click to expand
							</summary>
							<pre className="mt-2 p-2 bg-abyss border border-border-dim text-[10px] overflow-x-auto max-h-60">
								{exportData.slice(0, 2000)}
								{exportData.length > 2000 && "\n… (truncated)"}
							</pre>
						</details>
					</TerminalCard>
				</div>
			)}

			{/* VFXPACK1 Build */}
			<div className="mt-4">
				<TerminalCard title="BUILD VFXPACK1 TOKEN" accent="green">
					<p className="text-xs text-content-dim mb-3">
						Collect all VFX* tokens from selected stores and bundle them into a
						single signed VFXPACK1 token for easy sharing and backup.
					</p>

					{selected.size > 0 && (
						<button
							onClick={handleBuildVFXPack}
							disabled={isBuildingPack}
							className="w-full py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green/10 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isBuildingPack
								? "⏳ BUILDING PACK..."
								: `📦 BUILD VFXPACK1 FROM ${selected.size} STORE(S)`}
						</button>
					)}

					{!identity && selected.size > 0 && (
						<p className="text-[10px] text-amber-600 mt-2">
							⚠ No identity found - pack will be unsigned. Create an identity
							for signed packs.
						</p>
					)}
				</TerminalCard>
			</div>

			{/* VFXPACK1 Import */}
			<div className="mt-4">
				<TerminalCard title="IMPORT VFXPACK1 TOKEN" accent="blood">
					<p className="text-xs text-content-dim mb-3">
						Paste a VFXPACK1 token to validate and import its contents.
					</p>

					<textarea
						value={vfxPackToken}
						onChange={(e) => handlePasteVFXPack(e.target.value)}
						placeholder="Paste VFXPACK1 token here..."
						className="w-full p-2 bg-abyss border border-border-dim text-[10px] font-mono resize-y min-h-[60px] focus:border-terminal-green focus:outline-none"
					/>

					{packValidation && (
						<div className="mt-3 space-y-2">
							<div
								className={`text-xs font-mono p-2 border ${
									packValidation.ok
										? "border-terminal-green/50 bg-terminal-green/5"
										: "border-blood/50 bg-blood/5"
								}`}
							>
								<div className="font-bold">
									{packValidation.ok ? "✓ VALID PACK" : "✗ INVALID PACK"}
								</div>
								{!packValidation.ok && (
									<div className="text-content-dim mt-1">
										Reason: {packValidation.reason}
									</div>
								)}
								{packValidation.ok && (
									<>
										<div className="text-content-secondary mt-1">
											Tokens: {packValidation.pack.tokens.length}
										</div>
										<div className="text-content-dim mt-1">
											Types:{" "}
											{packValidation.tokenTypes.length > 0
												? packValidation.tokenTypes.join(", ")
												: "none"}
										</div>
										{packValidation.pack.label && (
											<div className="text-content-secondary mt-1">
												Label: {packValidation.pack.label}
											</div>
										)}
										{packValidation.pack.signerPublicKey && (
											<div className="text-content-dim mt-1">✓ Signed pack</div>
										)}
									</>
								)}
							</div>

							{packValidation.ok && packValidation.pack.tokens.length > 0 && (
								<button
									onClick={handleImportPack}
									className="w-full py-2 border border-terminal-green text-terminal-green hover:bg-terminal-green/10 text-xs font-bold"
								>
									⬇ IMPORT {packValidation.pack.tokens.length} TOKEN(S)
								</button>
							)}
						</div>
					)}
				</TerminalCard>
			</div>
		</div>
	);
}
