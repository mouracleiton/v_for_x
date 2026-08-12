/**
 * Global test setup.
 *
 * This jsdom build does not provide `localStorage`, and several older
 * test suites reference the bare global. Rather than stubbing it in
 * every file, we provide a single shared in-memory mock here. Files
 * that stub their own mock via `vi.stubGlobal` still take precedence.
 *
 * We also ensure `crypto.randomUUID` exists for Node runtimes that
 * predate it or run without a secure context.
 */

// ── crypto.randomUUID polyfill ──────────────────────────────────
if (!globalThis.crypto?.randomUUID) {
  (globalThis.crypto as any) = {
    ...(globalThis.crypto || {}),
    randomUUID: () =>
      "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }),
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
      return arr;
    },
    subtle: (globalThis.crypto as any)?.subtle,
  };
}

// ── localStorage polyfill (shared in-memory mock) ───────────────
// Node 22+ ships a native `localStorage` global that is non-functional
// without --localstorage-file and emits a runtime warning. Several suites
// also try to replace it via `Object.defineProperty(global, ...)` without
// `configurable`, which the native accessor ignores. So we UNCONDITIONALLY
// install a working in-memory mock with configurable+writable flags so any
// per-suite re-stub still wins. This single change clears the pre-existing
// ops-journal + capacitor-guardian localStorage failures.
{
  const memStore: Record<string, string> = {};
  const localStorageMock = {
    getItem: (key: string) => (key in memStore ? memStore[key]! : null),
    setItem: (key: string, value: string) => {
      memStore[key] = String(value);
    },
    removeItem: (key: string) => {
      delete memStore[key];
    },
    clear: () => {
      for (const k of Object.keys(memStore)) delete memStore[k];
    },
    key: (index: number) => Object.keys(memStore)[index] ?? null,
    get length() {
      return Object.keys(memStore).length;
    },
  };
  try {
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      configurable: true,
      writable: true,
    });
  } catch {
    // If the property cannot be redefined, assign directly where possible.
    (globalThis as { localStorage?: unknown }).localStorage = localStorageMock;
  }
}

// ── matchMedia / IntersectionObserver shims for component tests ─
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

if (typeof window !== "undefined" && !window.IntersectionObserver) {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as any;
}
