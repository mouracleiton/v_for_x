#!/usr/bin/env python3
"""
V FOR X — Modular Data Enrichment Pipeline
============================================
Merges OpenRepublic Brazil deep-data (dados_api.json) into world_backbone.json.

PHILOSOPHY:
  - dados_api.json has rich Brazil-specific data (insecurity, tax burden, energy
    matrix, prison population, etc.) that world_backbone.json doesn't cover.
  - Many of these fields are internationally generalizable — the OECD/World Bank
    publishes them for all countries. We add the Brazil values from OpenRepublic
    and set other countries to null (to be filled by future data imports).
  - This creates a MODULAR schema: new dimensions/fields can be added without
    breaking existing pages. Pages already handle null gracefully.

NEW DIMENSIONS ADDED:
  1. justice         — prison population, pre-trial %, judicial efficiency
  2. energy          — renewable %, matrix breakdown, access gaps
  3. taxation        — tax burden % GDP, regressivity, structure
  4. food_security   — severe/moderate food insecurity, min wage context
  5. political       — electoral data, campaign finance (Brazil-specific seeds)

NEW FIELDS IN EXISTING DIMENSIONS:
  - health: doctors_per_1000, nurses_per_1000, hospital_beds_per_1000
  - education: pisa_score, functional_illiteracy_pct
  - security: femicides_per_year, killings_by_police, prison_population, pre_trial_pct
  - environment: deforestation_km2, pesticide_use_tons
  - employment: informality_pct, median_income_usd, child_labor_m

USAGE:
  python3 scripts/enrich_backbone.py
"""

import json
import copy
import os
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).resolve().parent.parent
BACKBONE_PATH = REPO_ROOT / "data" / "world_backbone.json"
OPENREP_PATH = Path("/home/shadowghost/project/open-republic-website/dados_api.json")
OUTPUT_PATH = REPO_ROOT / "data" / "world_backbone.json"  # overwrite in-place

# ── Load data ──────────────────────────────────────────────────
print("Loading world_backbone.json...")
backbone = json.loads(BACKBONE_PATH.read_text(encoding="utf-8"))

print("Loading dados_api.json (OpenRepublic)...")
openrep = json.loads(OPENREP_PATH.read_text(encoding="utf-8"))


# ═══════════════════════════════════════════════════════════════
# STEP 1: Define the new schema additions
# ═══════════════════════════════════════════════════════════════

NEW_DIMENSIONS = {
    "justice": {
        "prison_population": None,
        "prison_rate_per_100k": None,
        "pre_trial_pct": None,
        "prison_overcrowding_pct": None,
        "judicial_efficiency_cases_backlog": None,
        "rule_of_law_index": None,
        "_meta": {"sources": ["CNJ", "World Justice Project", "UNODC"], "year": None},
    },
    "energy": {
        "renewable_matrix_pct": None,
        "renewable_electric_pct": None,
        "hydroelectric_pct": None,
        "wind_pct": None,
        "solar_pct": None,
        "fossil_electric_pct": None,
        "nuclear_pct": None,
        "no_access_electricity_m": None,
        "_meta": {"sources": ["EPE", "IEA", "World Bank"], "year": None},
    },
    "taxation": {
        "tax_burden_pct_gdp": None,
        "consumption_tax_pct": None,
        "income_tax_pct": None,
        "property_tax_pct": None,
        "tax_revenue_total_usd": None,
        "_meta": {"sources": ["OECD", "IMF", "World Bank"], "year": None},
    },
    "food_security": {
        "severe_food_insecurity_m": None,
        "total_food_insecurity_m": None,
        "min_wage_usd": None,
        "min_wage_needed_usd": None,
        "food_cost_affordability_ratio": None,
        "_meta": {"sources": ["FAO", "ILO", "DIEESE"], "year": None},
    },
}

NEW_FIELDS_EXISTING = {
    "health": {
        "doctors_per_1000": None,
        "nurses_per_1000": None,
        "hospital_beds_per_1000": None,
    },
    "education": {
        "pisa_score": None,
        "functional_illiteracy_pct": None,
    },
    "security": {
        "femicides_per_year": None,
        "killings_by_police": None,
        "prison_population": None,
        "pre_trial_pct": None,
        "prison_rate_per_100k": None,
    },
    "environment": {
        "deforestation_km2": None,
        "pesticide_use_tons": None,
    },
    "employment": {
        "informality_pct": None,
        "median_income_usd": None,
        "child_labor_m": None,
    },
}


# ═══════════════════════════════════════════════════════════════
# STEP 2: Extract Brazil values from OpenRepublic
# ═══════════════════════════════════════════════════════════════

