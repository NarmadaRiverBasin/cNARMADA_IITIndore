/*
 * chart_level_note.js — AUDIT_FIX_PROMPT.md item 0C part 2 (2026-09-14).
 *
 * THE BUG THIS EXISTS TO FIX, reproduced live before writing a line of it:
 * select Madhya Pradesh -> Jabalpur -> block Sihora -> village Agariya and
 * the Rainfall, Temperature, Trends and NDVI Trend panes keep drawing the
 * DISTRICT's series, byte-identical, with nothing anywhere on screen saying
 * so. Measured: Rainfall stayed [183, 441.9, 394.4] and NDVI stayed 278
 * points labelled "NDVI JABALPUR" at all three levels. That is exactly the
 * silent parent-level fallback CLAUDE.md's STANDING ORDERS #6 and item 0C
 * forbid ("kabhi khali ya bana hua number mat dikhao ... saaf label ke saath
 * ki kis star ka hai").
 *
 * The right-panel Climate Metrics cards ALREADY handle this correctly, via
 * national_selector.js's climateLevelSuffix() and index.html's
 * onVillageChange -- that half was verified in the 2026-09-14 re-audit. Only
 * the four bottom chart panes were missed. This module closes that gap and
 * deliberately reuses the SAME climateLevelSuffix() vocabulary rather than
 * inventing a second, possibly-disagreeing wording for the same idea.
 *
 * WHAT IS AND IS NOT AVAILABLE PER LEVEL (read off the actual data files,
 * not assumed -- see also village_report.js's own header, which reached the
 * same conclusion independently):
 *   - District: the only level with a chart-able SERIES. Monthly rain/temp
 *     and the 25-year annual trends come from mp_climate_data.json .charts
 *     (keyed by district); DiCRA NDVI from dicra_ndvi.json .districts.
 *   - Block: NO climate source of any kind. Nothing in this project computes
 *     a block-tier climate value (block-tier real data exists only for SMAP
 *     soil moisture and CGWB groundwater, neither of which these 4 panes
 *     show).
 *   - Village: NO series, but a genuine per-village IMD sample DOES exist in
 *     mp_climate_data.json .districts.<d>.villages.<lgd>.indices (1,429
 *     villages in Jabalpur alone) -- single 2000-2024 values, not a series.
 *     Where one exists this module states it, explicitly marked as the
 *     village-level reading, so the user is not left thinking the district
 *     line is all there is.
 *
 * This file adds NO data and computes NO new number. It only names the level
 * of what is already drawn, and surfaces a real village value that was
 * already in the payload.
 */
