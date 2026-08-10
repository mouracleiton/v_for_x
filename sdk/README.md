# V FOR X — Developer SDK

Programmatic access to **200 countries × ~87 fields** of open crisis data.
CC0-licensed. **No authentication, no rate limits** — it is static data.

Available in three flavors:

| Language | Package | Install |
|----------|---------|---------|
| JavaScript / TypeScript | `sdk/vforx.js` + `sdk/vforx.d.ts` | npm / direct download |
| Python | `sdk/python/` | pip / direct download |
| Raw JSON | `/api/v1/countries.json` | curl / any HTTP client |

---

## Installation

### npm (JavaScript / TypeScript)

```bash
npm install @vforx/sdk
# or copy sdk/vforx.js + sdk/vforx.d.ts into your project
```

```js
const { load } = require('./sdk/vforx.js');      // Node
// import { load } from './sdk/vforx.js';          // ES module / bundler
```

### pip (Python)

```bash
pip install vforx
# or copy the sdk/python/ folder onto your PYTHONPATH
```

```python
from vforx import VForX
```

### Direct download (any language)

```bash
curl -O https://mouracleiton.github.io/v_for_x/api/v1/countries.json
```

---

## Quick start

### JavaScript

```js
// Offline: bundle the data, no network needed
const sdk = await load({ data: myBundledCountries });

// Online: fetch from the GitHub Pages mirror
const sdk = await load();

// Look up a country
const { country } = sdk.getCountry('SDN');
console.log(country.hunger.prevalence_pct);   // → 53.3

// Search by name (any language)
const matches = sdk.search('苏丹');             // matches Sudan in Chinese

// Rank the biggest military spenders
const top5 = sdk.rank('military.expenditure_usd', { limit: 5 });

// Filter countries in crisis
const crisis = sdk.filter({ metrics: { 'hunger.prevalence_pct': { min: 30 } } });

// Global statistics
const s = sdk.stats('health.life_expectancy');
console.log(s.min, s.max, s.median);           // min, max, median life expectancy
```

### Python

```python
from vforx import VForX

vfx = VForX()                                   # loads bundled data

sudan = vfx.get_country("SDN")
print(sudan["hunger"]["prevalence_pct"])        # → 53.3

matches = vfx.search("苏丹")                      # search by any name

top5 = vfx.rank("military.expenditure_usd", limit=5)

crisis = vfx.filter(metrics={"hunger.prevalence_pct": {"min": 30}})

s = vfx.stats("health.life_expectancy")
print(s["min"], s["max"], s["median"])
```

---

## API reference

| Method | JS | Python | Returns |
|--------|----|--------|---------|
| Get one country | `getCountry(iso3)` | `get_country(iso3)` | country record / `None` |
| Search by name | `search(query)` | `search(query)` | matching countries |
| Compare countries | `compare(iso3List)` | `compare(iso3_list)` | matched countries |
| Filter by metric | `filter(options)` | `filter(...)` | matching countries |
| Rank by metric | `rank(metricKey, opts)` | `rank(metric_key, ...)` | ranked entries |
| Global statistics | `stats(metricKey)` | `stats(metric_key)` | min/max/mean/median |
| List all countries | `countries()` | `countries()` | lightweight summaries |

### `getCountry(iso3)`
Returns the full country record for an ISO3 code (e.g. `"BRA"`), or `null` /
`{ found: false }` if not found.

### `search(query)`
Case-insensitive substring match across all localized name fields and ISO
codes. Returns all matching countries.

### `compare(iso3List)`
Returns the full records for a list of ISO3 codes. Unknown codes are skipped.

### `filter(options)`
| Option | Type | Description |
|--------|------|-------------|
| `region` | `string` | Region substring, e.g. `"Africa"` |
| `metrics` | `object` | Map of dotted path → `{ min, max }` |
| `limit` | `number` | Cap on results |

```js
sdk.filter({
  region: 'Africa',
  metrics: { 'hunger.prevalence_pct': { min: 30 }, 'health.life_expectancy': { max: 65 } },
  limit: 20,
});
```

