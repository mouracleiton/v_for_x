# V FOR X — Mobile App (PWA → Native via Capacitor)

V FOR X ships as a static export, which means **every native build is a complete,
offline-capable node**. This guide wraps the web app in a native shell using
[Capacitor](https://capacitorjs.com/) so it can be distributed via Google Play,
F-Droid, and the App Store — with zero backend, zero telemetry, zero runtime
dependencies on a server.

> **Philosophy:** The app is the data. Bundle it once and it works forever,
> even with no internet connection. This is censorship resistance by design.

---

## 1. Install Capacitor

From the **repository root** (where `package.json` lives):

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init "V FOR X" "foundation.aaif.vforx" --web-dir=out
```

The config is already provided in [`capacitor.config.json`](./capacitor.config.json):

| Field | Value | Why |
|-------|-------|-----|
| `appId` | `foundation.aaif.vforx` | Reverse-DNS unique app identifier |
| `appName` | `V FOR X` | Display name |
| `webDir` | `out` | The Next.js static export output folder |
| `server.androidScheme` | `https` | Serve app from `https://` origin (enables secure APIs) |
| `android.allowMixedContent` | `false` | Block any non-HTTPS content (hardening) |

---

## 2. Build & copy the static export

```bash
# Produces ./out — the full static site (the "webDir")
npm run build

# Copy ./out into the native projects
npx cap sync
```

`cap sync` copies the web assets and updates native plugins. Run it after **every**
rebuild of the site.

---

## 3. Add native platforms

```bash
# Android (requires Android Studio + JDK 17+)
npx cap add android

# iOS (requires macOS + Xcode — not available on Linux/Windows)
npx cap add ios
```

This scaffolds `android/` and/or `ios/` directories. These are **not** committed
to the V FOR X repo by default — add them to your own fork for store publishing.

---

## 4. Configure splash screen & icons

Use the official splash-screen generator to produce all required densities:

```bash
npm install -D @capacitor/assets
# Place a 1024×1024 icon.png and 2732×2732 splash.png in ./assets/
npx capacitor-assets generate --android
npx capacitor-assets generate --ios
```

Recommended source art:
- **Icon:** the V FOR X terminal badge (navy `#060b14` background, crimson `#c42b3e` accent).
- **Splash:** solid `#060b14` with a centered monospace `V FOR X` wordmark in
  cyan-green `#22d3a6`.

---

## 5. Build & deploy

```bash
# Open the native IDE for final build / signing
npx cap open android   # → Android Studio → Build > Generate Signed Bundle
npx cap open ios       # → Xcode → Product > Archive

# Or build a release APK directly from CLI
cd android && ./gradlew assembleRelease
```

For a fully reproducible, CI-driven build (recommended for F-Droid), use a
headless Gradle build with a deterministic version code.

---

## App store listing metadata

### Title
`V FOR X — Open Data Against Hunger`

### Short description (80 chars)
`200 countries × 19 dimensions. The cost to end hunger, in your pocket.`

### Full description
```
V FOR X is an open-data platform that puts the numbers behind the world's
crises in your hands — and works completely offline.

EXPLORE 200 COUNTRIES
Hunger, conflict, displacement, poverty, health, climate, inequality,
governance, military spending — 19 dimensions, ~87 fields per country.

THE EQUATION WRITES ITSELF
Ending global hunger costs $93B/year = 14 days of military spending.
See it, model it, share it.

EVERYTHING OFFLINE
This app bundles the entire dataset. No account, no tracking, no server,
no internet required. Every install is a fully functional node.

OPEN & FREE
All data is CC0 licensed. The code is open source. Built to be mirrored,
forked, and censored with great difficulty.

By installing you join a distributed network that refuses to forget.
```

### Keywords
`hunger, food security, open data, crisis, refugees, military spending, SDG,
humanitarian, world statistics, corruption, climate, displacement, poverty,
inequality, accountability`

### Category
`News & Magazines`

### Content rating
- **Target audience:** All ages (educational, no user-generated content).
- **Violence:** None depicted — references to real-world conflict data only.
- **Suggested rating:** Everyone (PEGI 3 / ESRB E / IARC "All").
- **No ads, no in-app purchases, no social features.**

### Privacy-friendly flags
- No data collection, no analytics, no SDKs that phone home.
- No account creation.
- Works fully offline.

---

## Screenshot generation guide

Generate store screenshots programmatically with Puppeteer at mobile
resolutions:

```bash
npm install -D puppeteer
```

```js
// scripts/shots.js — capture key pages for store listings
const puppeteer = require('puppeteer');

const pages = [
  { name: '01-dashboard', path: '/the-dashboard/' },
  { name: '02-sorrow-map', path: '/sorrow-map/' },
  { name: '03-equation',   path: '/equation/' },
  { name: '04-academy',    path: '/the-academy/' },
  { name: '05-country',    path: '/the-briefing/?iso=SDN' },
];

const sizes = [
  { label: 'phone',  width: 1080, height: 1920 },
  { label: 'tablet', width: 1200, height: 1920 },
];

(async () => {
  const browser = await puppeteer.launch();
  for (const size of sizes) {
    const page = await browser.newPage();
    await page.setViewport({ width: size.width, height: size.height, isMobile: true });
    for (const p of pages) {
      // Serve the built export with a local server first, e.g. npx serve out
      await page.goto('http://localhost:3000' + p.path, { waitUntil: 'networkidle0' });
      await new Promise(r => setTimeout(r, 800)); // let charts render
      await page.screenshot({ path: `screenshots/${p.name}-${size.label}.png`, fullPage: false });
    }
    await page.close();
  }
  await browser.close();
})();
```

Run after `npm run build && npx serve out -l 3000`, then `node scripts/shots.js`.

---

## Privacy policy template

```
V FOR X — Privacy Policy

Effective date: [DATE]

V FOR X does not collect, store, or transmit any personal data.

1. NO DATA COLLECTION
   The app contains no analytics, no advertising SDKs, no crash reporters,
   and no tracking. It does not request access to your contacts, location,
   camera, microphone, or storage.

2. OFFLINE BY DESIGN
   All data is bundled within the app. The app functions fully without an
   internet connection. No information about you or your usage leaves your
   device.

3. LOCAL STORAGE
   The app may save preferences (such as language or sound settings) and
   user-generated content (such as notes or campaign drafts) in your
   device's local storage. This data never leaves your device and is
   deleted when you uninstall the app.

4. OPEN SOURCE
   The entire source code is publicly available for independent audit:
   https://github.com/mouracleiton/v_for_x

5. CHILDREN
   The app is suitable for all ages and contains no content inappropriate
   for minors.

6. CONTACT
   For questions about this policy, open an issue on the project repository.

This policy may be updated; the app will always remain free of tracking.
```

---

## F-Droid inclusion notes

V FOR X is an ideal F-Droid candidate because it is **100% free software with
no proprietary dependencies and no network tracking**. To publish:

1. **Reproducible builds.** F-Droid requires builds to be reproducible. Pin exact
   dependency versions in `package-lock.json` and use a fixed Node + JDK toolchain
   in CI. Gradle must build deterministically (set `org.gradle.caching=true` and
   a fixed `versionCode`).

2. **No proprietary blobs.** Confirm `out/` contains **no** Google Fonts, no CDN
   scripts, no analytics. V FOR X already bundles everything locally — verify with:
   ```bash
   grep -rE "googleapis|gstatic|cloudflare|jsdelivr|googletagmanager" out/
   # Expected: no matches
   ```

3. **App metadata.** Create a `fdroid/metadata/foundation.aaif.vforx.yml` with:
   - `License: CC0-1.0` (data) and the code license.
   - `SourceCode`, `IssueTracker`, `WebSite` links.
   - `Categories:` → `Science & Education` or `Reading`.
   - `AntiFeatures:` → none expected (no ads, no tracking, no proprietary deps).

4. **AndroidManifest hardening.** Ensure no `INTERNET` permission is requested
   unless a specific feature needs it. The offline bundle needs none. If you add
   the optional live-data sync, declare it explicitly and document why.

5. **Signing.** F-Droid signs its own builds — do **not** ship a release key.
   Submit the source tarball + build recipe; F-Droid verifies reproducibility.

6. **Update checks.** Provide a `UpdateCheckMode` (e.g. `Tags`) so F-Droid can
   detect new releases automatically.

7. **Quick start:** after setting up reproducible builds, submit via the
   [fdroiddata](https://gitlab.com/fdroid/fdroiddata) merge-request process with
   a build description. Verification typically takes a few weeks.

---

## Why a native app at all?

Because the **web is censorable**. App stores, sideloaded APKs, and F-Droid
repositories create independent distribution channels. A phone with V FOR X
installed carries a complete, searchable atlas of the world's crises — and can
share it peer-to-peer with no server in between.

Every install is a node. Every node is a copy that refuses to die.
