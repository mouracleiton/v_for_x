/*!
 * V FOR X — Developer SDK (UMD)
 * Open data for 200 countries × ~87 fields. CC0. No auth, no rate limits.
 *
 * Works in the browser (as window.VForX) and in Node.js (module.exports).
 * Data is either bundled or fetched live from the GitHub Pages mirror.
 *
 * @license CC0-1.0
 * @version  1.0.0
 */
(function (root, factory) {
  if (typeof define === "function" && define.amd) {
    // AMD
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    // CommonJS / Node
    module.exports = factory();
  } else {
    // Browser global
    root.VForX = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /** @type {string} Remote dataset URL (GitHub Pages static export). */
  var REMOTE_URL =
    "https://mouracleiton.github.io/v_for_x/api/v1/countries.json";

  /**
   * Resolve a dotted metric path on a country object.
   * e.g. resolveMetric(country, "hunger.prevalence_pct")
   * @private
   */
  function resolveMetric(obj, path) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  /** Pick the best display name for a country. @private */
  function nameOf(c) {
    return c.name_en || c.name_pt || c.iso3;
  }

  /** Create the SDK bound to a given countries array. @private */
  function create(countries) {
    var idx = {};
    for (var i = 0; i < countries.length; i++) idx[countries[i].iso3] = countries[i];

    var api = {
      /** The full dataset. */
      data: { countries: countries },

      /**
       * Get a single country by its ISO3 code.
       * @param {string} iso3 - e.g. "BRA", "USA", "SDN"
       * @returns {{found:boolean, country?:object}}
       */
      getCountry: function (iso3) {
        var c = idx[(iso3 || "").toUpperCase()];
        return c ? { found: true, country: c } : { found: false };
      },

      /**
       * Search countries by name across all available languages.
       * Case-insensitive substring match.
       * @param {string} query - e.g. "brazil", "苏丹", "soudan"
       * @returns {object[]} matching countries
       */
      search: function (query) {
        if (!query) return [];
        var q = String(query).toLowerCase();
        var out = [];
        for (var i = 0; i < countries.length; i++) {
          var c = countries[i];
          var haystack = [c.name_en, c.name_pt, c.name_es, c.name_fr, c.name_zh, c.name_ja, c.name_ko, c.name_hi, c.name_ar, c.name_ru, c.iso3, c.iso2]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (haystack.indexOf(q) !== -1) out.push(c);
        }
        return out;
      },

      /**
       * Compare multiple countries side by side.
       * Unknown ISO3 codes are silently skipped.
       * @param {string[]} iso3List - e.g. ["BRA", "USA", "CHN"]
       * @returns {object[]} the matched countries
       */
      compare: function (iso3List) {
        var out = [];
        for (var i = 0; i < iso3List.length; i++) {
          var c = idx[(iso3List[i] || "").toUpperCase()];
          if (c) out.push(c);
        }
        return out;
      },

      /**
       * Filter countries by region and/or metric ranges.
       * @param {object} options
       * @param {string} [options.region] - region substring, e.g. "Africa"
       * @param {object} [options.metrics] - map of "dotted.path" -> {min?, max?}
       * @param {number} [options.limit] - max results
       * @returns {object[]} matching countries
       */
      filter: function (options) {
        options = options || {};
        var region = options.region ? options.region.toLowerCase() : null;
        var metrics = options.metrics || {};
        var metricKeys = Object.keys(metrics);
        var out = [];
        for (var i = 0; i < countries.length; i++) {
          var c = countries[i];
          if (region && (c.region || "").toLowerCase().indexOf(region) === -1) continue;
          var ok = true;
          for (var m = 0; m < metricKeys.length; m++) {
            var key = metricKeys[m];
            var range = metrics[key];
            var val = resolveMetric(c, key);
            if (val == null) {
              ok = false;
              break;
            }
            if (range.min != null && val < range.min) {
              ok = false;
              break;
            }
            if (range.max != null && val > range.max) {
              ok = false;
              break;
            }
          }
          if (ok) out.push(c);
        }
        if (options.limit && out.length > options.limit) out.length = options.limit;
        return out;
      },

      /**
       * Rank countries by a metric.
       * @param {string} metricKey - dotted path, e.g. "military.expenditure_usd"
       * @param {object} [opts]
       * @param {"asc"|"desc"} [opts.direction="desc"] - sort order
       * @param {number} [opts.limit=10] - number of entries to return
       * @returns {{rank:number, iso3:string, name:string, value:number}[]}
       */
      rank: function (metricKey, opts) {
        opts = opts || {};
        var direction = opts.direction === "asc" ? "asc" : "desc";
        var limit = opts.limit || 10;
        var rows = [];
        for (var i = 0; i < countries.length; i++) {
          var c = countries[i];
          var val = resolveMetric(c, metricKey);
          if (val != null && typeof val === "number") {
            rows.push({ iso3: c.iso3, name: nameOf(c), value: val });
          }
        }
        rows.sort(function (a, b) {
          return direction === "asc" ? a.value - b.value : b.value - a.value;
        });
        var top = rows.slice(0, limit);
        for (var j = 0; j < top.length; j++) top[j].rank = j + 1;
        return top;
      },

      /**
       * Compute global statistics for a metric across all countries
       * that have a numeric value for it.
       * @param {string} metricKey - dotted path
       * @returns {{metric:string, min:number, max:number, mean:number, median:number, count:number, minCountry:string, maxCountry:string}}
       */
      stats: function (metricKey) {
        var vals = [];
        var withCountry = [];
        for (var i = 0; i < countries.length; i++) {
          var c = countries[i];
          var val = resolveMetric(c, metricKey);
          if (val != null && typeof val === "number") {
            vals.push(val);
            withCountry.push({ val: val, iso3: c.iso3 });
          }
        }
        if (vals.length === 0) {
          return { metric: metricKey, min: 0, max: 0, mean: 0, median: 0, count: 0, minCountry: "", maxCountry: "" };
        }
        vals.sort(function (a, b) {
          return a - b;
        });
        var sum = 0;
        for (var s = 0; s < vals.length; s++) sum += vals[s];
        var min = vals[0];
        var max = vals[vals.length - 1];
        var mid = Math.floor(vals.length / 2);
        var median = vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
        var minIso = "";
        var maxIso = "";
        for (var w = 0; w < withCountry.length; w++) {
          if (withCountry[w].val === min) minIso = withCountry[w].iso3;
          if (withCountry[w].val === max) maxIso = withCountry[w].iso3;
        }
        return {
          metric: metricKey,
          min: min,
          max: max,
          mean: sum / vals.length,
          median: median,
          count: vals.length,
          minCountry: minIso,
          maxCountry: maxIso,
        };
      },

      /**
       * List all countries with lightweight summary info.
       * @returns {{iso3:string, iso2:string, name:string, region:string, population:number, is_hotspot:boolean}[]}
       */
      countries: function () {
        var out = [];
        for (var i = 0; i < countries.length; i++) {
          var c = countries[i];
          out.push({
            iso3: c.iso3,
            iso2: c.iso2,
            name: nameOf(c),
            region: c.region,
            population: c.demographics ? c.demographics.population : c.population_m * 1e6,
            is_hotspot: !!c.is_hotspot,
          });
        }
        return out;
      },
    };

    return api;
  }

  /**
   * Load the dataset. Uses bundled data if provided, otherwise fetches
   * from the GitHub Pages mirror.
   *
   * @param {object} [options]
   * @param {object[]} [options.data] - pre-bundled countries array (offline mode)
   * @param {string} [options.url] - alternate fetch URL
   * @param {function} [callback] - node-style (err, sdk) callback; if omitted returns a Promise
   * @returns {Promise<object>|void}
   */
  function load(options, callback) {
    options = options || {};
    var cb = typeof options === "function" ? options : callback;
    if (options.data) {
      var sdk = create(options.data);
      if (cb) return cb(null, sdk);
      return Promise.resolve(sdk);
    }
    var url = options.url || REMOTE_URL;
    var promise = fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error("VForX: HTTP " + r.status + " fetching " + url);
        return r.json();
      })
      .then(function (json) {
        var countries = json.countries || json;
        return create(countries);
      });
    if (cb) {
      promise.then(
        function (sdk) {
          cb(null, sdk);
        },
        function (err) {
          cb(err);
        },
      );
      return;
    }
    return promise;
  }

  // Export a load() entry point. Once loaded, the returned object is the full SDK.
  return { load: load, REMOTE_URL: REMOTE_URL };
});
