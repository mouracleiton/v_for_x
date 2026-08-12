"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TerminalCard from "@/components/ui/TerminalCard";
import StatusPill from "@/components/ui/StatusPill";
import { CRDTDoc, CRDT_PREFIX, CRDT_SIGNED_PREFIX } from "@/lib/crdt";
import {
	ensureIdentity,
	type Identity,
	exportPublicCard,
	computeSafetyNumber,
} from "@/lib/identity";
import { getDocsRoom, subscribeDocsRoom } from "@/lib/docs-room";
import { sound } from "@/lib/sound";
import { useStore } from "@/stores/useStore";
import SafetyNumberGate from "@/components/shared/SafetyNumberGate";

const ACTOR_KEY = "vfx-docs-actor";
const DOCS_KEY = "vfx-docs-index";
const DOC_PREFIX = "vfx-docs-";

interface DocMeta {
	id: string;
	title: string;
	updatedAt: number;
}

function readJSON<T>(key: string, fallback: T): T {
	if (typeof window === "undefined") return fallback;
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

function writeJSON(key: string, value: unknown) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* ignore quota / privacy-mode failures */
	}
}

function readText(key: string, fallback: string): string {
	if (typeof window === "undefined") return fallback;
	try {
		return localStorage.getItem(key) ?? fallback;
	} catch {
		return fallback;
	}
}

function writeText(key: string, value: string) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(key, value);
	} catch {
		/* ignore */
	}
}

