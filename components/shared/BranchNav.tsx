"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/stores/useStore";
import { branchLinks } from "@/lib/crosslinks";
import { sound } from "@/lib/sound";
import SoundToggle from "@/components/ui/SoundToggle";

export default function BranchNav() {
  const pathname = usePathname();
  const { navOpen, setNavOpen } = useStore();

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden md:flex flex-col gap-0 border-r border-border-dim bg-abyss h-screen sticky top-0 w-56 shrink-0">
        <Link
          href="/"
          className="block p-4 border-b border-border-dim hover:bg-panel transition-colors"
          onClick={() => sound.nav()}
        >
          <pre className="text-blood text-[8px] leading-tight">{`
    .:::::::::::.
  ::'  ._-___-_'  ::
 ::   .'       '.  ::
::   /  ^     ^  \\  ::
::  |  (o)   (o)  | ::
::  |      o       | ::
 ::  \\    ___     /  ::
  :::'.\` - - - ' .:::
    ':::::::::::::::'
`}</pre>
          <div className="text-blood-bright text-xs font-bold tracking-widest mt-1">
            V FOR X
          </div>
        </Link>

        <div className="flex-1 overflow-y-auto">
          {branchLinks.map((b) => {
            const active = pathname === b.href;
            return (
              <Link
                key={b.href}
                href={b.href}
                className={`flex items-center gap-2 px-4 py-2 text-xs border-b border-border-dim transition-colors ${
                  active
                    ? "bg-panel text-blood-bright border-l-2 border-l-blood"
                    : "text-content-secondary hover:text-content-primary hover:bg-panel"
                }`}
                onClick={() => sound.nav()}
              >
                <span className="text-content-dim">[{b.code}]</span>
                <span>{b.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="p-3 border-t border-border-dim">
          <SoundToggle />
        </div>
      </nav>

      {/* Mobile nav */}
      <div className="md:hidden no-print">
        <div className="flex items-center justify-between p-3 border-b border-border-dim bg-abyss sticky top-0 z-50">
          <Link href="/" className="text-blood-bright text-sm font-bold">
            V FOR X
          </Link>
          <div className="flex items-center gap-2">
            <SoundToggle />
            <button
              onClick={() => setNavOpen(!navOpen)}
              className="text-xs px-2 py-1 border border-border-dim text-content-secondary"
              aria-label="Toggle navigation"
            >
              {navOpen ? "[ X ]" : "[ ≡ ]"}
            </button>
          </div>
        </div>
        {navOpen && (
          <nav className="bg-abyss border-b border-border-dim">
            {branchLinks.map((b) => {
              const active = pathname === b.href;
              return (
                <Link
                  key={b.href}
                  href={b.href}
                  className={`flex items-center gap-2 px-4 py-2 text-xs border-b border-border-dim ${
                    active
                      ? "bg-panel text-blood-bright"
                      : "text-content-secondary"
                  }`}
                  onClick={() => {
                    setNavOpen(false);
                    sound.nav();
                  }}
                >
                  <span className="text-content-dim">[{b.code}]</span>
                  <span>{b.label}</span>
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </>
  );
}
