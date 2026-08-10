"""
V FOR X — Python SDK
====================
Open data for 200 countries × ~87 fields. CC0 license. No auth, no rate limits
— it is static data.

Works offline (bundled JSON) or online (fetched from the GitHub Pages mirror).

Quick start
-----------
::

    from vforx import VForX

    vfx = VForX()                      # loads bundled data
    sudan = vfx.get_country("SDN")     # full country record
    top10 = vfx.rank("military.expenditure_usd", limit=10)
    crisis = vfx.filter(metrics={"hunger.prevalence_pct": {"min": 30}})

License: CC0-1.0
"""

from __future__ import annotations

import json
import os
import statistics
from typing import Any, Dict, List, Optional

__version__ = "1.0.0"
__all__ = ["VForX"]

#: Default remote dataset URL (GitHub Pages static export).
REMOTE_URL = "https://mouracleiton.github.io/v_for_x/api/v1/countries.json"


class VForX:
    """Developer SDK for the V FOR X country dataset.

    Parameters
    ----------
    data:
        Pre-loaded list of country dicts (offline mode). If omitted the
        SDK loads the bundled ``countries.json`` next to this module, and
        falls back to fetching :data:`REMOTE_URL` if the bundle is absent.
    url:
        Alternate remote URL to fetch data from.
    """

    def __init__(
        self,
        data: Optional[List[Dict[str, Any]]] = None,
        url: str = REMOTE_URL,
    ) -> None:
        countries = data
        if countries is None:
            countries = self._load_local()
        if countries is None:
            countries = self._load_remote(url)
        self._countries: List[Dict[str, Any]] = countries
        self._index: Dict[str, Dict[str, Any]] = {
            c["iso3"]: c for c in countries
        }

    # ── Loading helpers ──────────────────────────────────────

    @staticmethod
    def _load_local() -> Optional[List[Dict[str, Any]]]:
        """Load the bundled ``countries.json`` shipped beside this module."""
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "countries.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as fh:
                payload = json.load(fh)
            return payload.get("countries", payload) if isinstance(payload, dict) else payload
        return None

    @staticmethod
    def _load_remote(url: str) -> List[Dict[str, Any]]:
        """Fetch the dataset from a remote URL using urllib (no third-party deps)."""
        try:
            from urllib.request import urlopen
        except ImportError as exc:  # pragma: no cover
            raise RuntimeError("urllib is required to fetch remote data") from exc
        with urlopen(url) as resp:  # noqa: S310 — user-supplied URL by design
            payload = json.loads(resp.read().decode("utf-8"))
        return payload.get("countries", payload) if isinstance(payload, dict) else payload

    # ── Internal helpers ─────────────────────────────────────

    @staticmethod
    def _resolve_metric(obj: Dict[str, Any], path: str) -> Any:
        """Resolve a dotted metric path, e.g. ``hunger.prevalence_pct``."""
        cur: Any = obj
        for part in path.split("."):
            if not isinstance(cur, dict):
                return None
            cur = cur.get(part)
        return cur

    @staticmethod
    def _name_of(c: Dict[str, Any]) -> str:
        return c.get("name_en") or c.get("name_pt") or c["iso3"]

    # ── Public API ───────────────────────────────────────────

    @property
    def data(self) -> Dict[str, Any]:
        """The full dataset wrapper."""
        return {"countries": self._countries}

    def get_country(self, iso3: str) -> Optional[Dict[str, Any]]:
        """Get a single country by ISO3 code (e.g. ``"BRA"``).

        Returns the full country record or ``None`` if not found.
        """
        return self._index.get(iso3.upper())

    def search(self, query: str) -> List[Dict[str, Any]]:
        """Search countries by name across all available languages.

        Case-insensitive substring match. Returns the matching countries.
        """
        if not query:
            return []
        q = query.lower()
        name_fields = (
            "name_en", "name_pt", "name_es", "name_fr", "name_zh",
            "name_ja", "name_ko", "name_hi", "name_ar", "name_ru",
            "iso3", "iso2",
        )
        results: List[Dict[str, Any]] = []
        for c in self._countries:
            haystack = " ".join(
                str(c[f]) for f in name_fields if c.get(f) is not None
            ).lower()
            if q in haystack:
                results.append(c)
        return results

    def compare(self, iso3_list: List[str]) -> List[Dict[str, Any]]:
        """Compare multiple countries side by side.

        Unknown ISO3 codes are silently skipped.
        """
        return [
            self._index[code.upper()]
            for code in iso3_list
            if code.upper() in self._index
        ]

    def filter(
        self,
        region: Optional[str] = None,
        metrics: Optional[Dict[str, Dict[str, float]]] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """Filter countries by region and/or metric ranges.

        Parameters
        ----------
        region:
            Region substring, e.g. ``"Africa"``.
        metrics:
            Mapping of dotted path -> ``{"min": x, "max": y}``.
        limit:
            Maximum number of results.

        Returns the matching countries.
        """
        region_l = region.lower() if region else None
        metrics = metrics or {}
        out: List[Dict[str, Any]] = []
        for c in self._countries:
            if region_l and region_l not in (c.get("region") or "").lower():
                continue
            keep = True
            for key, rng in metrics.items():
                val = self._resolve_metric(c, key)
                if val is None:
                    keep = False
                    break
                if rng.get("min") is not None and val < rng["min"]:
                    keep = False
                    break
                if rng.get("max") is not None and val > rng["max"]:
                    keep = False
                    break
            if keep:
                out.append(c)
        if limit is not None:
            out = out[:limit]
        return out

    def rank(
        self,
        metric_key: str,
        direction: str = "desc",
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Rank countries by a metric.

        Parameters
        ----------
        metric_key:
            Dotted path, e.g. ``"military.expenditure_usd"``.
        direction:
            ``"asc"`` (smallest first) or ``"desc"`` (largest first, default).
        limit:
            Number of entries to return.

        Returns a list of ``{"rank", "iso3", "name", "value"}`` dicts.
        """
        reverse = direction != "asc"
        rows = [
            {"iso3": c["iso3"], "name": self._name_of(c), "value": val}
            for c in self._countries
            if (val := self._resolve_metric(c, metric_key)) is not None
            and isinstance(val, (int, float))
        ]
        rows.sort(key=lambda r: r["value"], reverse=reverse)
        top = rows[:limit]
        for i, row in enumerate(top):
            row["rank"] = i + 1
        return top

    def stats(self, metric_key: str) -> Dict[str, Any]:
        """Compute global statistics for a metric across all countries.

        Returns ``{"metric", "min", "max", "mean", "median", "count",
        "min_country", "max_country"}``.
        """
        pairs = [
            (self._resolve_metric(c, metric_key), c["iso3"])
            for c in self._countries
        ]
        numeric = [(v, iso) for v, iso in pairs if isinstance(v, (int, float))]
        if not numeric:
            return {
                "metric": metric_key, "min": 0, "max": 0, "mean": 0,
                "median": 0, "count": 0, "min_country": "", "max_country": "",
            }
        values = [v for v, _ in numeric]
        min_val = min(values)
        max_val = max(values)
        min_iso = next(iso for v, iso in numeric if v == min_val)
        max_iso = next(iso for v, iso in numeric if v == max_val)
        return {
            "metric": metric_key,
            "min": min_val,
            "max": max_val,
            "mean": statistics.fmean(values),
            "median": statistics.median(values),
            "count": len(values),
            "min_country": min_iso,
            "max_country": max_iso,
        }

    def countries(self) -> List[Dict[str, Any]]:
        """List all countries with lightweight summary info.

        Returns ``{"iso3", "iso2", "name", "region", "population",
        "is_hotspot"}`` dicts.
        """
        out: List[Dict[str, Any]] = []
        for c in self._countries:
            pop = c.get("demographics", {}).get("population") if isinstance(c.get("demographics"), dict) else None
            if pop is None:
                pop = c.get("population_m", 0) * 1_000_000
            out.append({
                "iso3": c["iso3"],
                "iso2": c.get("iso2", ""),
                "name": self._name_of(c),
                "region": c.get("region", ""),
                "population": pop,
                "is_hotspot": bool(c.get("is_hotspot")),
            })
        return out