def parse_num(s):
    """Extract the first numeric value from a string like '~720.000' or 'R$ 1.518'."""
    if isinstance(s, (int, float)):
        return float(s)
    if s is None:
        return None
    import re
    # Remove currency symbols, spaces, and extract number
    cleaned = re.sub(r'[RrUu][Ss$]\s*', '', str(s))
    cleaned = cleaned.replace('~', '').replace(' ', '')
    # Match number with comma or dot as decimal
    match = re.search(r'[\d.,]+', cleaned)
    if not match:
        return None
    num_str = match.group()
    # Brazilian format: 1.518 = 1518, 0,52 = 0.52
    if ',' in num_str and '.' in num_str:
        num_str = num_str.replace('.', '').replace(',', '.')
    elif ',' in num_str:
        parts = num_str.split(',')
        if len(parts) == 2 and len(parts[1]) <= 2:
            num_str = parts[0].replace('.', '') + '.' + parts[1]
        else:
            num_str = num_str.replace(',', '')
    try:
        return float(num_str)
    except ValueError:
        return None


# Health
hs = openrep["saude_detalhada"]["resumo"]
bra_health_new = {
    "doctors_per_1000": parse_num(hs.get("medicos_por_mil_habitantes")),
    "nurses_per_1000": parse_num(hs.get("enfermeiros_por_mil")),
    "hospital_beds_per_1000": parse_num(hs.get("leitos_sus_por_mil")),
}

# Education
ed = openrep["educacao_detalhada"]["resumo"]
bra_education_new = {
    "pisa_score": parse_num(ed.get("pisa_brasil")),
    "functional_illiteracy_pct": parse_num(ed.get("analfabetismo_funcional")),
}

# Security
se = openrep["violencia_detalhada"]["resumo"]
bra_security_new = {
    "femicides_per_year": parse_num(se.get("feminicidio_2023")),
    "killings_by_police": parse_num(se.get("morte_por_policia_2023")),
    "prison_population": parse_num(se.get("encarceramento_pop_2024")) or 900000,
    "pre_trial_pct": 30.0,
    "prison_rate_per_100k": 350.0,  # from OCDE comparison
}

# Environment
en = openrep["ambiente_detalhado"]["resumo"]
bra_environment_new = {
    "deforestation_km2": parse_num(en.get("desmatamento_amazonia_2023")),
    "pesticide_use_tons": parse_num(en.get("agrotoxicos_uso_2023")),
}

# Employment / Income
tr = openrep["trabalho_renda"]["resumo"]
bra_employment_new = {
    "informality_pct": parse_num(tr.get("informalidade")),
    "median_income_usd": None,  # R$ 1.600 — needs FX conversion, leave null
    "child_labor_m": parse_num(tr.get("trabalho_infantil")),
}

# Justice
ju = openrep["sistema_justica"]["resumo"]
bra_justice = {
    "prison_population": parse_num(ju.get("populacao_prisional")),
    "prison_rate_per_100k": 350.0,
    "pre_trial_pct": 30.0,
    "prison_overcrowding_pct": 29.0,
    "judicial_efficiency_cases_backlog": 80_000_000,
    "rule_of_law_index": None,
    "_meta": {"sources": ["CNJ", "World Justice Project", "UNODC"], "year": 2024},
}

# Energy
eng = openrep["energia_detalhada"]["resumo"]
bra_energy = {
    "renewable_matrix_pct": parse_num(eng.get("matriz_energetica_renovavel_pct")),
    "renewable_electric_pct": parse_num(eng.get("matriz_eletrica_renovavel_pct")),
    "hydroelectric_pct": parse_num(eng.get("hidreletrica_pct_geracao")),
    "wind_pct": parse_num(eng.get("eolica_pct")),
    "solar_pct": parse_num(eng.get("solar_pct")),
    "fossil_electric_pct": parse_num(eng.get("gas_carvao_termica_pct")),
    "nuclear_pct": parse_num(eng.get("nuclear_pct")),
    "no_access_electricity_m": parse_num(eng.get("sem_acesso_energia_eletrica")),
    "_meta": {"sources": ["EPE", "ONS", "MME", "ANEEL"], "year": 2024},
}

# Taxation
tx = openrep["tributacao"]["resumo"]
bra_taxation = {
    "tax_burden_pct_gdp": parse_num(tx.get("carga_tributaria_pct_pib")),
    "consumption_tax_pct": parse_num(tx.get("impostos_consumo_pct")),
    "income_tax_pct": parse_num(tx.get("impostos_renda_pct")),
    "property_tax_pct": parse_num(tx.get("impostos_patrimonio_pct")),
    "tax_revenue_total_usd": None,  # R$ 2.65T — needs FX, leave null
    "_meta": {"sources": ["Receita Federal", "OECD", "IMF"], "year": 2024},
}

# Food security
fs = openrep["seguranca_alimentar_detalhada"]["resumo"]
bra_food_security = {
    "severe_food_insecurity_m": parse_num(fs.get("fome_inseguranca_grave_2024")),
    "total_food_insecurity_m": 70.0,  # from resumo
    "min_wage_usd": None,  # R$ 1.518 — needs FX
    "min_wage_needed_usd": None,  # R$ 7.107 — needs FX
    "food_cost_affordability_ratio": 4.68,
    "_meta": {"sources": ["IBGE PNAD", "Rede PENSSAN", "DIEESE"], "year": 2024},
}

BRA_OVERRIDES_NEW_DIMENSIONS = {
    "justice": bra_justice,
    "energy": bra_energy,
    "taxation": bra_taxation,
    "food_security": bra_food_security,
}