### `rank(metricKey, options)`
| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `direction` | `"asc" \| "desc"` | `"desc"` | Sort order |
| `limit` | `number` | `10` | Entries to return |

Returns `{ rank, iso3, name, value }` entries.

### `stats(metricKey)`
Returns `{ metric, min, max, mean, median, count, minCountry, maxCountry }`
across all countries that have a numeric value for the metric.

### `countries()`
Returns lightweight summaries: `{ iso3, iso2, name, region, population, is_hotspot }`.

---

## Metric paths

All methods accept **dotted metric paths**. Top-level dimensions:

```
iso3 · name_en · name_pt · iso2 · region · subregion · is_hotspot · population_m
hunger.* · conflict.* · economy.* · health.* · human_development.*
military.* · climate.* · inequality.* · water_sanitation.* · education.*
connectivity.* · migration.* · environment.* · gender.* · governance.*
security.* · poverty.* · employment.*
```

---

## Data dictionary

| Dimension | Key fields | Source |
|-----------|-----------|--------|
| **Hunger** (`hunger`) | `prevalence_pct`, `pop_acute_fi_m`, `child_stunting_pct`, `undernourishment_pct`, `famine_risk_1to5` | FAO / WFP |
| **Conflict** (`conflict`) | `intensity_1to5`, `displacement_m`, `battle_deaths_total` | UCDP / ACLED |
| **Economy** (`economy`) | `gdp_usd`, `gdp_per_capita_usd` | World Bank |
| **Health** (`health`) | `life_expectancy`, `child_mortality_under5_per1k`, `doctors_per_1000` | WHO / World Bank |
| **Human development** (`human_development`) | `hdi`, `hdi_category` | UNDP |
| **Military** (`military`) | `expenditure_usd`, `pct_gdp` | SIPRI |
| **Climate** (`climate`) | `co2_mt`, `co2_per_capita_t`, `ghg_total_mt` | Climate Watch / IEA |
| **Inequality** (`inequality`) | `gini` | World Bank |
| **Water & sanitation** (`water_sanitation`) | `basic_access_pct`, `safe_sanitation_pct` | WHO/UNICEF JMP |
| **Education** (`education`) | `literacy_rate_pct`, `primary_enrollment_pct`, `pisa_score` | UNESCO |
| **Connectivity** (`connectivity`) | `internet_users_pct`, `broadband_per100` | ITU / World Bank |
| **Migration** (`migration`) | `refugees_origin`, `refugees_hosted`, `forcibly_displaced`, `idps_disaster_new` | UNHCR / IDMC |
| **Environment** (`environment`) | `forest_area_pct`, `air_pollution_pm25_ugm3`, `renewable_energy_pct` | World Bank / WHO |
| **Gender** (`gender`) | `female_labor_force_pct`, `women_parliament_pct` | ILO / IPU |
| **Governance** (`governance`) | `corruption_perceptions_index`, `political_corruption_index`, `electoral_democracy_index` | Transparency Intl / V-Dem |
| **Security** (`security`) | `homicide_rate_per100k`, `femicides_per_year` | UNODC |
| **Poverty** (`poverty`) | `headcount_365_pct`, `headcount_685_pct` | World Bank |
| **Employment** (`employment`) | `unemployment_pct`, `youth_unemployment_pct`, `child_labor_m` | ILO |

> All field types are documented in `sdk/vforx.d.ts` and mirrored in the
> Python type hints.

---

## Rate limits

**None.** The data is static JSON hosted on GitHub Pages. There is no server,
no database, no API gateway, and no tracking. Fetch as often as you like — or
bundle the JSON and run entirely offline.

---

## Offline mode

Both SDKs run fully offline:

- **JavaScript:** pass `{ data: countriesArray }` to `load()` and no network
  request is ever made.
- **Python:** place a `countries.json` beside `vforx.py` (or in the package
  folder) and `VForX()` uses it without any HTTP call.

This makes V FOR X ideal for air-gapped environments, Tor hidden services,
and low-connectivity regions.

---

## License

- **Data:** [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/) — public domain.
- **SDK code:** CC0 / MIT-compatible — free to use, modify, and redistribute.

No warranty. The data is provided "as is" from the cited primary sources.
