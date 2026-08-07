#!/usr/bin/env python3
"""
V FOR X — Generate public API JSON endpoints for static export.

Creates lightweight JSON files under out/api/ that serve as a
read-only data API:
  out/api/v1/index.json       — API metadata + endpoint list
  out/api/v1/countries.json   — All countries (iso3, name, region, key stats)
  out/api/v1/countries/{iso3}.json — Full country record
  out/api/v1/equations.json   — SDG equations
  out/api/v1/hotspots.json    — WFP hunger hotspots

Usage: python3 scripts/generate_api.py [--out out]
"""

import json
import os
import sys
from pathlib import Path


def main():
    project_root = Path(__file__).resolve().parent.parent
    backbone_path = project_root / "data" / "world_backbone.json"

    # Determine output dir
    out_dir = Path(sys.argv[sys.argv.index("--out") + 1]) if "--out" in sys.argv else project_root / "out"
    api_dir = out_dir / "api" / "v1"
    countries_dir = api_dir / "countries"

    # Create dirs
    api_dir.mkdir(parents=True, exist_ok=True)
    countries_dir.mkdir(parents=True, exist_ok=True)

    with open(backbone_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    metadata = data.get("metadata", {})
    total = len(data.get("countries", []))

    # 1. API index
    index = {
        "name": "V FOR X Public Data API",
        "version": "1.0",
        "license": metadata.get("license", "CC0"),
        "data_sync": metadata.get("created", ""),
        "total_countries": total,
        "endpoints": {
            "countries": "/api/v1/countries.json",
            "equations": "/api/v1/equations.json",
            "hotspots": "/api/v1/hotspots.json",
            "country_detail": "/api/v1/countries/{iso3}.json",
        },
        "documentation": "https://mouracleiton.github.io/v_for_x/the-archive/",
    }
    with open(api_dir / "index.json", "w", encoding="utf-8") as f:
        json.dump(index, f, separators=(",", ":"))

    # 2. Countries summary (lightweight — iso3, name, region, key stats only)
    countries_summary = []
    for c in data.get("countries", []):
        countries_summary.append({
            "iso3": c.get("iso3"),
            "name_en": c.get("name_en"),
            "name_pt": c.get("name_pt"),
            "region": c.get("region"),
            "subregion": c.get("subregion"),
            "population": c.get("demographics", {}).get("population"),
            "is_hotspot": c.get("is_hotspot", False),
            "undernourishment_pct": c.get("hunger", {}).get("undernourishment_pct"),
            "famine_risk": c.get("hunger", {}).get("famine_risk_1to5"),
            "conflict_intensity": c.get("conflict", {}).get("intensity_1to5"),
            "gdp_per_capita_usd": c.get("economy", {}).get("gdp_per_capita_usd"),
            "life_expectancy": c.get("health", {}).get("life_expectancy"),
            "literacy_rate_pct": c.get("education", {}).get("literacy_rate_pct"),
            "co2_per_capita_t": c.get("climate", {}).get("co2_per_capita_t"),
            "gini": c.get("inequality", {}).get("gini"),
            "detail_url": f"/api/v1/countries/{c.get('iso3')}.json",
        })
    with open(api_dir / "countries.json", "w", encoding="utf-8") as f:
        json.dump({"count": len(countries_summary), "countries": countries_summary}, f, separators=(",", ":"))

    # 3. Individual country detail files
    for c in data.get("countries", []):
        iso3 = c.get("iso3")
        with open(countries_dir / f"{iso3}.json", "w", encoding="utf-8") as f:
            json.dump(c, f, separators=(",", ":"))

    # 4. SDG equations
    if "sdg_equations" in data:
        with open(api_dir / "equations.json", "w", encoding="utf-8") as f:
            json.dump(data["sdg_equations"], f, separators=(",", ":"))

    # 5. Hotspots
    if "hotspots" in data:
        with open(api_dir / "hotspots.json", "w", encoding="utf-8") as f:
            json.dump(data["hotspots"], f, separators=(",", ":"))

    print(f"✓ API generated: {len(countries_summary)} countries → {api_dir}")


if __name__ == "__main__":
    main()
