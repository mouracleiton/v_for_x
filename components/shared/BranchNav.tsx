"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/stores/useStore";
import { branchLinks } from "@/lib/crosslinks";
import { sound } from "@/lib/sound";
import { LANGS, t, SECTION_DESC, getStoredLang } from "@/lib/i18n";
import { tc } from "@/lib/i18n-content";
import { isRouteVisible, isRoutePrimary } from "@/lib/personas";
import SoundToggle from "@/components/ui/SoundToggle";
import BuildAuthBadge from "@/components/shared/BuildAuthBadge";
import { useEffect, useRef, useState, useMemo } from "react";

export default function BranchNav() {
	const pathname = usePathname();
	const {
		navOpen,
		setNavOpen,
		lang,
		setLang,
		persona,
		fullNav,
		toggleFullNav,
	} = useStore();
	const drawerRef = useRef<HTMLDivElement>(null);
	const [langOpen, setLangOpen] = useState(false);
	const langRef = useRef<HTMLDivElement>(null);

	// Filter branchLinks based on persona and fullNav setting
	const filteredBranchLinks = useMemo(() => {
		return branchLinks.filter((link) => isRouteVisible(link.code));
	}, [persona, fullNav]);

	const guyFawkesAscii = [
		"    .:::::::::::.",
		"  ::'  ._-___-_'  ::",
		" ::   .'       '.  ::",
		"::   /  ^     ^  \\  ::",
		"::  |  (o)   (o)  | ::",
		"::  |      o       | ::",
		" ::  \\    ___     /  ::",
		"  :::'.  - - -  .:::",
		"    ':::::::::::::::'",
	].join("\n");

	// Close drawer on route change (pathname change)
	useEffect(() => {
		setNavOpen(false);
	}, [pathname, setNavOpen]);

	// Init language from localStorage
	useEffect(() => {
		const stored = getStoredLang();
		if (stored !== lang) setLang(stored);
	}, []); // eslint-disable-line react-hooks/exhaustive-deps

	// Close drawer on Escape
	useEffect(() => {
		if (!navOpen) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") setNavOpen(false);
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [navOpen, setNavOpen]);

	// Close language dropdown on outside click
	useEffect(() => {
		if (!langOpen) return;
		const handler = (e: MouseEvent) => {
			if (langRef.current && !langRef.current.contains(e.target as Node)) {
				setLangOpen(false);
			}
		};
		document.addEventListener("mousedown", handler);
		return () => document.removeEventListener("mousedown", handler);
	}, [langOpen]);

	// Lock body scroll when drawer open
	useEffect(() => {
		if (navOpen) {
			document.body.style.overflow = "hidden";
		} else {
			document.body.style.overflow = "";
		}
		return () => {
			document.body.style.overflow = "";
		};
	}, [navOpen]);

	return (
		<>
			{/* Desktop nav */}
			<nav className="hidden md:flex flex-col gap-0 border-r border-border-dim bg-abyss h-screen sticky top-0 w-56 shrink-0">
				<Link
					href="/"
					className="block p-4 border-b border-border-dim hover:bg-panel transition-colors"
					onClick={() => sound.nav()}
				>
					<pre className="text-blood text-[8px] leading-tight">
						{guyFawkesAscii}
					</pre>
					<div className="text-blood-bright text-xs font-bold tracking-widest mt-1 flex items-center gap-1">
						🦀 V FOR X
					</div>
				</Link>

				<div className="flex-1 overflow-y-auto">
					{filteredBranchLinks.map((b) => {
						const active = pathname === b.href;
						const isPrimary = isRoutePrimary(b.code);
						return (
							<Link
								key={b.href}
								href={b.href}
								className={`flex items-center gap-2 px-4 py-2 text-xs border-b border-border-dim transition-colors ${
									active
										? "bg-panel text-blood-bright border-l-2 border-l-blood"
										: isPrimary && persona
											? "text-content-primary font-medium bg-panel/50 hover:bg-panel"
											: "text-content-secondary hover:text-content-primary hover:bg-panel"
								}`}
								onClick={() => sound.nav()}
							>
								<span className="text-content-dim">[{b.code}]</span>
								<span>{t(lang, `nav.${b.href.replace(/\//g, "")}`)}</span>
							</Link>
						);
					})}
				</div>

				<div className="p-3 border-t border-border-dim">
					<div className="flex items-center justify-between gap-2 mb-2">
						<BuildAuthBadge />
					</div>
					<div className="flex items-center justify-between gap-2 mb-2">
						<SoundToggle />
						<div ref={langRef} className="relative">
							<button
								onClick={() => {
									setLangOpen(!langOpen);
									sound.select();
								}}
								className="text-[9px] px-1.5 py-1 border border-border-dim text-content-secondary hover:border-blood hover:text-blood-bright transition-colors flex items-center gap-1"
							>
								{LANGS.find((l) => l.id === lang)?.flag}{" "}
								{LANGS.find((l) => l.id === lang)?.label} ▾
							</button>
							{langOpen && (
								<div className="absolute bottom-full right-0 mb-1 bg-abyss border border-border-bright z-50 min-w-[100px]">
									{LANGS.map((l) => (
										<button
											key={l.id}
											onClick={() => {
												setLang(l.id);
												setLangOpen(false);
												sound.select();
											}}
											className={`flex items-center gap-2 w-full text-left px-2 py-1.5 text-[10px] hover:bg-panel transition-colors ${
												lang === l.id
													? "text-blood-bright bg-panel"
													: "text-content-secondary"
											}`}
										>
											{l.flag} {l.label}
										</button>
									))}
								</div>
							)}
						</div>
					</div>

					{/* Full Nav Toggle */}
					<button
						onClick={() => {
							toggleFullNav();
							sound.select();
						}}
						className={`text-[9px] px-2 py-1 border transition-colors w-full mb-2 ${
							fullNav
								? "border-blood text-blood-bright bg-panel"
								: "border-border-dim text-content-dim hover:border-blood hover:text-blood-bright"
						}`}
						title={
							fullNav
								? "Show all routes"
								: persona
									? "Show persona-filtered routes"
									: "No persona set"
						}
					>
						{fullNav ? "[✓] FULL NAV" : "[ ] FULL NAV"}
					</button>

					<button
						onClick={() => {
							const evt = new KeyboardEvent("keydown", {
								key: "k",
								metaKey: true,
								ctrlKey: navigator.platform.includes("Mac"),
							});
							window.dispatchEvent(evt);
						}}
						className="text-[9px] px-2 py-1 border border-border-dim text-content-dim hover:border-blood hover:text-blood-bright transition-colors w-full"
					>
						⌘K {t(lang, "ui.search").toUpperCase()}
					</button>
				</div>
			</nav>

			{/* Mobile nav — sticky top bar */}
			<div className="md:hidden no-print sticky top-0 z-50">
				<div
					className="flex items-center justify-between px-4 py-2 border-b border-border-dim bg-abyss"
					style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
				>
					<Link
						href="/"
						className="text-blood-bright text-sm font-bold tracking-widest"
						onClick={() => sound.nav()}
					>
						<span className="text-blood">🦀</span> FOR X
					</Link>
					<div className="flex items-center gap-2">
						<SoundToggle />
						<button
							onClick={() => setNavOpen(!navOpen)}
							className="flex flex-col gap-1 px-3 py-2 border border-border-dim text-content-secondary active:bg-panel transition-colors"
							aria-label={tc(lang, "nav.toggle_menu")}
							aria-expanded={navOpen}
						>
							<span className="block w-4 h-px bg-current" />
							<span className="block w-4 h-px bg-current" />
							<span className="block w-4 h-px bg-current" />
						</button>
					</div>
				</div>
			</div>

			{/* Mobile drawer overlay */}
			{navOpen && (
				<div
					className="md:hidden fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
					onClick={() => setNavOpen(false)}
				/>
			)}

			{/* Mobile drawer — slide-in from right */}
			<div
				ref={drawerRef}
				className={`md:hidden no-print fixed top-0 right-0 z-[61] w-[280px] max-w-[85vw] bg-abyss border-l border-blood-dim transition-transform duration-300 ${
					navOpen ? "translate-x-0" : "translate-x-full"
				}`}
				style={{
					height: "100dvh",
					paddingTop: "env(safe-area-inset-top)",
					paddingBottom: "env(safe-area-inset-bottom)",
				}}
			>
				{/* Drawer header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-border-dim">
					<span className="text-xs text-content-dim uppercase tracking-widest">
						// Navigate
					</span>
					<button
						onClick={() => setNavOpen(false)}
						className="px-3 py-1 text-xs text-content-secondary border border-border-dim active:bg-panel"
						aria-label={tc(lang, "nav.close_nav")}
					>
						[ ✕ CLOSE ]
					</button>
				</div>

				{/* Drawer links — large tap targets */}
				<div
					className="overflow-y-auto"
					style={{ maxHeight: "calc(100dvh - 140px)" }}
				>
					{filteredBranchLinks.map((b) => {
						const active = pathname === b.href;
						const isPrimary = isRoutePrimary(b.code);
						return (
							<Link
								key={b.href}
								href={b.href}
								className={`flex items-center gap-3 px-4 py-3 text-sm border-b border-border-dim transition-colors ${
									active
										? "bg-panel text-blood-bright border-l-2 border-l-blood"
										: isPrimary && persona
											? "text-content-primary font-medium bg-panel/50 active:bg-panel"
											: "text-content-secondary active:text-blood-bright active:bg-panel"
								}`}
								onClick={() => {
									setNavOpen(false);
									sound.nav();
								}}
							>
								<span className="text-content-dim text-xs">[{b.code}]</span>
								<span className="font-bold">{b.label}</span>
							</Link>
						);
					})}
				</div>

				{/* Drawer footer */}
				<div
					className="px-4 py-3 border-t border-border-dim"
					style={{
						paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
					}}
				>
					{/* Full Nav Toggle in mobile drawer */}
					<button
						onClick={() => {
							toggleFullNav();
							sound.select();
						}}
						className={`text-[10px] px-3 py-2 border transition-colors w-full mb-3 ${
							fullNav
								? "border-blood text-blood-bright bg-panel"
								: "border-border-dim text-content-dim hover:border-blood hover:text-blood-bright"
						}`}
						title={
							fullNav
								? "Show all routes"
								: persona
									? "Show persona-filtered routes"
									: "No persona set"
						}
					>
						{fullNav ? "[✓] FULL NAV" : "[ ] FULL NAV"}
					</button>

					{/* Language selector in mobile drawer */}
					<div className="flex items-center gap-1 flex-wrap mb-3 justify-center">
						{LANGS.map((l) => (
							<button
								key={l.id}
								onClick={() => {
									setLang(l.id);
									sound.select();
								}}
								className={`text-[10px] px-2 py-1 border transition-colors ${
									lang === l.id
										? "border-blood text-blood-bright"
										: "border-border-dim text-content-dim hover:border-blood"
								}`}
							>
								{l.flag} {l.label}
							</button>
						))}
					</div>
					<div className="flex justify-center mb-3">
						<BuildAuthBadge />
					</div>
					<Link
						href="/"
						className="block text-center text-xs text-content-dim"
						onClick={() => {
							setNavOpen(false);
							sound.nav();
						}}
					>
						◆ V FOR X — the platform that refuses to die
					</Link>
				</div>
			</div>
		</>
	);
}
