# V FOR X Compass — Browser Extension

Highlight any **country name** or **crisis term** on any webpage and instantly
pull up V FOR X intelligence data.

> A Manifest V3 extension for Chrome, Edge, Brave, and Firefox 115+.
> Works against the live platform at
> **https://mouracleiton.github.io/v_for_x/**.

---

## What it does

- **Tooltip on selection** — Select the name of a country (e.g. *Sudan*,
  *DR Congo*, *USA*) on any page. A dark, command-center-style tooltip appears
  with the flag, a quick severity preview (for the 20 most data-rich countries)
  and a **"View on V FOR X →"** link to that country's Sorrow Map dossier.
- **Right-click → "Search V FOR X for '…'"** — Opens the country dossier if the
  selection is a known country, otherwise searches the V FOR X index for the
  term.
- **Popup command center** — A 320px popup with a country search box, quick
  links to every branch (Sorrow Map, Registry, Dashboard, Alerts, Press Kit),
  and a **"Highlight countries on this page"** toggle that underlines every
  recognised country name on the active page with a crimson dashed line.

The UI matches the V FOR X design system: deep-navy `#060b14` surfaces, refined
alert-crimson `#c42b3e`, intelligence cyan-green `#22d3a6`, monospace type.

---

## File map

| File | Role |
|------|------|
| `manifest.json` | MV3 manifest — permissions, service worker, content script |
| `background.js` | Service worker — context menu, name→ISO3 lookup, tab opening |
| `content.js` | Content script — selection tooltip + full-page highlighting |
| `countries.js` | Shared module — ~50 country names/variants → ISO3 + top-20 stats |
| `popup.html` | Popup markup (320px wide) |
| `popup.css` | Popup styles (Command Center theme) |
| `popup.js` | Popup logic — search, quick links, highlight toggle |
| `icon.svg` | Source icon (crimson V on navy) |
| `icons/` | Generated PNG icons (16/48/128) — see below |

---

## Icons

`icon.svg` is the **source** vector icon. Manifest V3 requires **PNG** icons,
so generate the three sizes used in `manifest.json`:

```bash
# Using ImageMagick (most distros / `brew install imagemick`):
mkdir -p icons
for size in 16 48 128; do
  convert -background none -resize ${size}x${size} icon.svg icons/icon${size}.png
done

# Or with rsvg-convert:
mkdir -p icons
for size in 16 48 128; do
  rsvg-convert -w $size -h $size icon.svg -o icons/icon${size}.png
done

# Or with Inkscape CLI:
mkdir -p icons
for size in 16 48 128; do
  inkscape icon.svg -w $size -h $size -o icons/icon${size}.png
done
```

The extension will load fine without the PNGs (browsers fall back to a default
icon), but the toolbar/popup icon will be generic until they are generated.

---

## Load it (developer mode)

**Chrome / Edge / Brave**

1. Generate the PNG icons (above), or skip for now.
2. Visit `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. **Load unpacked** → select this `extension/` directory.
5. Pin **V FOR X Compass** and open any news article to test selection.

**Firefox 115+**

1. Generate the PNG icons (above).
2. Visit `about:debugging#/runtime/this-firefox`.
3. **Load Temporary Add-on…** → select `extension/manifest.json`.
4. The `browser_specific_settings.gecko.id` lets you sign/persist it for a
   permanent install.

---

## Data & privacy

- The extension makes **no network requests itself**. All it does is open
  `https://mouracleiton.github.io/v_for_x/...` tabs when you ask it to.
- `host_permissions` is **empty** — the content script runs on all pages via
  the `<all_urls>` content-script match, with no remote code and no data
  leaving the page. The popup persists only the highlight-toggle state in
  `chrome.storage.local`.
- Country stats embedded in `countries.js` are sourced from WFP/FAO hunger
  hotspots & the *Global Report on Food Crises 2025* (CC0 on the platform).

---

## Notes

- `countries.js` is loaded as a classic `<script>` **before** `content.js` in
  the manifest, exposing a global `V4X_COUNTRIES`. `background.js` `import()`s
  it dynamically inside the service worker (MV3 workers can't use classic
  globals across files), so the module is written to support both.
- Country name matching is intentionally conservative (≈50 major + crisis
  countries) to avoid false-positive tooltips on common words.
