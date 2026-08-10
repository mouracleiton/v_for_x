#!/usr/bin/env python3
"""
V FOR X — Our World in Data (OWID) Fetcher
============================================
Downloads key datasets from Our World in Data's public CSV API and
saves them as JSON for client-side use. No API key required.

OWID Chart CSV API: https://ourworldindata.org/grapher/{slug}.csv
Each CSV has columns: Entity, Code, Year, [data columns...]

This script fetches a curated set of high-value datasets that
complement the existing World Bank data, focusing on:
  - Long-run historical series (life expectancy, GDP back to 1800s)
  - Inequality and poverty (Gini, poverty headcount ratios)
  - Climate and energy (CO2, energy mix, renewable share)
  - Health outcomes (vaccination, mental health, causes of death)
  - Education (schooling, learning outcomes)
  - Democracy and rights (V-Dem, press freedom)
  - Food and agriculture (crop yields, dietary composition)

Output: data/owid_datasets/{slug}.json — one file per dataset.
Index: data/owid_index.json — catalog of all fetched datasets.

Usage:
  python3 scripts/fetch_owid.py
  python3 scripts/fetch_owid.py --dry-run
  python3 scripts/fetch_owid.py --only life-expectancy,co-emissions-per-capita
"""

import argparse
import csv
import io
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "data" / "owid_datasets"
INDEX_PATH = REPO_ROOT / "data" / "owid_index.json"

OWID_CSV_BASE = "https://ourworldindata.org/grapher"
OWID_META_BASE = "https://ourworldindata.org/grapher"

# Curated dataset catalog: slug → metadata
DATASETS = {
    # ── Health ──
    "life-expectancy": {
        "category": "health",
        "label": "Life Expectancy at Birth",
        "description": "Long-run life expectancy data back to 1770.",
        "source": "UN WPP + historical reconstructions",
    },
    "child-mortality": {
        "category": "health",
        "label": "Child Mortality Rate (under 5)",
        "description": "Share of children who die before age 5.",
        "source": "UN IGME",
    },
    "share-of-children-who-are-immunized-against-measles": {
        "category": "health",
        "label": "Measles Vaccination Coverage",
        "description": "Share of children immunized against measles.",
        "source": "WHO/UNICEF",
    },

    # ── Poverty & Inequality ──
    "economic-inequality-gini-index": {
        "category": "poverty",
        "label": "Gini Coefficient (Inequality)",
        "description": "After-tax Gini index of income inequality.",
        "source": "World Inequality Database",
    },
    "share-in-poverty-up-to-6-75": {
        "category": "poverty",
        "label": "Share in Extreme Poverty ($6.75/day)",
        "description": "Share of population below $6.75 per day.",
        "source": "World Bank PIP",
    },

    # ── Climate & Energy ──
    "co-emissions-per-capita": {
        "category": "climate",
        "label": "CO₂ Emissions per Capita",
        "description": "Annual CO₂ emissions from fossil fuels, per person.",
        "source": "Global Carbon Project",
    },
    "per-capita-renewables": {
        "category": "climate",
        "label": "Renewable Energy per Capita",
        "description": "Per capita energy from renewable sources.",
        "source": "Our World in Data based on BP + SHIFT",
    },
    "share-electricity-renewables": {
        "category": "climate",
        "label": "Electricity from Renewables (%)",
        "description": "Share of electricity generated from renewables.",
        "source": "Ember",
    },

    # ── Education ──
    "cross-country-literacy-rates": {
        "category": "education",
        "label": "Literacy Rate",
        "description": "Historical literacy rates since 1800.",
        "source": "OWID + van Zanden et al.",
    },
    "mean-years-of-schooling-long-run": {
        "category": "education",
        "label": "Mean Years of Schooling",
        "description": "Average years of schooling, long-run.",
        "source": "Lee & Lee",
    },

    # ── Democracy & Rights ──
    "electoral-democracy": {
        "category": "democracy",
        "label": "Electoral Democracy Index",
        "description": "V-Dem electoral democracy index, 1789-present.",
        "source": "V-Dem Institute",
    },
    "freedom-of-expression": {
        "category": "democracy",
        "label": "Freedom of Expression",
        "description": "V-Dem freedom of expression index.",
        "source": "V-Dem Institute",
    },
    "press-freedom-index": {
        "category": "democracy",
        "label": "Press Freedom Index",
        "description": "RSF World Press Freedom Index.",
        "source": "Reporters Without Borders",
    },

    # ── Food & Agriculture ──
    "cereal-yield": {
        "category": "food",
        "label": "Cereal Yield",
        "description": "Cereal yield (kg per hectare).",
        "source": "FAO",
    },
    "dietary-availability-of-calories-per-capita": {
        "category": "food",
        "label": "Daily Caloric Supply",
        "description": "Dietary energy supply per person per day (kcal).",
        "source": "FAO",
    },

    # ── Economy ──
    "gdp-per-capita-maddison-database": {
        "category": "economy",
        "label": "GDP per Capita (Maddison)",
        "description": "Long-run GDP per capita back to 1500.",
        "source": "Maddison Project Database",
    },

    # ── Military & Conflict ──
    "military-expenditure-as-a-share-of-gdp": {
        "category": "military",
        "label": "Military Expenditure (% GDP)",
        "description": "Military spending as share of GDP.",
        "source": "SIPRI",
    },
}


