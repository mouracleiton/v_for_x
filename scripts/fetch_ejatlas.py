#!/usr/bin/env python3
"""
V FOR X — EJAtlas Environmental Conflict Integration
=====================================================
Downloads environmental justice conflict data from the EJAtlas dataset
(eliasjacob/ejatlas-data on GitHub, extracted from ejatlas.org) and
transforms it into the V FOR X data schema.

The EJAtlas (Global Atlas of Environmental Justice) documents 4,400+
socio-environmental conflicts worldwide — mining, dams, deforestation,
land grabs, pollution, fossil fuels, and more. This script joins the
normalised CSV exports (keyed by slug) into a single JSON file keyed
by ISO3 country code, ready for the Registry and Sorrow Map branches.

Data sources (all CC BY-NC-SA 3.0, attributed to EJAtlas / ICTA-UAB):
  - basic_data.csv          — name, country, location, description
  - details_and_actors.csv  — investment, affected people, dates
  - source_type2.csv        — conflict categories (10 top-level)
  - presentation.csv        — English headlines
  - conflict_intensity.csv  — LATENT / LOW / MEDIUM / HIGH
  - outcome.csv             — project status, success level
  - company_names.csv       — involved companies
  - impacts_*.csv           — environmental + socio-economic impacts
  - mobilization_groups.csv — mobilising actors
  - source_products.csv     — commodities

Usage:
  python3 scripts/fetch_ejatlas.py [--output data/ejatlas-conflicts.json]
  python3 scripts/fetch_ejatlas.py --dry-run
"""

import argparse
import csv
import io
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

# ── Configuration ──────────────────────────────────────────────

REPO_RAW = "https://raw.githubusercontent.com/eliasjacob/ejatlas-data/main/raw"

CSV_FILES = [
    "basic_data", "details_and_actors", "source_type2", "presentation",
    "conflict_intensity", "outcome", "company_names",
    "impacts_environmental_impact", "impacts_socio_economical_impact",
    "mobilization_groups_mobilizing", "source_products",
]

REPO_ROOT = Path(__file__).resolve().parent.parent
SUMMARY_PATH = REPO_ROOT / "data" / "ejatlas-summary.json"
OUTPUT_PATH = REPO_ROOT / "data" / "ejatlas-conflicts.json"

CONFLICT_CATEGORIES = {
    "mineral-ores-and-building-materials-extraction": ("Mineral Ores & Building Materials", "#ff7f00"),
    "waste-management": ("Waste Management", "#77721c"),
    "biomass-and-land-conflicts": ("Biomass & Land Conflicts", "#3eb536"),
    "fossil-fuels-and-climate-justiceenergy": ("Fossil Fuels & Climate Justice", "#000000"),
    "fossil-fuels-and-climate-justice/energy": ("Fossil Fuels & Climate Justice", "#000000"),
    "water-management": ("Water Management", "#00bdff"),
    "infrastructure-and-built-environment": ("Infrastructure & Built Environment", "#9b59b6"),
    "tourism-recreation": ("Tourism Recreation", "#e67e22"),
    "biodiversity-conservation-conflicts": ("Biodiversity Conservation", "#2ecc71"),
    "industrial-and-utilities-conflicts": ("Industrial & Utilities", "#ed1c24"),
    "nuclear": ("Nuclear", "#f1c40f"),
}

INTENSITY_RANK = {"latent": 1, "low": 2, "medium": 3, "high": 4, "unknown": 0}