export default function TheDocsPage() {
	useStore(); // lang/session side-effects via store subscription
	const [fullIdentity, setFullIdentity] = useState<Identity | null>(null);
	const [actor, setActor] = useState("");
	const [docs, setDocs] = useState<DocMeta[]>([]);
	const [activeId, setActiveId] = useState<string>("");
	const [title, setTitle] = useState("UNTITLED DOCUMENT");
	const [text, setText] = useState("");
	const [token, setToken] = useState<string>("");
	const [copied, setCopied] = useState(false);
	const [importInput, setImportInput] = useState("");
	const [log, setLog] = useState<string[]>([]);
	const [broadcasting, setBroadcasting] = useState(false);
	const [boundRoom, setBoundRoom] = useState<string | null>(null);
	const [verifiedIdentity, setVerifiedIdentity] = useState<{
		handle: string;
		fingerprint: string;
		publicKeyHex: string;
	} | null>(null);
	const [importError, setImportError] = useState("");
	const [publicCard, setPublicCard] = useState<{
		handle: string;
		fingerprint: string;
		publicKeyHex: string;
	} | null>(null);
	const [copiedCard, setCopiedCard] = useState(false);
	const [coauthorSafety, setCoauthorSafety] = useState<string>("");
	const docRef = useRef<CRDTDoc | null>(null);
	const busRef = useRef<BroadcastChannel | null>(null);
	const activeRef = useRef("");

	const appendLog = useCallback((line: string) => {
		setLog((prev) => [line, ...prev].slice(0, 8));
	}, []);

	// Soft-gate safety number when a co-author identity is verified via import
	useEffect(() => {
		let cancelled = false;
		(async () => {
			if (!fullIdentity || !verifiedIdentity) {
				setCoauthorSafety("");
				return;
			}
			try {
				const sn = await computeSafetyNumber(fullIdentity, {
					publicKeyHex: verifiedIdentity.publicKeyHex,
					handle: verifiedIdentity.handle,
					fingerprint: verifiedIdentity.fingerprint,
					createdAt: 0,
				});
				if (!cancelled) setCoauthorSafety(sn);
			} catch {
				if (!cancelled) setCoauthorSafety("");
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [fullIdentity, verifiedIdentity]);

	// Load full identity for signed operations
	useEffect(() => {
		let cancelled = false;
		(async () => {
			const id = await ensureIdentity();
			if (!cancelled) {
				setFullIdentity(id);
				// Export public card (fingerprint info)
				const card = exportPublicCard(id);
				setPublicCard({
					handle: card.handle,
					fingerprint: card.fingerprint,
					publicKeyHex: card.publicKeyHex,
				});
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Derive a stable actor id (from the VFXID1 identity handle when present).
	useEffect(() => {
		let cancelled = false;
		(async () => {
			let id = readText(ACTOR_KEY, "");
			if (!id) {
				// Use VFXID1 handle directly as the actor for cryptographic identity
				if (fullIdentity?.handle) {
					id = fullIdentity.handle;
				} else {
					// Fallback to random UUID if no identity (should not happen with ensureIdentity)
					id = crypto.randomUUID().slice(0, 8);
				}
				writeText(ACTOR_KEY, id);
			}
			if (!cancelled) setActor(id);
		})();
		return () => {
			cancelled = true;
		};
	}, [fullIdentity]);

	// Load the doc index + a persisted active doc.
	useEffect(() => {
		const meta = readJSON<DocMeta[]>(DOCS_KEY, []);
		setDocs(meta);
		if (meta.length === 0) {
			const d = new CRDTDoc("actor", "start");
			docRef.current = d;
			setText(d.toText());
			setActiveId("start");
			activeRef.current = "start";
			setToken("");
		} else {
			const first = meta[0];
			openDocById(first.id);
		}
	}, []);

	const persistDoc = useCallback((doc: CRDTDoc) => {
		writeText(DOC_PREFIX + doc.docId, doc.encode());
	}, []);

	const openDocById = useCallback(
		(id: string) => {
			const raw = readText(DOC_PREFIX + id, "");
			const doc =
				raw && raw.startsWith(CRDT_PREFIX)
					? CRDTDoc.decode(raw)
					: new CRDTDoc(actor || "actor", id);
			docRef.current = doc;
			activeRef.current = id;
			setActiveId(id);
			setText(doc.toText());
			const meta = readJSON<DocMeta[]>(DOCS_KEY, []);
			const found = meta.find((m) => m.id === id);
			setTitle(found?.title ?? "UNTITLED DOCUMENT");
			setToken("");
		},
		[actor],
	);

	const touchMeta = useCallback(
		(id: string, docTitle: string, save: boolean) => {
			const meta = readJSON<DocMeta[]>(DOCS_KEY, []);
			const existing = meta.find((m) => m.id === id);
			const next: DocMeta[] = existing
				? meta.map((m) =>
						m.id === id ? { ...m, title: docTitle, updatedAt: Date.now() } : m,
					)
				: [{ id, title: docTitle, updatedAt: Date.now() }, ...meta];
			writeJSON(DOCS_KEY, next);
			setDocs(next);
			if (save && docRef.current) persistDoc(docRef.current);
		},
		[persistDoc],
	);

	const handleEdit = useCallback(
		(value: string) => {
			const doc = docRef.current;
			if (!doc || value === text) return;
			const prev = text;
			setText(value);
			doc.applyEdit(prev, value);
			persistDoc(doc);
			touchMeta(doc.docId, doc.docId === "start" ? "START NOTE" : title, false);
		},
		[text, title, persistDoc, touchMeta],
	);

	const newDoc = useCallback(() => {
		const id = crypto.randomUUID().slice(0, 8);
		const doc = new CRDTDoc(actor || "actor", id);
		docRef.current = doc;
		activeRef.current = id;
		setActiveId(id);
		setTitle("UNTITLED DOCUMENT");
		setText("");
		setToken("");
		touchMeta(id, "UNTITLED DOCUMENT", true);
		persistDoc(doc);
		sound.nav();
		appendLog(`+ created document ${id}`);
	}, [actor, touchMeta, persistDoc, appendLog]);

	const exportToken = useCallback(async () => {
		const doc = docRef.current;
		if (!doc) return;
		const t = doc.encode();
		setToken(t);
		try {
			await navigator.clipboard.writeText(t);
			setCopied(true);
			sound.copy();
			setTimeout(() => setCopied(false), 1600);
		} catch {
			sound.select();
		}
		appendLog(`exported ${doc.getVersion()} ops`);
	}, [appendLog]);

	const exportSignedToken = useCallback(async () => {
		const doc = docRef.current;
		if (!doc || !fullIdentity) {
			sound.error();
			appendLog("! identity required for signed export");
			return;
		}
		try {
			const t = await doc.encodeSigned(fullIdentity);
			setToken(t);
			await navigator.clipboard.writeText(t);
			setCopied(true);
			sound.copy();
			setTimeout(() => setCopied(false), 1600);
			appendLog(`exported signed token (${doc.getVersion()} ops)`);
		} catch {
			sound.error();
			appendLog("! signed export failed");
		}
	}, [appendLog, fullIdentity]);

	const importToken = useCallback(async () => {
		const doc = docRef.current;
		if (!doc) return;
		const raw = importInput.trim();

		// Reset verification state
		setVerifiedIdentity(null);
		setImportError("");

		// Handle signed tokens
		if (raw.startsWith(CRDT_SIGNED_PREFIX)) {
			try {
				const result = await CRDTDoc.decodeSigned(raw);
				if (!result) {
					sound.error();
					setImportError("Invalid signature or malformed token");
					appendLog("! signed token verification failed");
					return;
				}

				// Verify it's for the same doc
				if (result.doc.docId !== doc.docId) {
					sound.error();
					setImportError(
						`Doc mismatch: token is for "${result.doc.docId}", current is "${doc.docId}"`,
					);
					appendLog(`! doc mismatch: "${result.doc.docId}" != "${doc.docId}"`);
					return;
				}

				// Apply the ops
				const added = doc.applyOps(result.doc.getOps());
				setText(doc.toText());
				persistDoc(doc);
				sound.success();

				// Show verification result
				setVerifiedIdentity({
					handle: result.identity.handle,
					fingerprint: result.identity.fingerprint,
					publicKeyHex: result.identity.publicKeyHex,
				});

				appendLog(
					`+ merged ${added} ops from ${result.identity.handle} (verified)`,
				);
				setImportInput("");
			} catch (err) {
				sound.error();
				setImportError(`Import failed: ${(err as Error).message}`);
				appendLog(`! import failed: ${(err as Error).message}`);
			}
			return;
		}

		// Handle unsigned tokens
		if (!raw.startsWith(CRDT_PREFIX)) {
			sound.error();
			setImportError(
				"Not a CRDT token (must start with VFXCRDT1: or VFXCRDT1S:)",
			);
			appendLog("! not a CRDT token");
			return;
		}
		try {
			const added = doc.mergeToken(raw);
			setText(doc.toText());
			persistDoc(doc);
			sound.success();
			appendLog(
				`+ merged ${added} ops (v${doc.getVersion()}) — WARNING: unsigned`,
			);
			setImportInput("");
		} catch (err) {
			sound.error();
			setImportError(`Import failed: ${(err as Error).message}`);
			appendLog(`! import failed: ${(err as Error).message}`);
		}
	}, [importInput, persistDoc, appendLog]);

	const broadcast = useCallback(() => {
		const doc = docRef.current;
		if (!doc || !busRef.current) return;
		busRef.current.postMessage({
			type: "vfx-docs",
			token: doc.encode(),
			docId: doc.docId,
		});
		sound.select();
		appendLog(`broadcast sent (${doc.docId})`);
		setBroadcasting(true);
		setTimeout(() => setBroadcasting(false), 1200);
	}, [appendLog]);

	// BroadcastChannel — merge docs broadcast by other tabs on this device.
	useEffect(() => {
		try {
			const bus = new BroadcastChannel("vfx-docs");
			busRef.current = bus;
			bus.onmessage = (ev: MessageEvent) => {
				const data = ev.data as {
					type?: string;
					token?: string;
					docId?: string;
				};
				if (data?.type !== "vfx-docs" || !data.token) return;
				const doc = docRef.current;
				if (!doc || data.docId !== doc.docId) return;
				try {
					const added = doc.mergeToken(data.token);
					if (added > 0) {
						setText(doc.toText());
						persistDoc(doc);
						sound.copy();
						appendLog(`+ merged ${added} ops from another tab`);
					}
				} catch {
					/* ignore malformed broadcasts */
				}
			};
		} catch {
			/* BroadcastChannel unavailable (some webviews) */
		}
		return () => {
			try {
				busRef.current?.close();
			} catch {
				/* ignore */
			}
		};
	}, [persistDoc, appendLog]);

	// Phase 12: reflect the Web ⇄ Docs room binding; Docs does not open its own peer connection.
	useEffect(() => {
		setBoundRoom(getDocsRoom());
		const unsub = subscribeDocsRoom((next) => setBoundRoom(next));
		return unsub;
	}, []);

	const deleteDoc = useCallback(() => {
		if (activeId === "start") {
			sound.error();
			appendLog("! cannot delete the starter note");
			return;
		}
		writeText(DOC_PREFIX + activeId, "");
		const meta = readJSON<DocMeta[]>(DOCS_KEY, []).filter(
			(m) => m.id !== activeId,
		);
		writeJSON(DOCS_KEY, meta);
		setDocs(meta);
		if (meta.length === 0) {
			const d = new CRDTDoc(actor || "actor", "start");
			docRef.current = d;
			activeRef.current = "start";
			setActiveId("start");
			setTitle("START NOTE");
			setText(d.toText());
			touchMeta("start", "START NOTE", true);
		} else {
			openDocById(meta[0].id);
		}
		sound.select();
		appendLog("! document deleted");
	}, [activeId, actor, touchMeta, openDocById, appendLog]);

	const updateTitle = useCallback(
		(value: string) => {
			setTitle(value);
			const doc = docRef.current;
			if (doc) {
				touchMeta(doc.docId, value, false);
				persistDoc(doc);
			}
		},
		[touchMeta, persistDoc],
	);

	return (
		<div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
			{coauthorSafety && fullIdentity && verifiedIdentity && (
				<SafetyNumberGate
					localKey={fullIdentity.fingerprint}
					peerKey={verifiedIdentity.fingerprint}
					safetyNumber={coauthorSafety}
					peerLabel={verifiedIdentity.handle}
				/>
			)}
			<header className="mb-2">
				<h1 className="text-xl font-bold tracking-widest text-content-primary glitch">
					THE DOCS <span className="text-blood">▮</span>
				</h1>
				<p className="text-sm text-content-dim mt-1">
					OFFLINE-FIRST COLLABORATIVE DOCUMENTS — RGA CRDT, ZERO SERVERS
				</p>
			</header>

			<div className="flex flex-wrap items-center gap-2 text-xs">
				<StatusPill color="green">ACTOR {actor || "…"}</StatusPill>
				<StatusPill color="dim">DOC {activeId || "…"}</StatusPill>
				<StatusPill color="dim">
					OPS {docRef.current?.getVersion() ?? 0}
				</StatusPill>
				<StatusPill color={broadcasting ? "green" : "dim"}>
					{broadcasting ? "BROADCASTING" : "LOCAL"}
				</StatusPill>
				{boundRoom && (
					<StatusPill color="amber">WEB ROOM {boundRoom}</StatusPill>
				)}
				{publicCard && (
					<StatusPill color="amber">SAFETY {publicCard.fingerprint}</StatusPill>
				)}
			</div>

			<div className="grid md:grid-cols-[220px_1fr] gap-4">
				<TerminalCard title="DOCUMENTS" accent="blood" className="self-start">
					<button
						onClick={newDoc}
						className="w-full border border-blood text-blood-bright px-2 py-1 text-xs uppercase tracking-wider hover:bg-blood hover:text-black transition-colors mb-3"
					>
						+ NEW DOC
					</button>
					<div className="space-y-1 max-h-72 overflow-y-auto">
						{docs.length === 0 && (
							<p className="text-content-dim text-xs">no documents yet</p>
						)}
						{docs.map((m) => (
							<button
								key={m.id}
								onClick={() => {
									openDocById(m.id);
									sound.select();
								}}
								className={`block w-full text-left text-xs px-2 py-1 border transition-colors ${
									m.id === activeId
										? "border-terminal-green text-terminal-green bg-[#001a00]"
										: "border-transparent text-content-secondary hover:border-border-dim hover:text-content-primary"
								}`}
							>
								<span className="block truncate">{m.title}</span>
								<span className="block text-[10px] text-content-dim truncate">
									{m.id} · {new Date(m.updatedAt).toLocaleString()}
								</span>
							</button>
						))}
					</div>
					{activeId !== "start" && (
						<button
							onClick={deleteDoc}
							className="mt-3 w-full border border-blood-dim text-blood-bright px-2 py-1 text-xs uppercase tracking-wider hover:bg-blood hover:text-black transition-colors"
						>
							DELETE DOC
						</button>
					)}
				</TerminalCard>

				<div className="space-y-4">
					<TerminalCard title="EDITOR" glow>
						<input
							value={title}
							onChange={(e) => updateTitle(e.target.value)}
							aria-label="Document title"
							className="w-full bg-void border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-terminal-green outline-none mb-3"
						/>
						<textarea
							value={text}
							onChange={(e) => handleEdit(e.target.value)}
							aria-label="Document body"
							className="w-full bg-void border border-border-dim px-3 py-2 text-sm text-content-primary focus:border-terminal-green outline-none resize-y min-h-[300px]"
							spellCheck={false}
						/>
						<p className="text-[11px] text-content-dim mt-2">
							OPS {docRef.current?.getVersion() ?? 0} · CHARS {text.length} ·
							CONFLICTS RESOLVED BY (LAMPORT, ACTOR) — NEWER WINS AT THE
							DIVERGENCE POINT
						</p>
					</TerminalCard>

					<TerminalCard title="SYNC" accent="amber">
						<div className="flex flex-wrap gap-2 mb-3">
							<button
								onClick={exportToken}
								className="border border-terminal-green text-terminal-green px-3 py-1 text-xs uppercase tracking-wider hover:bg-terminal-green hover:text-black transition-colors"
							>
								{copied ? "COPIED ✓" : "EXPORT TOKEN"}
							</button>
							<button
								onClick={exportSignedToken}
								disabled={!fullIdentity}
								className={`border px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
									fullIdentity
										? "border-command text-command-bright hover:bg-command hover:text-black"
										: "border-border-dim text-content-dim cursor-not-allowed opacity-50"
								}`}
							>
								EXPORT SIGNED
							</button>
							<button
								onClick={broadcast}
								className="border border-terminal-green text-terminal-green px-3 py-1 text-xs uppercase tracking-wider hover:bg-terminal-green hover:text-black transition-colors"
							>
								BROADCAST (THIS DEVICE)
							</button>
						</div>
						{token && (
							<pre className="text-[11px] text-content-dim break-all bg-panel p-2 border border-border-dim overflow-x-auto">
								{token.slice(0, 220)}
								{token.length > 220 ? "…" : ""}
							</pre>
						)}
						<div className="flex gap-2">
							<input
								value={importInput}
								onChange={(e) => setImportInput(e.target.value)}
								onKeyDown={(e) => e.key === "Enter" && importToken()}
								placeholder="paste VFXCRDT1: or VFXCRDT1S: token"
								aria-label="Import token"
								className="flex-1 bg-void border border-border-dim px-2 py-1 text-xs text-content-primary focus:border-command outline-none"
							/>
							<button
								onClick={importToken}
								className="border border-blood text-blood-bright px-3 py-1 text-xs uppercase tracking-wider hover:bg-blood hover:text-black transition-colors"
							>
								IMPORT
							</button>
						</div>
						{verifiedIdentity && (
							<div className="mt-2 text-xs">
								<p className="text-terminal-green">✓ VERIFIED SIGNATURE</p>
								<p className="text-content-dim">
									From: {verifiedIdentity.handle} (
									{verifiedIdentity.fingerprint})
								</p>
							</div>
						)}
						{importError && (
							<div className="mt-2 text-xs">
								<p className="text-blood">! {importError}</p>
							</div>
						)}
					</TerminalCard>

					<TerminalCard title="MERGE LOG" accent="green">
						<div className="space-y-1 text-xs">
							{log.length === 0 && <p className="text-content-dim">— idle —</p>}
							{log.map((line, i) => (
								<p key={i} className="text-content-secondary font-mono">
									{line}
								</p>
							))}
						</div>
					</TerminalCard>

					<TerminalCard title="YOUR SAFETY NUMBER" accent="green">
						<p className="text-xs text-content-secondary leading-relaxed mb-3">
							Your safety number (fingerprint) uniquely identifies you in the V
							FOR X network. Share this with peers to verify they're connecting
							to the right person. Compare it in person or through a trusted
							channel.
						</p>
						{publicCard ? (
							<div className="space-y-3">
								<div className="border-2 border-terminal-green bg-terminal-green/5 p-3 text-center">
									<div className="text-[10px] text-terminal-green uppercase tracking-widest mb-2">
										YOUR FINGERPRINT
									</div>
									<div className="text-lg md:text-xl text-terminal-green font-mono font-bold tracking-wider">
										{publicCard.fingerprint}
									</div>
									<div className="text-[10px] text-content-dim mt-2">
										Handle:{" "}
										<span className="text-content-secondary">
											{publicCard.handle}
										</span>
									</div>
								</div>
								<div className="grid grid-cols-2 gap-2 text-[10px]">
									<div>
										<div className="text-content-dim uppercase tracking-widest">
											PUBLIC KEY (HEX)
										</div>
										<div className="text-content-secondary font-mono break-all">
											{publicCard.publicKeyHex.slice(0, 32)}...
										</div>
									</div>
									<div>
										<div className="text-content-dim uppercase tracking-widest">
											CREATED
										</div>
										<div className="text-content-secondary">
											{new Date(
												fullIdentity?.createdAt || Date.now(),
											).toLocaleDateString()}
										</div>
									</div>
								</div>
								<button
									onClick={async () => {
										const cardText = `V FOR X IDENTITY\nHandle: ${publicCard.handle}\nFingerprint: ${publicCard.fingerprint}\nPublic Key: ${publicCard.publicKeyHex}`;
										try {
											await navigator.clipboard.writeText(cardText);
											setCopiedCard(true);
											sound.copy();
											setTimeout(() => setCopiedCard(false), 1600);
										} catch {
											sound.error();
										}
									}}
									className="w-full border border-terminal-green text-terminal-green px-3 py-2 text-xs uppercase tracking-wider hover:bg-terminal-green hover:text-black transition-colors"
								>
									{copiedCard ? "COPIED ✓" : "COPY SAFETY NUMBER"}
								</button>
							</div>
						) : (
							<p className="text-xs text-content-dim">
								Loading safety number...
							</p>
						)}
					</TerminalCard>

					<TerminalCard title="HOW THIS WORKS">
						<p className="text-xs text-content-secondary leading-relaxed">
							SYNC HAPPENS WHEN DOCUMENTS MEET. EXPORT A TOKEN, SEND IT VIA THE
							WEB, A DEAD DROP, OR A BROADCASTCHANNEL — THE OTHER SIDE IMPORTS
							AND THE DOCS CONVERGE. NO SERVER, NO ACCOUNTS, NO CLOUD.
						</p>
						<p className="text-xs text-content-secondary leading-relaxed mt-2">
							EVERY CHARACTER IS AN OPERATION IN A REPLICATED GROWABLE ARRAY.
							CONCURRENT EDITS TO THE SAME SPOT RESOLVE DETERMINISTICALLY —
							NEWER OP WINS, TOMBSTONES NEVER RESURRECT — SO ANY TWO COPIES THAT
							EXCHANGE OPS REACH THE SAME TEXT.
						</p>
					</TerminalCard>
				</div>
			</div>
		</div>
	);
}