def fetch_csv(slug: str) -> list[dict] | None:
    """Fetch OWID chart data as CSV and parse rows."""
    url = f"{OWID_CSV_BASE}/{slug}.csv"
    req = urllib.request.Request(url, headers={"User-Agent": "VForX/1.0 (owid-fetch)"})
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            content = resp.read().decode("utf-8")
    except Exception as exc:
        print(f"  ✗ {slug}: fetch failed ({exc})")
        return None

    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    if not rows:
        print(f"  ✗ {slug}: no data rows")
        return None

    return rows


def transform_rows(rows: list[dict], slug: str) -> dict:
    """
    Transform CSV rows into a compact JSON structure:
    {
      "slug": "life-expectancy",
      "entities": {
        "USA": { "name": "United States", "years": { "2020": 77.3, "2021": 76.1 } },
        ...
      },
      "latest": { "USA": 76.1, ... },  # most recent value per entity
      "min_year": 1543,
      "max_year": 2023,
      "data_columns": ["Life expectancy at birth (historical)"]
    }
    """
    entities: dict[str, dict] = {}
    data_cols = [c for c in rows[0].keys() if c not in ("Entity", "Code", "Year", "Day")]
    min_year = 9999
    max_year = 0
    latest: dict[str, float] = {}

    for row in rows:
        entity = row.get("Entity", "").strip()
        code = row.get("Code", "").strip()
        year_str = row.get("Year") or row.get("Day", "")

        if not entity or not year_str:
            continue

        # Use code if available, otherwise entity name
        entity_id = code if code and len(code) <= 5 else entity

        try:
            year = int(year_str.split("-")[0])
        except (ValueError, IndexError):
            continue

        min_year = min(min_year, year)
        max_year = max(max_year, year)

        if entity_id not in entities:
            entities[entity_id] = {
                "name": entity,
                "code": code or None,
                "years": {},
            }

        # Use first data column as primary value
        for col in data_cols:
            val_str = row.get(col, "")
            if val_str:
                try:
                    val = float(val_str)
                    if col == data_cols[0]:
                        entities[entity_id]["years"][str(year)] = val
                        cur_latest = latest.get(entity_id)
                        if cur_latest is None or year >= max(
                            int(y) for y in entities[entity_id]["years"]
                        ):
                            latest[entity_id] = val
                except ValueError:
                    pass

    return {
        "slug": slug,
        "entities": entities,
        "latest": latest,
        "min_year": min_year if min_year < 9999 else None,
        "max_year": max_year if max_year > 0 else None,
        "data_columns": data_cols,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="OWID dataset fetcher")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--only", type=str, help="Comma-separated list of slugs to fetch")
    args = parser.parse_args()

    slugs_to_fetch = list(DATASETS.keys())
    if args.only:
        requested = [s.strip() for s in args.only.split(",")]
        slugs_to_fetch = [s for s in requested if s in DATASETS]
        if not slugs_to_fetch:
            print(f"Error: none of {requested} are in the catalog")
            return 1

    print(f"Fetching {len(slugs_to_fetch)} OWID datasets...")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    index_entries = []
    success_count = 0
    fail_count = 0

    for slug in slugs_to_fetch:
        meta = DATASETS[slug]
        print(f"\n[{slug}] → {meta['label']}")
        if args.dry_run:
            print(f"  [DRY-RUN] would fetch {OWID_CSV_BASE}/{slug}.csv")
            continue

        rows = fetch_csv(slug)
        if rows is None:
            fail_count += 1
            continue

        data = transform_rows(rows, slug)
        entity_count = len(data["entities"])
        print(f"  ✓ {entity_count} entities, {data['min_year']}–{data['max_year']}")

        output_path = OUTPUT_DIR / f"{slug}.json"
        output_path.write_text(
            json.dumps(data, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        success_count += 1

        index_entries.append({
            "slug": slug,
            "category": meta["category"],
            "label": meta["label"],
            "description": meta["description"],
            "source": meta["source"],
            "entities": entity_count,
            "min_year": data["min_year"],
            "max_year": data["max_year"],
            "data_columns": data["data_columns"],
        })

    if args.dry_run:
        print(f"\n[DRY-RUN] Would fetch {len(slugs_to_fetch)} datasets.")
        return 0

    # Write index
    index = {
        "version": 1,
        "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "total_datasets": len(index_entries),
        "categories": sorted(set(e["category"] for e in index_entries)),
        "datasets": sorted(index_entries, key=lambda x: (x["category"], x["label"])),
    }
    INDEX_PATH.write_text(
        json.dumps(index, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"\n{'=' * 60}")
    print("OWID FETCH SUMMARY")
    print(f"{'=' * 60}")
    print(f"  Fetched: {success_count}")
    print(f"  Failed:  {fail_count}")
    print(f"  Total entities across all datasets: {sum(e['entities'] for e in index_entries)}")
    print(f"  Index: {INDEX_PATH.relative_to(REPO_ROOT)}")
    print(f"  Output: {OUTPUT_DIR.relative_to(REPO_ROOT)}/{'{' + 'slug' + '}'}.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