# EJAtlas country name → ISO3 (covers all names that differ from backbone)
COUNTRY_OVERRIDES = {
    "United States of America": "USA",
    "United States": "USA",
    "USA": "USA",
    "Bahamas, The": "BHS",
    "The Bahamas": "BHS",
    "Czech Republic": "CZE",
    "Czechia": "CZE",
    "Democratic Republic of the Congo": "COD",
    "Congo, Democratic Republic": "COD",
    "Congo DRC": "COD",
    "Republic of the Congo": "COG",
    "Congo": "COG",
    "Cote d'Ivoire": "CIV",
    "Ivory Coast": "CIV",
    "Gambia, The": "GMB",
    "The Gambia": "GMB",
    "North Korea": "PRK",
    "South Korea": "KOR",
    "Republic of Korea": "KOR",
    "Burma": "MMR",
    "Myanmar": "MMR",
    "Russia": "RUS",
    "Russian Federation": "RUS",
    "Venezuela": "VEN",
    "Bolivia": "BOL",
    "Iran": "IRN",
    "Syria": "SYR",
    "Tanzania": "TZA",
    "Vietnam": "VNM",
    "Laos": "LAO",
    "Brunei": "BRN",
    "Macedonia": "MKD",
    "North Macedonia": "MKD",
    "Taiwan": "TWN",
    "Moldova": "MDA",
    "Palestine": "PSE",
    "West Bank": "PSE",
    "Gaza": "PSE",
    "Kosovo": "XKX",
    "Swaziland": "SWZ",
    "Eswatini": "SWZ",
    "Turkey": "TUR",
    "Cape Verde": "CPV",
    "Cabo Verde": "CPV",
    "Reunion": "REU",
    "Martinique": "MTQ",
    "Guadeloupe": "GLP",
    "French Guiana": "GUF",
    "New Caledonia": "NCL",
    "Puerto Rico": "PRI",
    "Western Sahara": "ESH",
    "Hong Kong": "HKG",
    "Macau": "MAC",
}


# ── Helpers ────────────────────────────────────────────────────