BRA_OVERRIDES_EXISTING = {
    "health": bra_health_new,
    "education": bra_education_new,
    "security": bra_security_new,
    "environment": bra_environment_new,
    "employment": bra_employment_new,
}


# ═══════════════════════════════════════════════════════════════
# STEP 3: Apply the enrichment to all countries
# ═══════════════════════════════════════════════════════════════

print(f"\nEnriching {len(backbone['countries'])} countries...")

for country in backbone["countries"]:
    iso3 = country["iso3"]

    # ── Add new dimensions (null for all, Brazil gets real data) ──
    for dim_name, dim_template in NEW_DIMENSIONS.items():
        if dim_name not in country:
            if iso3 == "BRA" and dim_name in BRA_OVERRIDES_NEW_DIMENSIONS:
                country[dim_name] = copy.deepcopy(BRA_OVERRIDES_NEW_DIMENSIONS[dim_name])
            else:
                country[dim_name] = copy.deepcopy(dim_template)

    # ── Add new fields to existing dimensions ──
    for dim_name, fields in NEW_FIELDS_EXISTING.items():
        if dim_name in country:
            for field_name, default_val in fields.items():
                if field_name not in country[dim_name]:
                    if iso3 == "BRA" and dim_name in BRA_OVERRIDES_EXISTING:
                        country[dim_name][field_name] = BRA_OVERRIDES_EXISTING[dim_name].get(field_name, default_val)
                    else:
                        country[dim_name][field_name] = default_val

    # ── Fix inequality.gini_year inconsistency ──
    if "inequality" in country:
        if "gini_year" not in country["inequality"] and "year" in country["inequality"]:
            country["inequality"]["gini_year"] = country["inequality"]["year"]

# ── Update metadata ──
backbone["metadata"]["schema_version"] = backbone["metadata"].get("schema_version", "1.0") + "+openrep"
existing_sources = set(backbone["metadata"].get("sources", []))
new_sources = ["CNJ", "EPE (Balanço Energético Nacional)", "Receita Federal", "DIEESE",
               "Atlas da Violência", "INEP", "MapBiomas"]
backbone["metadata"]["sources"] = sorted(existing_sources | set(new_sources))

# ── Update metadata.total_countries (shouldn't change) ──
backbone["metadata"]["total_countries"] = len(backbone["countries"])

# ── Add enrichment provenance ──
if "enrichments" not in backbone:
    backbone["enrichments"] = []
backbone["enrichments"].append({
    "source": "OpenRepublic dados_api.json",
    "date": "2025-08-07",
    "scope": "BRA deep-data: justice, energy, taxation, food_security + health/education/security/environment/employment field additions",
    "generalizable": True,
    "description": "Brazil-specific deep data added. All other countries have null values for new fields, ready for future enrichment from OECD/World Bank/IEA sources.",
})


# ═══════════════════════════════════════════════════════════════
# STEP 4: Write output
# ═══════════════════════════════════════════════════════════════

print(f"\nWriting enriched backbone to {OUTPUT_PATH}...")
OUTPUT_PATH.write_text(json.dumps(backbone, ensure_ascii=False, indent=None, separators=(",", ":")), encoding="utf-8")

new_size = OUTPUT_PATH.stat().st_size / 1024
print(f"Done. New size: {new_size:.0f} KB")

# Summary
print("\n" + "=" * 60)
print("ENRICHMENT SUMMARY")
print("=" * 60)
print(f"Countries: {len(backbone['countries'])}")
print(f"\nNew dimensions added (4):")
for d in NEW_DIMENSIONS:
    bra_val = backbone["countries"][31]  # BRA index
    print(f"  {d}: BRA has {sum(1 for v in bra_val.get(d, {}).values() if v is not None and not isinstance(v, dict))} non-null fields")
print(f"\nNew fields in existing dimensions:")
for dim, fields in NEW_FIELDS_EXISTING.items():
    bra_val = backbone["countries"][31][dim]
    non_null = sum(1 for f in fields if bra_val.get(f) is not None)
    print(f"  {dim}: +{len(fields)} fields ({non_null} filled for BRA)")

# Verify BRA
bra = [c for c in backbone["countries"] if c["iso3"] == "BRA"][0]
print(f"\nBRA new dimensions present: {[d for d in NEW_DIMENSIONS if d in bra]}")
print(f"BRA justice.prison_population: {bra['justice']['prison_population']}")
print(f"BRA energy.renewable_electric_pct: {bra['energy']['renewable_electric_pct']}")
print(f"BRA taxation.tax_burden_pct_gdp: {bra['taxation']['tax_burden_pct_gdp']}")
print(f"BRA food_security.severe_food_insecurity_m: {bra['food_security']['severe_food_insecurity_m']}")
print(f"BRA health.doctors_per_1000: {bra['health']['doctors_per_1000']}")
print(f"BRA education.pisa_score: {bra['education']['pisa_score']}")
print(f"BRA security.prison_population: {bra['security']['prison_population']}")
