#!/usr/bin/env python3
"""
V FOR X — World Bank Live Data Fetcher
=======================================
Fetches key development indicators from the World Bank Open Data API
(no API key required) and merges the latest values into world_backbone.json.

This makes the platform's "live data" claim honest — each scheduled refresh
re-pulls from the source rather than re-processing cached files.

API: https://api.worldbank.org/v2/country/all/indicator/{code}
     ?format=json&date=2020:2025&per_page=20000

Usage:
  python3 scripts/fetch_worldbank.py
  python3 scripts/fetch_worldbank.py --dry-run
  python3 scripts/fetch_worldbank.py --year-range 2018:2025
"""

import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKBONE_PATH = REPO_ROOT / "data" / "world_backbone.json"

WB_API_BASE = "https://api.worldbank.org/v2/country/all/indicator"

INDICATOR_MAP = {
    "NY.GDP.PCAP.CD":   ("economy",          "gdp_per_capita_usd",           "gdp_year"),
    "NY.GDP.MKTP.CD":   ("economy",          "gdp_usd",                      "gdp_year"),
    "SP.DYN.LE00.IN":   ("health",           "life_expectancy",              "life_expectancy_year"),
    "SH.DYN.MORT":      ("health",           "child_mortality_under5_per1k", "life_expectancy_year"),
    "SH.STA.MMRT":      ("health",           "maternal_mortality_per100k",   "life_expectancy_year"),
    "SE.ADT.LITR.ZS":   ("education",        "literacy_rate_pct",            "year"),
    "SL.UEM.TOTL.ZS":   ("employment",       "unemployment_pct",             None),
    "SH.H2O.BASW.ZS":   ("water_sanitation", "basic_access_pct",             "year"),
    "IT.NET.USER.ZS":   ("connectivity",     "internet_users_pct",           "year"),
}


def fetch_indicator(code: str, year_range: str) -> dict:
    """Fetch one WB indicator; return {iso3: (value, year)} for latest non-null per country."""
    url = f"{WB_API_BASE}/{code}?format=json&date={year_range}&per_page=20000"
    req = urllib.request.Request(url, headers={"User-Agent": "VForX/1.0 (data-refresh)"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        print(f"  ✗ {code}: fetch failed ({exc})")
        return {}

    if not isinstance(payload, list) or len(payload) < 2 or not payload[1]:
        print(f"  ✗ {code}: no data in response")
        return {}

    latest: dict[str, tuple] = {}
    for point in payload[1]:
        iso3 = point.get("countryiso3code", "").strip()
        value = point.get("value")
        year_str = point.get("date", "")
        if not iso3 or value is None or len(iso3) != 3 or not iso3.isalpha():
            continue
        try:
            year = int(year_str)
        except (ValueError, TypeError):
            continue
        existing = latest.get(iso3)
        if existing is None or year > existing[1]:
            latest[iso3] = (value, year)

    print(f"  ✓ {code}: {len(latest)} countries with data")
    return latest


def main() -> int:
    parser = argparse.ArgumentParser(description="World Bank live data fetcher")
    parser.add_argument("--dry-run", action="store_true", help="Show what would fetch without writing")
    parser.add_argument("--year-range", default="2020:2025", help="Year range for WB data (default 2020:2025)")
    args = parser.parse_args()

    print("Loading world_backbone.json...")
    backbone = json.loads(BACKBONE_PATH.read_text(encoding="utf-8"))
    countries = {c["iso3"]: c for c in backbone["countries"]}
    print(f"  {len(countries)} countries in backbone")

    updated_counts: dict[str, int] = {}
    total_updated = 0

    for code, (dim, field, year_field) in INDICATOR_MAP.items():
        label = f"{dim}.{field}"
        print(f"\n[{code}] → {label}")
        if args.dry_run:
            print(f"  [DRY-RUN] would fetch {code} for {args.year_range}")
            continue

        data = fetch_indicator(code, args.year_range)
        count = 0
        for iso3, (value, year) in data.items():
            country = countries.get(iso3)
            if country is None:
                continue
            if dim not in country:
                country[dim] = {}
            country[dim][field] = value
            if year_field:
                cur_year = country[dim].get(year_field)
                if cur_year is None or year >= cur_year:
                    country[dim][year_field] = year
            count += 1

        updated_counts[label] = count
        total_updated += count

    if args.dry_run:
        print("\n[DRY-RUN] No changes written.")
        return 0

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    backbone["metadata"]["last_updated"] = today
    sources = set(backbone["metadata"].get("sources", []))
    sources.add("World Bank Open Data (API refresh)")
    backbone["metadata"]["sources"] = sorted(sources)

    if "enrichments" not in backbone:
        backbone["enrichments"] = []
    backbone["enrichments"].append({
        "source": "World Bank Open Data API",
        "date": today,
        "scope": f"{len(INDICATOR_MAP)} indicators, {total_updated} country-field updates",
        "generalizable": True,
        "description": "Live data refresh from World Bank API (no key required).",
    })

    BACKBONE_PATH.write_text(
        json.dumps(backbone, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"\n{'=' * 60}")
    print("WORLD BANK REFRESH SUMMARY")
    print(f"{'=' * 60}")
    for label, count in updated_counts.items():
        print(f"  {label}: {count} countries")
    print(f"\nTotal field updates: {total_updated}")
    print(f"last_updated → {today}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
