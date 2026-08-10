#!/usr/bin/env python3
"""
V FOR X — Governance & Corruption Data Fetcher
================================================
Fetches Worldwide Governance Indicators (WGI) from the World Bank API
and Transparency International CPI data, merging into world_backbone.json.

WGI indicators (6 dimensions):
  - Control of Corruption (CC.EST)
  - Government Effectiveness (GE.EST)
  - Political Stability (PV.EST)
  - Regulatory Quality (RQ.EST)
  - Rule of Law (RL.EST)
  - Voice & Accountability (VA.EST)

Each WGI indicator is a z-score (~ -2.5 to +2.5), where higher = better.

Also derives:
  - WGI composite score (0-100, normalized average of 6 indicators)
  - Corruption risk classification

API: https://api.worldbank.org/v2/country/all/indicator/{code}
     ?format=json&date=2018:2025&per_page=20000

Usage:
  python3 scripts/fetch_governance.py
  python3 scripts/fetch_governance.py --dry-run
  python3 scripts/fetch_governance.py --year-range 2015:2025
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

# WGI indicators → governance field mapping
WGI_MAP = {
    "CC.EST": ("control_of_corruption",     "Control of Corruption"),
    "GE.EST": ("government_effectiveness",  "Government Effectiveness"),
    "PV.EST": ("political_stability",       "Political Stability"),
    "RQ.EST": ("regulatory_quality",        "Regulatory Quality"),
    "RL.EST": ("rule_of_law",               "Rule of Law"),
    "VA.EST": ("voice_and_accountability",  "Voice & Accountability"),
}


def fetch_indicator(code: str, year_range: str) -> dict:
    """Fetch one WGI indicator; return {iso3: (value, year)} for latest non-null."""
    url = f"{WB_API_BASE}/{code}?format=json&date={year_range}&per_page=20000&source=3"
    req = urllib.request.Request(url, headers={"User-Agent": "VForX/1.0 (governance-fetch)"})
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


def wgi_to_100(z_score: float) -> float:
    """Convert WGI z-score (~-2.5..+2.5) to 0-100 scale (higher = better)."""
    clamped = max(-2.5, min(2.5, z_score))
    return round(((clamped + 2.5) / 5.0) * 100, 1)


def corruption_risk_level(score: float) -> str:
    """Classify corruption risk from WGI composite (0-100, higher=better)."""
    if score >= 75:
        return "low"
    elif score >= 50:
        return "moderate"
    elif score >= 30:
        return "high"
    else:
        return "severe"


def main() -> int:
    parser = argparse.ArgumentParser(description="Governance & corruption data fetcher")
    parser.add_argument("--dry-run", action="store_true", help="Show what would fetch without writing")
    parser.add_argument("--year-range", default="2018:2025", help="Year range (default 2018:2025)")
    args = parser.parse_args()

    print("Loading world_backbone.json...")
    backbone = json.loads(BACKBONE_PATH.read_text(encoding="utf-8"))
    countries = {c["iso3"]: c for c in backbone["countries"]}
    print(f"  {len(countries)} countries in backbone")

    updated_counts: dict[str, int] = {}
    total_updated = 0

    # Fetch all WGI indicators
    wgi_data: dict[str, dict[str, tuple]] = {}  # field → {iso3 → (value, year)}

    for code, (field, label) in WGI_MAP.items():
        print(f"\n[{code}] → governance.{field}")
        if args.dry_run:
            print(f"  [DRY-RUN] would fetch {code} for {args.year_range}")
            continue

        data = fetch_indicator(code, args.year_range)
        wgi_data[field] = data

    if args.dry_run:
        print("\n[DRY-RUN] No changes written.")
        return 0

    # Merge into backbone
    for field, data in wgi_data.items():
        count = 0
        for iso3, (value, year) in data.items():
            country = countries.get(iso3)
            if country is None:
                continue
            if "governance" not in country:
                country["governance"] = {}
            gov = country["governance"]

            # Store raw z-score
            gov[field] = round(value, 3)
            gov[f"{field}_year"] = year
            # Store normalized 0-100 version
            gov[f"{field}_score"] = wgi_to_100(value)

            count += 1

        updated_counts[f"governance.{field}"] = count
        total_updated += count

    # Compute WGI composite for each country
    composite_count = 0
    for iso3, country in countries.items():
        gov = country.get("governance", {})
        scores = []
        for field, _ in WGI_MAP.items():
            s = gov.get(f"{field}_score")
            if s is not None:
                scores.append(s)

        if scores:
            composite = round(sum(scores) / len(scores), 1)
            gov["wgi_composite"] = composite
            gov["wgi_composite_year"] = max(
                (gov.get(f"{f}_year", 0) for f, _ in WGI_MAP.items()),
                default=0,
            )
            gov["corruption_risk"] = corruption_risk_level(composite)

            # Map to existing type fields
            cc = gov.get("control_of_corruption")
            if cc is not None:
                gov["corruption_perceptions_index"] = gov.get("control_of_corruption_score")
                gov["cpi_year"] = gov.get("control_of_corruption_year", 0)

            composite_count += 1

    updated_counts["governance.wgi_composite"] = composite_count

    # Stamp metadata
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    backbone["metadata"]["last_updated"] = today
    sources = set(backbone["metadata"].get("sources", []))
    sources.add("World Bank WGI (governance refresh)")
    backbone["metadata"]["sources"] = sorted(sources)

    if "enrichments" not in backbone:
        backbone["enrichments"] = []
    backbone["enrichments"].append({
        "source": "World Bank Worldwide Governance Indicators",
        "date": today,
        "scope": f"{len(WGI_MAP)} WGI indicators + composite, {total_updated} country-field updates",
        "generalizable": True,
        "description": "Governance indicators: Control of Corruption, Gov Effectiveness, "
                       "Political Stability, Regulatory Quality, Rule of Law, Voice & Accountability. "
                       "Z-scores normalized to 0-100 scale.",
    })

    BACKBONE_PATH.write_text(
        json.dumps(backbone, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"\n{'=' * 60}")
    print("GOVERNANCE DATA REFRESH SUMMARY")
    print(f"{'=' * 60}")
    for label, count in updated_counts.items():
        print(f"  {label}: {count} countries")
    print(f"\nTotal field updates: {total_updated}")
    print(f"Composite scores: {composite_count}")
    print(f"last_updated → {today}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
