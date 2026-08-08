#!/usr/bin/env python3
"""
V FOR X — Mental Health Data Enrichment
=========================================
Fetches mental health indicators from the WHO Global Health Observatory (GHO)
API and merges them into world_backbone.json as a new `mental_health` dimension
on every country.

DATA SOURCE:
  WHO GHO API (https://ghoapi.azureedge.net/api/) — public, CC-BY.

INDICATORS FETCHED:
  MH_12            Age-standardized suicide rates (per 100k) — both sexes
                   + male + female breakdown
  MH_6             Psychiatrists working in MH sector (per 100k)
  MH_9             Psychologists working in MH sector (per 100k)
  MH_7             Nurses working in MH sector (per 100k)
  MH_13            Beds for MH in general hospitals (per 100k)
  MH_16            Beds in mental hospitals (per 100k)
  MH_4             Govt MH expenditure as % of total health expenditure
  SA_0000001688    Total alcohol per capita (15+) consumption (litres pure alcohol, SDG 3.5.2)
  SA_0000001462    Alcohol use disorders (15+) 12-month prevalence (%)

USAGE:
  python3 scripts/enrich_mental_health.py
"""

import json
import urllib.request
import sys
from pathlib import Path
from collections import defaultdict

REPO_ROOT = Path(__file__).resolve().parent.parent
BACKBONE_PATH = REPO_ROOT / "data" / "world_backbone.json"
GHO_BASE = "https://ghoapi.azureedge.net/api"

# ── Indicators ──────────────────────────────────────────────────

INDICATORS = [
    {"code": "MH_12",  "sex": "SEX_BTSX", "field": "suicide_rate_per100k",         "label": "Age-standardized suicide rate (both sexes)"},
    {"code": "MH_12",  "sex": "SEX_MLE",  "field": "suicide_rate_male_per100k",     "label": "Age-standardized suicide rate (male)"},
    {"code": "MH_12",  "sex": "SEX_FMLE", "field": "suicide_rate_female_per100k",   "label": "Age-standardized suicide rate (female)"},
    {"code": "MH_6",   "sex": None,       "field": "psychiatrists_per100k",         "label": "Psychiatrists per 100k"},
    {"code": "MH_9",   "sex": None,       "field": "psychologists_per100k",         "label": "Psychologists per 100k"},
    {"code": "MH_7",   "sex": None,       "field": "mental_health_nurses_per100k",  "label": "Mental health nurses per 100k"},
    {"code": "MH_13",  "sex": None,       "field": "mh_beds_general_hospital_per100k", "label": "MH beds in general hospitals per 100k"},
    {"code": "MH_16",  "sex": None,       "field": "mh_beds_mental_hospital_per100k",  "label": "Beds in mental hospitals per 100k"},
    {"code": "MH_4",   "sex": None,       "field": "govt_mh_expenditure_pct",       "label": "Govt MH expenditure % of total health"},
    {"code": "SA_0000001688", "sex": None, "field": "alcohol_per_capita_liters",     "label": "Total alcohol per capita 15+ (litres)"},
    {"code": "SA_0000001462", "sex": "SEX_BTSX", "field": "alcohol_use_disorders_pct", "label": "Alcohol use disorders prevalence %"},
]


def fetch_indicator(code: str) -> list[dict]:
    """Fetch all records for a WHO GHO indicator."""
    url = f"{GHO_BASE}/{code}"
    req = urllib.request.Request(url, headers={"User-Agent": "VFORX/1.0"})
    resp = urllib.request.urlopen(req, timeout=60)
    data = json.loads(resp.read())
    return data.get("value", data) if isinstance(data, dict) else data


def latest_by_country(records: list[dict], sex: str | None, target_iso3s: set[str]) -> dict[str, tuple]:
    """
    For each country, return the most recent record.
    Returns { iso3: (numeric_value, year) }.
    """
    # Group: iso3 → list of (year, value)
    best: dict[str, tuple[int, float]] = {}

    for r in records:
        sd = r.get("SpatialDim", "")
        # Only 3-letter codes are countries
        if len(sd) != 3 or sd not in target_iso3s:
            continue
        # Sex filter
        if sex is not None:
            if r.get("Dim1") != sex:
                continue
        else:
            # For non-sex indicators, just accept all
            pass

        year = r.get("TimeDim", 0)
        val = r.get("NumericValue")
        if val is None:
            # Try parsing Value string
            try:
                val = float(str(r.get("Value", "")).split()[0])
            except (ValueError, IndexError):
                continue

        if sd not in best or year > best[sd][0]:
            best[sd] = (year, float(val))

    return {iso3: (v[1], v[0]) for iso3, v in best.items()}