(function () {
  'use strict';

  // canvasId -> how to describe that pane, and which real per-village index
  // (if any) corresponds to what the chart plots.
  var PANES = [
    {
      canvas: 'chartRain',
      metric: 'rainfall',
      source: 'IMD 0.05° gridded daily via village-centroid sample',
      resolution: '~5.5 km grid, district monthly aggregate',
      years: '2000–2024',
      villageIdx: [{ key: 'annual_rain_mm', label: 'annual rainfall', unit: ' mm', dp: 0 }]
    },
    {
      canvas: 'chartTemp',
      metric: 'temperature',
      source: 'IMD 0.05° gridded daily via village-centroid sample',
      resolution: '~5.5 km grid, district monthly aggregate',
      years: '2000–2024',
      villageIdx: [{ key: 'max_summer_tmax', label: 'max summer Tmax', unit: ' °C', dp: 1 }]
    },
    {
      canvas: 'chartTrends',
      metric: 'annual trend',
      source: 'IMD 0.05° gridded daily via village-centroid sample',
      resolution: '~5.5 km grid, district annual aggregate',
      years: '2000–2024',
      villageIdx: [
        { key: 'heatwave_days', label: 'heatwave days/yr', unit: '', dp: 1 },
        { key: 'annual_rain_mm', label: 'annual rainfall', unit: ' mm', dp: 0 },
        { key: 'spi_12', label: 'SPI-12', unit: '', dp: 2 }
      ]
    },
    {
      canvas: 'chartNdvi',
      metric: 'NDVI',
      source: 'UNDP DiCRA (MODIS MOD13Q1)',
      resolution: '250 m pixels, district zonal mean',
      years: '2013–2026',
      // Deliberately empty: no village- or block-level NDVI is computed
      // anywhere in this project. docs/METHODOLOGY.md Sec 7 says so, and a
      // village NDVI number must NOT be conjured from the district zonal
      // mean just to fill this line.
      villageIdx: []
    }
  ];

  function el(id) { return document.getElementById(id); }

  function slugify(s) {
    return String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function sel() {
    return (typeof window.getCurrentSelection === 'function')
      ? window.getCurrentSelection()
      : { state: null, district: null, block: null, village: null };
  }

  // A chart counts as "showing something" only if Chart.js has a live
  // instance with at least one real (non-null) point. An empty pane is
  // already covered by its own .chart-empty message, which other loaders
  // keep honest; adding a second note there would just be noise.
  function liveChart(canvasId) {
    if (typeof Chart === 'undefined' || !Chart.getChart) return null;
    var c;
    try { c = Chart.getChart(canvasId); } catch (e) { return null; }
    if (!c || !c.data || !c.data.datasets || !c.data.datasets.length) return null;
    var any = c.data.datasets.some(function (ds) {
      return (ds.data || []).some(function (v) {
        if (v == null) return false;
        if (typeof v === 'object') return v.y != null;
        return true;
      });
    });
    return any ? c : null;
  }

  // The selected village's own real IMD indices, or null. Read from the same
  // MP_DISTRICTS[key]._villages table mp_climate_loader.js fills from
  // mp_climate_data.json -- never recomputed here.
  function villageIndices(districtName, villageName) {
    if (!districtName || !villageName) return null;
    if (typeof MP_DISTRICTS === 'undefined' || !MP_DISTRICTS) return null;
    var d = MP_DISTRICTS[slugify(districtName)];
    if (!d || !d._villages) return null;
    var want = String(villageName).toUpperCase();
    for (var id in d._villages) {
      var v = d._villages[id];
      if (v && (v.name || '').toUpperCase() === want) return v.indices || null;
    }
    return null;
  }

  function noteHost(canvasId) {
    var canvas = el(canvasId);
    if (!canvas) return null;
    var wrap = canvas.closest ? canvas.closest('.chart-wrap') : null;
    if (!wrap || !wrap.parentNode) return null;
    var id = 'lvlnote-' + canvasId;
    var host = el(id);
    if (!host) {
      host = document.createElement('div');
      host.id = id;
      host.className = 'chart-level-note';
      wrap.parentNode.insertBefore(host, wrap.nextSibling);
    }
    return host;
  }

  function buildText(cfg, s) {
    var district = s.district || '';
    var parts = [];

    // 1) What level the drawn series actually belongs to, always stated.
    if (s.village) {
      parts.push('<b>Chart shows district-level ' + cfg.metric + ' for ' + district +
        '</b> — no village-specific ' + cfg.metric + ' series exists in this project.');
    } else if (s.block) {
      parts.push('<b>Chart shows district-level ' + cfg.metric + ' for ' + district +
        '</b> — no block-specific ' + cfg.metric + ' series exists in this project.');
    } else {
      parts.push('<b>District-level ' + cfg.metric + ' for ' + district + '.</b>');
    }

    // 2) Why, when a deeper level is selected -- a specific reason, not a
    //    generic "not available".
    if (s.block || s.village) {
      if (cfg.canvas === 'chartNdvi') {
        parts.push('DiCRA publishes NDVI as a district zonal mean over MODIS 250 m pixels; ' +
          'no block- or village-tier NDVI is computed anywhere in this project ' +
          '(docs/METHODOLOGY.md Sec 7).');
      } else {
        parts.push('The IMD series here is aggregated per district; block tier has no climate ' +
          'source of its own in this project.');
      }
    }

    // 3) Where a genuine village-level reading DOES exist, say so and give
    //    it -- clearly marked as the village value, distinct from the line
    //    above it.
    if (s.village && cfg.villageIdx.length) {
      var vi = villageIndices(s.district, s.village);
      if (vi) {
        var bits = [];
        cfg.villageIdx.forEach(function (f) {
          var v = vi[f.key];
          if (v != null && !isNaN(v)) bits.push(f.label + ' ' + Number(v).toFixed(f.dp) + f.unit);
        });
        if (bits.length) {
          parts.push('<b>' + s.village + ' does have its own real village-level IMD reading</b> (' +
            bits.join(', ') + ', 2000–2024 mean) — a single value per village, not a series, ' +
            'so it cannot be charted above. Also shown in the Historical Indices panel.');
        }
      } else {
        parts.push('No village-level IMD sample exists for ' + s.village +
          ' either — village-tier indices are computed only for the 5 IMD districts ' +
          '(Bhopal, Indore, Jabalpur, Rewa, Sidhi).');
      }
    } else if (s.village && cfg.canvas === 'chartNdvi') {
      parts.push('No village-level NDVI value exists to show instead.');
    }

    // 4) source / resolution / year -- item 7b's required footer line.
    parts.push('<span class="chart-level-src">Source · ' + cfg.source + ' · ' +
      cfg.resolution + ' · ' + cfg.years + '</span>');

    return parts.join(' ');
  }

  function update() {
    var s = sel();
    PANES.forEach(function (cfg) {
      var host = noteHost(cfg.canvas);
      if (!host) return;
      // No district, or nothing actually drawn -> leave the pane's own
      // empty-state message to speak for itself.
      if (!s.district || !liveChart(cfg.canvas)) { host.innerHTML = ''; return; }
      host.innerHTML = buildText(cfg, s);
    });
  }

  // Selection can change from the dropdowns OR from a map click, and the
  // charts are rebuilt asynchronously after either. A short poll is the one
  // mechanism that catches both paths without reaching into the other
  // loaders' internals (the same approach village_report.js settled on).
  var _last = '';
  function tick() {
    var s = sel();
    var live = PANES.map(function (c) { var ch = liveChart(c.canvas); return ch ? (ch.data.datasets.length + ':' + (ch.data.labels || []).length) : '0'; }).join(',');
    var sig = [s.state, s.district, s.block, s.village, live].join('|');
    if (sig !== _last) { _last = sig; try { update(); } catch (e) { console.warn('[chart_level_note]', e); } }
  }

  function boot() {
    if (!el('chartRain')) { setTimeout(boot, 700); return; }
    tick();
    setInterval(tick, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 900); });
  } else {
    setTimeout(boot, 900);
  }

  window.VindhyaChartLevelNote = { refresh: update };
})();