def strip_html(text: str) -> str:
    """Remove HTML tags and entities, collapse whitespace."""
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    text = text.replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&quot;", '"').replace("&#39;", "'")
    text = text.replace("_x000D_", " ").replace("_x000D_\n", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def truncate(text: str, n: int = 350) -> str:
    if len(text) <= n:
        return text
    cut = text[:n].rsplit(" ", 1)[0]
    return cut + "…"


def load_backbone_countries() -> dict[str, str]:
    """Build name → ISO3 mapping from world_backbone.json + countries_en.json."""
    mapping: dict[str, str] = {}
    bb = REPO_ROOT / "data" / "world_backbone.json"
    if bb.exists():
        data = json.loads(bb.read_text(encoding="utf-8"))
        for c in data.get("countries", []):
            iso3 = c["iso3"]
            for key in ("name_en", "name_pt", "name_es", "name_fr"):
                v = c.get(key)
                if v:
                    mapping[v.lower()] = iso3
    mapping.update({k.lower(): v for k, v in COUNTRY_OVERRIDES.items()})
    return mapping


def country_to_iso3(name: str, mapping: dict[str, str]) -> str | None:
    if not name:
        return None
    key = name.strip().lower()
    if key in mapping:
        return mapping[key]
    # Try without common prefixes/suffixes
    for prefix in ("the ",):
        if key.startswith(prefix) and key[len(prefix):] in mapping:
            return mapping[key[len(prefix):]]
    for suffix in (", the", " (country)"):
        if key.endswith(suffix) and key[: -len(suffix)] in mapping:
            return mapping[key[: -len(suffix)]]
    return None


def download_csv(name: str) -> list[dict]:
    """Download a CSV from the GitHub repo and parse it."""
    url = f"{REPO_RAW}/{name}.csv"
    print(f"  ↓ {name}.csv ...", end=" ", flush=True)
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            raw = resp.read()
        # Some files have BOM
        if raw[:3] == b"\xef\xbb\xbf":
            raw = raw[3:]
        text = raw.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
        print(f"{len(rows)} rows")
        return rows
    except Exception as e:
        print(f"FAILED ({e})")
        return []


def parse_int(val) -> int | None:
    if val is None:
        return None
    s = str(val).strip().replace(",", "").replace(".0", "")
    if not s:
        return None
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return None


def parse_float(val) -> float | None:
    if val is None:
        return None
    s = str(val).strip().replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def extract_year(date_str: str) -> int | None:
    if not date_str:
        return None
    m = re.search(r"(19|20)\d{2}", str(date_str))
    if m:
        return int(m.group())
    return None


# ── Main transform ─────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="Fetch & transform EJAtlas data")
    parser.add_argument("--output", default=str(OUTPUT_PATH), help="Output JSON path")
    parser.add_argument("--dry-run", action="store_true", help="Download only, don't write")
    args = parser.parse_args()

    output = Path(args.output)

    print("\n═══ EJAtlas Environmental Conflict Integration ═══\n")

    # Step 1: Download all CSVs
    print("[1/4] Downloading source CSVs...")
    csv_data: dict[str, list[dict]] = {}
    for fname in CSV_FILES:
        csv_data[fname] = download_csv(fname)

    # Step 2: Build lookup dicts keyed by slug
    print("\n[2/4] Joining data by slug...")
    country_map = load_backbone_countries()

    # Index multi-value tables by slug
    categories_by_slug: dict[str, list[dict]] = defaultdict(list)
    for row in csv_data["source_type2"]:
        slug = (row.get("slug") or "").strip()
        if slug:
            categories_by_slug[slug].append(row)

    companies_by_slug: dict[str, list[dict]] = defaultdict(list)
    for row in csv_data["company_names"]:
        slug = (row.get("slug") or "").strip()
        if slug:
            companies_by_slug[slug].append(row)

    env_impacts_by_slug: dict[str, list[str]] = defaultdict(list)
    for row in csv_data["impacts_environmental_impact"]:
        slug = (row.get("slug") or "").strip()
        imp = (row.get("environmental_impact") or row.get("name") or "").strip()
        if slug and imp:
            env_impacts_by_slug[slug].append(imp)

    socio_impacts_by_slug: dict[str, list[str]] = defaultdict(list)
    for row in csv_data["impacts_socio_economical_impact"]:
        slug = (row.get("slug") or "").strip()
        imp = (row.get("socio_economical_impact") or row.get("name") or "").strip()
        if slug and imp:
            socio_impacts_by_slug[slug].append(imp)

    mobilizing_by_slug: dict[str, list[str]] = defaultdict(list)
    for row in csv_data["mobilization_groups_mobilizing"]:
        slug = (row.get("slug") or "").strip()
        grp = (row.get("groups_mobilizing") or row.get("name") or "").strip()
        if slug and grp:
            mobilizing_by_slug[slug].append(grp)

    products_by_slug: dict[str, list[str]] = defaultdict(list)
    for row in csv_data["source_products"]:
        slug = (row.get("slug") or "").strip()
        prod = (row.get("name") or "").strip()
        if slug and prod:
            products_by_slug[slug].append(prod)

    presentation_by_slug: dict[str, dict] = {}
    for row in csv_data["presentation"]:
        slug = (row.get("slug") or "").strip()
        locale = (row.get("locale") or "").strip().lower()
        if slug and locale.startswith("en"):
            presentation_by_slug[slug] = row

    intensity_by_slug: dict[str, dict] = {}
    for row in csv_data["conflict_intensity"]:
        slug = (row.get("slug") or "").strip()
        if slug:
            intensity_by_slug[slug] = row

    outcome_by_slug: dict[str, dict] = {}
    for row in csv_data["outcome"]:
        slug = (row.get("slug") or "").strip()
        if slug:
            outcome_by_slug[slug] = row

    details_by_slug: dict[str, dict] = {}
    for row in csv_data["details_and_actors"]:
        slug = (row.get("slug") or "").strip()
        if slug:
            details_by_slug[slug] = row

    # Step 3: Build conflict records
    print("\n[3/4] Building conflict records...")
    conflicts: list[dict] = []
    skipped = 0

    for row in csv_data["basic_data"]:
        slug = (row.get("slug") or "").strip()
        if not slug:
            skipped += 1
            continue

        country_name = (row.get("name") or "").strip()
        iso3 = country_to_iso3(country_name, country_map)

        # Conflict name from presentation (English) or basic_data
        pres = presentation_by_slug.get(slug, {})
        conflict_name = (pres.get("name") or "").strip()
        if not conflict_name:
            location = (row.get("location") or "").strip()
            conflict_name = f"{location}, {country_name}" if location else slug.replace("-", " ").title()

        headline = strip_html(pres.get("headline") or "")

        # Description: strip HTML + truncate
        description = strip_html(row.get("description") or "")

        # Categories
        cats = categories_by_slug.get(slug, [])
        top_categories = []
        for c in cats:
            cat_slug = (c.get("category.slug") or "").strip()
            cat_name = c.get("category.name") or ""
            if cat_name and cat_name not in [x["name"] for x in top_categories]:
                label, color = CONFLICT_CATEGORIES.get(cat_slug, (cat_name, "#666"))
                top_categories.append({"slug": cat_slug, "name": label, "color": color})

        # Companies
        companies = []
        for c in companies_by_slug.get(slug, []):
            cname = (c.get("name") or "").strip()
            if cname:
                companies.append({
                    "name": cname,
                    "country": (c.get("country_name") or "").strip(),
                    "url": (c.get("url") or "").strip(),
                })

        # Intensity
        intensity = intensity_by_slug.get(slug, {})
        intensity_name = (intensity.get("name") or "Unknown").strip()
        intensity_level = intensity_name.split()[0].lower() if intensity_name else "unknown"

        # Outcome / status
        outcome = outcome_by_slug.get(slug, {})
        project_status = (outcome.get("name") or "").strip()
        success = (outcome.get("success_level") or "").strip()

        # Details
        details = details_by_slug.get(slug, {})
        affected_min = parse_int(details.get("affected_min"))
        affected_max = parse_int(details.get("affected_max"))
        investment = parse_float(details.get("investment"))
        start_year = extract_year(details.get("start_date"))
        end_year = extract_year(details.get("end_date"))

        affected_people = affected_max if affected_max else affected_min

        # Determine severity from intensity + impacts
        rank = INTENSITY_RANK.get(intensity_level, 0)
        n_impacts = len(env_impacts_by_slug.get(slug, [])) + len(socio_impacts_by_slug.get(slug, []))
        if rank >= 3 or n_impacts >= 8:
            severity = "high"
        elif rank >= 2 or n_impacts >= 4:
            severity = "moderate"
        elif rank >= 1:
            severity = "low"
        else:
            severity = "low"

        conflict = {
            "id": slug,
            "name": conflict_name,
            "iso3": iso3 or "UNK",
            "location": (row.get("location") or "").strip(),
            "headline": truncate(headline, 180) if headline else truncate(description, 180),
            "cat": [c["name"] for c in top_categories[:3]],
            "comm": products_by_slug.get(slug, [])[:6],
            "companies": [{"n": c["name"], "c": c["country"]} for c in companies[:6]],
            "intensity": intensity_level,
            "status": project_status.lower() if project_status else "",
            "success": success,
            "affected": affected_people,
            "inv_musd": round(investment / 1e6, 1) if investment and investment > 1e6 else None,
            "yr": start_year,
            "imp_env": env_impacts_by_slug.get(slug, [])[:6],
            "imp_soc": socio_impacts_by_slug.get(slug, [])[:6],
            "mobil": mobilizing_by_slug.get(slug, [])[:6],
            "sev": severity,
            "url": f"https://ejatlas.org/conflict/{slug}",
        }
        conflicts.append(conflict)

    print(f"  Built {len(conflicts)} conflict records ({skipped} skipped)")

    # Step 4: Aggregate + write
    print("\n[4/4] Aggregating and writing output...")

    # Country-level aggregation
    by_country: dict[str, list[dict]] = defaultdict(list)
    for c in conflicts:
        by_country[c["iso3"]].append(c)

    country_summaries = {}
    sev_rank = {"high": 3, "moderate": 2, "low": 1}
    for iso3, clist in sorted(by_country.items()):
        cat_counter: Counter = Counter()
        for c in clist:
            for cat in c["cat"]:
                cat_counter[cat] += 1
        status_counter: Counter = Counter()
        for c in clist:
            s = c["status"] or "unknown"
            status_counter[s] += 1
        stopped = status_counter.get("stopped", 0)
        # Top 8 conflicts by severity then name
        top = sorted(clist, key=lambda c: (-sev_rank.get(c["sev"], 0), c["name"]))[:8]
        country_summaries[iso3] = {
            "total": len(clist),
            "stopped": stopped,
            "top_categories": [{"name": k, "count": v} for k, v in cat_counter.most_common(5)],
            "high_severity": sum(1 for c in clist if c["sev"] == "high"),
            "top_conflicts": [
                {
                    "id": c["id"],
                    "name": c["name"],
                    "loc": c["location"],
                    "hl": c["headline"],
                    "cat": c["cat"][:2],
                    "intensity": c["intensity"],
                    "status": c["status"],
                    "sev": c["sev"],
                    "yr": c["yr"],
                    "affected": c["affected"],
                    "url": c["url"],
                }
                for c in top
            ],
        }

    # Global aggregation
    all_categories: Counter = Counter()
    for c in conflicts:
        for cat in c["cat"]:
            all_categories[cat] += 1

    all_commodities: Counter = Counter()
    for c in conflicts:
        for prod in c["comm"]:
            all_commodities[prod] += 1

    all_companies: Counter = Counter()
    for c in conflicts:
        for comp in c["companies"]:
            all_companies[comp["n"]] += 1

    status_totals: Counter = Counter()
    for c in conflicts:
        s = c["status"] or "unknown"
        status_totals[s] += 1

    result = {
        "metadata": {
            "schema_version": "1.0.0",
            "title": "EJAtlas Environmental Conflicts",
            "description": "Socio-environmental conflicts from the Global Atlas of Environmental Justice (ejatlas.org), documenting mining, dams, deforestation, land grabs, pollution, and industrial conflicts worldwide.",
            "source": "EJAtlas / ICTA-UAB (https://ejatlas.org)",
            "extracted_from": "eliasjacob/ejatlas-data (GitHub)",
            "license": "CC BY-NC-SA 3.0",
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "total_conflicts": len(conflicts),
            "total_countries": len(country_summaries),
            "total_companies": len(all_companies),
            "note": "Attributed to EJAtlas (ejatlas.org). Non-commercial use under CC BY-NC-SA 3.0.",
        },
        "summary": {
            "by_category": [{"name": k, "count": v} for k, v in all_categories.most_common()],
            "by_commodity": [{"name": k, "count": v} for k, v in all_commodities.most_common(30)],
            "top_companies": [{"name": k, "count": v} for k, v in all_companies.most_common(30)],
            "by_status": [{"name": k, "count": v} for k, v in status_totals.most_common()],
            "by_intensity": [
                {"name": k, "count": sum(1 for c in conflicts if c["intensity"] == k)}
                for k in ("high", "medium", "low", "latent", "unknown")
            ],
        },
        "country_summaries": country_summaries,
    }

    summary_file = {
        "metadata": result["metadata"],
        "summary": result["summary"],
        "country_summaries": result["country_summaries"],
    }

    full_file = dict(result)
    full_file["conflicts"] = conflicts

    if args.dry_run:
        print(f"  [DRY-RUN] Summary: {SUMMARY_PATH} ({len(json.dumps(summary_file)) // 1024} KB)")
        print(f"  [DRY-RUN] Full: {output} ({len(json.dumps(full_file)) // 1024} KB)")
    else:
        output.parent.mkdir(parents=True, exist_ok=True)
        SUMMARY_PATH.write_text(json.dumps(summary_file, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"  ✓ Wrote {SUMMARY_PATH} ({SUMMARY_PATH.stat().st_size // 1024} KB)")
        output.write_text(json.dumps(full_file, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"  ✓ Wrote {output} ({output.stat().st_size // 1024} KB)")

    print(f"\n═══ DONE — {len(conflicts)} conflicts across {len(country_summaries)} countries ═══\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