def main():
    # ── Load backbone ──
    print("Loading world_backbone.json...")
    backbone = json.loads(BACKBONE_PATH.read_text(encoding="utf-8"))
    countries = backbone["countries"]
    target_iso3s = {c["iso3"] for c in countries}
    print(f"  {len(countries)} countries")

    # ── Fetch each indicator ──
    # Cache indicator data to avoid re-fetching
    indicator_cache: dict[str, list[dict]] = {}
    field_data: dict[str, dict[str, tuple]] = {}  # field → { iso3 → (value, year) }

    for ind in INDICATORS:
        code = ind["code"]
        field = ind["field"]
        sex = ind["sex"]
        label = ind["label"]

        if code not in indicator_cache:
            print(f"  Fetching [{code}]...")
            indicator_cache[code] = fetch_indicator(code)

        records = indicator_cache[code]
        data = latest_by_country(records, sex, target_iso3s)
        field_data[field] = data
        print(f"    {label}: {len(data)} countries matched")

    # ── Build mental_health dimension for each country ──
    years_collected = defaultdict(list)

    for country in countries:
        iso3 = country["iso3"]
        mh = {}

        for ind in INDICATORS:
            field = ind["field"]
            data = field_data.get(field, {})
            entry = data.get(iso3)
            if entry:
                mh[field] = round(entry[0], 4)
                mh[f"_{field}_year"] = int(entry[1])
                years_collected[field].append(int(entry[1]))
            else:
                mh[field] = None
                mh[f"_{field}_year"] = None

        # Determine most common year for meta
        all_years = [v for k, v in mh.items() if k.endswith("_year") and v is not None]

        mh["_meta"] = {
            "sources": ["WHO Global Health Observatory (GHO)", "WHO Mental Health Atlas"],
            "year_range": f"{min(all_years)}-{max(all_years)}" if all_years else None,
            "suicide_rate_source": "MH_12 (age-standardized, per 100k)",
            "alcohol_source": "SA_0000001688 (SDG 3.5.2, litres pure alcohol)",
        }

        country["mental_health"] = mh

    # ── Update enrichments log ──
    if "enrichments" not in backbone:
        backbone["enrichments"] = []
    backbone["enrichments"].append({
        "source": "WHO Global Health Observatory (GHO) — mental health indicators",
        "date": "2026-08-08",
        "scope": "mental_health dimension: suicide rates, MH workforce (psychiatrists, psychologists, nurses), MH beds, government MH expenditure, alcohol consumption & disorders — all ~200 countries",
        "generalizable": True,
        "description": "Mental health data from WHO GHO API (MH_*, SA_* indicator series). Age-standardized suicide rates cover 190 countries; workforce/infrastructure indicators have partial coverage (78-146 countries).",
    })

    # ── Update metadata sources ──
    existing_sources = set(backbone["metadata"].get("sources", []))
    existing_sources.add("WHO Global Health Observatory (GHO)")
    backbone["metadata"]["sources"] = sorted(existing_sources)

    # ── Write ──
    print(f"\nWriting enriched backbone...")
    BACKBONE_PATH.write_text(
        json.dumps(backbone, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8"
    )

    size_mb = BACKBONE_PATH.stat().st_size / (1024 * 1024)
    print(f"Done. Size: {size_mb:.1f} MB")

    # ── Summary ──
    print("\n" + "=" * 70)
    print("MENTAL HEALTH ENRICHMENT SUMMARY")
    print("=" * 70)
    print(f"Countries: {len(countries)}")
    print(f"\nIndicator coverage (countries with non-null data):")
    for ind in INDICATORS:
        field = ind["field"]
        label = ind["label"]
        count = sum(1 for c in countries if c["mental_health"].get(field) is not None)
        pct = count / len(countries) * 100
        print(f"  {label}: {count}/{len(countries)} ({pct:.0f}%)")

    # Sample data for a few countries
    print("\nSample data:")
    for iso3 in ["BRA", "USA", "JPN", "AFG", "SWE"]:
        c = next((c for c in countries if c["iso3"] == iso3), None)
        if c:
            mh = c["mental_health"]
            print(f"\n  {iso3} ({c['name_en']}):")
            print(f"    Suicide rate: {mh.get('suicide_rate_per100k')} per 100k (M:{mh.get('suicide_rate_male_per100k')} F:{mh.get('suicide_rate_female_per100k')})")
            print(f"    Psychiatrists: {mh.get('psychiatrists_per100k')} / Psychologists: {mh.get('psychologists_per100k')} / MH Nurses: {mh.get('mental_health_nurses_per100k')}")
            print(f"    Beds (gen hosp): {mh.get('mh_beds_general_hospital_per100k')} / Beds (mental hosp): {mh.get('mh_beds_mental_hospital_per100k')}")
            print(f"    Govt MH exp %: {mh.get('govt_mh_expenditure_pct')}")
            print(f"    Alcohol/capita: {mh.get('alcohol_per_capita_liters')}L / AUD prevalence: {mh.get('alcohol_use_disorders_pct')}%")

    print("\n✅ Enrichment complete.")


if __name__ == "__main__":
    main()
