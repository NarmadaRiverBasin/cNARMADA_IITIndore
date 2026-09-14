/*
 * horticulture_loader.js — fruits/vegetables/spices/plantation crops/
 * flowers/mushroom Area/Production/Yield, nationally (CROP_DATA_PROMPT.md
 * CHARAN 6 "horticulture alag rakho").
 *
 * Deliberately a SEPARATE panel/tab from crop_stats_loader.js's "Crop
 * Statistics" (field crops, DES). CHARAN 6's own rule: "Dono ko jodkar
 * 'total crop area' mat banao -- galat hoga" -- horticulture and field-
 * crop land-use accounting overlap in ways that don't simply add, so this
 * file never reads crop_stats_loader.js's data and never computes any
 * combined total. See docs/CROP_DATA_COVERAGE.md's Horticulture section
 * for the full resolvability writeup.
 *
 * Source: "Horticultural Statistics at a Glance 2023", Horticulture
 * Statistics Unit, Dept. of Agriculture & Farmers Welfare -- a national
 * PDF compendium (agriwelfare.gov.in), used here as MUKHYA instead of
 * CROP_DATA_PROMPT.md's literal "State Horticulture Department, <saal>"
 * per-state hunt, the same kind of considered national-over-36-state-PDFs
 * choice CHARAN 1/2 already made for DES vs. field-crop state reports.
 *
 * STATE-level only -- no district-wise horticulture dataset exists
 * anywhere (checked; see docs/CROP_DATA_COVERAGE.md). One file per state:
 * dashboard/data/horticulture_stats/<state_slug>.json (28 of 36 states/
 * UTs have real, individually-published figures; the other 8 are folded
 * into the source's own "OTHERS" aggregate and are never guessed at --
 * see NEVER_INDIVIDUALLY_REPORTED below). Every number shown is labelled
 * as a state figure, never implied to be specific to the selected
 * district.
 */
(function () {
  'use strict';

  var HORT_BASE = 'data/horticulture_stats/';

  var _hortCache = {};   // state_slug -> parsed file | null (404)

  // Matches scripts/fetch_horticulture_stats.py's NEVER_INDIVIDUALLY_REPORTED
  // -- a real finding (these 8 states/UTs never appear as a named row in
  // any of the source's 53 crop tables, always folded into "OTHERS"), used
  // to give an honest, specific reason instead of a generic "not found".
  var NEVER_INDIVIDUALLY_REPORTED_SLUGS = {
    goa: 1, chandigarh: 1, delhi: 1, puducherry: 1,
    andaman_and_nicobar_islands: 1, andaman_nicobar_islands: 1,
    dadra_and_nagar_haveli: 1, daman_and_diu: 1,
    the_dadra_nagar_haveli_and_daman_and_diu: 1,
    ladakh: 1, lakshadweep: 1
  };

  function fetchWithTimeout(url, opts) {
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 30000) : null;
    var o = opts || {};
    if (controller) o.signal = controller.signal;
    return fetch(url, o).finally(function () { if (timer) clearTimeout(timer); });
  }

  function isHindi() {
    try {
      if (typeof window.LANG !== 'undefined') return window.LANG === 'hi';
      return document.body.classList.contains('lang-hi');
    } catch (e) { return false; }
  }
  function t(en, hi) { return isHindi() ? hi : en; }

  // i-icon tooltip helper -- long explanation goes in the title attribute,
  // never inline as panel text (item 2).
  function infoIcon(title) {
    return '<i class="fa fa-circle-info" title="' + String(title).replace(/"/g, '&quot;') + '" ' +
      'style="color:var(--text-dim);opacity:0.7;cursor:help;font-size:0.85em;"></i>';
  }

  function slugify(name) {
    return String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function fmtNum(v) {
    if (v == null || !isFinite(v)) return '--';
    return Math.round(v).toLocaleString('en-IN');
  }

  // Same district-selection gate as crop_stats_loader.js (this bottom-pane
  // cluster is reached only once a district is already selected) -- but
  // the actual fetch below is keyed on state only, since this source is
  // state-level.
  function currentStateDistrict() {
    var ss = document.getElementById('stateSelect');
    var ds = document.getElementById('districtSelect');
    var state = ss && ss.value ? ss.value : null;
    var district = ds && ds.value ? ds.value : null;
    if (!state || !district) return null;
    return { stateSlug: slugify(state), districtSlug: slugify(district), stateName: state, districtName: district };
  }

  function loadHortForCurrentState() {
    var sd = currentStateDistrict();
    if (!sd) return Promise.resolve({ data: null, notFound: false });
    var key = sd.stateSlug;
    // Only successful lookups are cached -- a failed fetch (real 404 for a
    // state this source genuinely doesn't break out, or a transient
    // network blip) is never memoized as permanent, so re-selecting the
    // same state later in the same session retries instead of being
    // locked into "not available" forever from one bad attempt.
    if (key in _hortCache) return Promise.resolve({ data: _hortCache[key], notFound: _hortCache[key] === null });
    var url = HORT_BASE + sd.stateSlug + '.json';
    return fetchWithTimeout(url)
      .then(function (r) {
        if (r.status === 404) { _hortCache[key] = null; return { data: null, notFound: true }; }
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json().then(function (j) { _hortCache[key] = j; return { data: j, notFound: false }; });
      })
      // A real network/timeout failure (not a 404) -- distinct from "this
      // state genuinely has no horticulture data" so render() can offer a
      // retry instead of a flat "not available".
      .catch(function (err) { return { data: null, notFound: false, error: err.message }; });
  }

  function render() {
    var box = document.getElementById('horticulture-box');
    if (!box) return;
    var sd = currentStateDistrict();
    if (!sd) {
      box.innerHTML = '<div style="padding:var(--space-1);font-size:var(--fs-2);line-height:1.8;opacity:.85">' +
        '<b>' + t('Horticulture', 'बागवानी') + '</b><br>' +
        t('Select a district', 'ज़िला चुनें') + '</div>';
      return;
    }

    box.innerHTML = '<div style="padding:16px;font-size:12px;opacity:.8">' +
      t('Loading horticulture statistics...', 'बागवानी आंकड़े लाए जा रहे हैं...') + '</div>';

    loadHortForCurrentState().then(function (hortResult) {
      // A district/state change may have happened while this was in
      // flight -- re-check before rendering so a slow response for a
      // previously-selected state never overwrites the current one.
      var stillCurrent = currentStateDistrict();
      if (!stillCurrent || stillCurrent.stateSlug !== sd.stateSlug) return;

      var hort = hortResult.data;

      if (!hort || !hort.records || !hort.records.length) {
        if (hortResult.notFound) {
          var reasonTip;
          if (NEVER_INDIVIDUALLY_REPORTED_SLUGS[sd.stateSlug]) {
            reasonTip = 'The source (Horticultural Statistics at a Glance) does not break ' + sd.stateName +
              ' out individually in its state-wise tables -- smaller producers are published only as a ' +
              'combined "Others" total across every crop table, which cannot be attributed to a specific state.';
          } else {
            reasonTip = 'This state may not be in the source snapshot, or its name may differ from the source\'s own label.';
          }
          box.innerHTML = '<div style="padding:var(--space-07) var(--space-08);font-size:var(--fs-2);line-height:1.8">' +
            '<b>' + t('Horticulture', 'बागवानी') + '</b><br>' +
            t('Not available', 'उपलब्ध नहीं') + ' · ' + sd.stateName + ' ' + infoIcon(reasonTip) +
            '</div>';
        } else {
          // A real fetch/network failure, not "this state has no
          // horticulture data" -- offer a retry instead of implying it's
          // permanently unavailable (same Phase 2.8 convention as
          // crop_stats_loader.js).
          box.innerHTML = '<div style="padding:12px 14px;font-size:12px;line-height:1.8">' +
            '<b style="color:#c0392b">' + t('Horticulture statistics failed to load', 'बागवानी आंकड़े लोड नहीं हुए') + '</b><br>' +
            (hortResult.error || '') +
            '<br><button id="horticulture-retry-btn" style="margin-top:8px;background:#c0392b;color:#fff;' +
            'border:none;border-radius:4px;padding:4px 14px;font-size:11px;font-weight:700;cursor:pointer;">' +
            t('Retry', 'फिर कोशिश करें') + '</button></div>';
          var btn = document.getElementById('horticulture-retry-btn');
          if (btn) btn.onclick = function () { render(); };
        }
        return;
      }

      var groups = {};
      hort.records.forEach(function (r) {
        (groups[r.category] = groups[r.category] || []).push(r);
      });
      var categoryOrder = ['Fruits', 'Vegetables', 'Plantation Crops', 'Spices', 'Flowers', 'Mushroom'];
      var categories = Object.keys(groups).sort(function (a, b) {
        return categoryOrder.indexOf(a) - categoryOrder.indexOf(b);
      });
      var latestYear = (hort.metadata.years_covered || []).slice(-1)[0];

      var h = '<div style="padding:12px 14px;font-size:12px;color:var(--text)">';
      h += '<div style="margin-bottom:6px"><span style="display:inline-block;padding:1px 7px;border-radius:9px;' +
        'background:#c26b1f;color:#fff;font-size:10px;font-weight:700;letter-spacing:.3px">' +
        t('HORTICULTURE', 'बागवानी') + '</span> ' +
        '<b>' + t('Horticulture', 'बागवानी') + '</b> &mdash; ' + hort.metadata.state +
        ' <span style="opacity:.7">(' + (hort.metadata.years_covered || []).join(', ') + ')</span></div>';

      h += '<div style="margin-bottom:var(--space-08);padding:var(--space-04) var(--space-05);background:rgba(194,107,31,.10);border-radius:var(--radius-4);' +
        'font-size:var(--fs-1);line-height:1.6">' +
        t('State-level · not district-specific', 'राज्य-स्तरीय · ज़िला-विशिष्ट नहीं') + ' ' +
        infoIcon('Source does not publish district-wise horticulture data -- figures apply to all of ' + hort.metadata.state + ', not specifically to ' + sd.districtName + '.') +
        '</div>';

      // AUDIT_FIX_PROMPT.md item 7b (2026-09-14): this pane was table-only --
      // five real category tables, but no graphical view at all, so it read
      // as a spreadsheet rather than an analytics panel. The chart below is
      // the SAME published Area/Production/Yield rows the tables show, just
      // plotted across the source's own years_covered; nothing is
      // interpolated, and a crop-year with no published row is left as a
      // gap in the line (spanGaps:false) rather than joined through.
      var hortSeries = buildHortSeries(hort, latestYear);
      if (hortSeries.years.length > 1 && hortSeries.series.length) {
        if (hortSeries.headline) {
          h += '<div style="margin-bottom:var(--space-04);font-size:var(--fs-2);font-weight:700;line-height:1.5">' +
            hortSeries.headline + '</div>';
        }
        h += '<div class="chart-wrap u-h200"><canvas id="chartHort"></canvas></div>';
        h += '<div style="margin:var(--space-03) 0 var(--space-08);font-size:var(--fs-1);opacity:.75;line-height:1.6">' +
          t('Source', 'स्रोत') + ' · ' + (hort.metadata.source || 'Horticultural Statistics at a Glance') +
          ' · ' + t('state-level (no district breakdown is published)', 'राज्य-स्तरीय (ज़िलेवार आंकड़ा प्रकाशित नहीं)') +
          ' · ' + hortSeries.years[0] + ' – ' + hortSeries.years[hortSeries.years.length - 1] +
          '</div>';
      }

      categories.forEach(function (cat) {
        var rows = groups[cat]
          .filter(function (r) { return r.year === latestYear; })
          .sort(function (a, b) { return (b.area_ha || 0) - (a.area_ha || 0); })
          .slice(0, 10);
        if (!rows.length) return;
        h += '<div style="margin-bottom:8px"><div style="font-size:10.5px;font-weight:700;opacity:.8;margin-bottom:3px">' +
          cat + ' <span style="opacity:.6;font-weight:400">(' + latestYear + ')</span></div>';
        h += '<table style="width:100%;border-collapse:collapse;font-size:11px">' +
          '<tr style="text-align:left;font-size:9.5px;opacity:.65;letter-spacing:.3px">' +
          '<th style="padding:2px 0">' + t('CROP', 'फसल') + '</th>' +
          '<th style="text-align:right">' + t('AREA (ha)', 'क्षेत्र (हे)') + '</th>' +
          '<th style="text-align:right">' + t('PRODUCTION (t)', 'उत्पादन (टन)') + '</th>' +
          '<th style="text-align:right">' + t('YIELD (t/ha)', 'उपज (टन/हे)') + '</th></tr>';
        rows.forEach(function (r) {
          h += '<tr style="border-top:1px solid var(--border)">' +
            '<td style="padding:3px 0">' + r.crop + '</td>' +
            '<td style="text-align:right;opacity:.85">' + fmtNum(r.area_ha) + '</td>' +
            '<td style="text-align:right;opacity:.85">' + fmtNum(r.production_tonnes) + '</td>' +
            '<td style="text-align:right;font-weight:700">' + (r.yield_tonnes_per_ha != null ? r.yield_tonnes_per_ha.toFixed(2) : '--') + '</td></tr>';
        });
        h += '</table></div>';
      });

      h += '<div style="margin-top:var(--space-03);padding-top:var(--space-04);border-top:1px solid var(--border);' +
        'font-size:var(--fs-1);opacity:.75;line-height:1.6">' +
        t('Source', 'स्रोत') + ' · ' + (hort.metadata.source || 'Horticultural Statistics at a Glance') +
        (hort.metadata.source_publisher ? ' · ' + hort.metadata.source_publisher : '') + ' ' +
        infoIcon('Not summed with Crop Statistics (field crops, DES) into any total crop area -- the two overlap in land-use accounting.') +
        '</div></div>';

      box.innerHTML = h;
      if (hortSeries.years.length > 1 && hortSeries.series.length) drawHortChart(hortSeries);
    });
  }

  // Top crops by the LATEST published year's area, each plotted across
  // every year the source covers. Area (not production) picks the crops so
  // the selection reflects how much of the state is actually under them,
  // and the same crop set is used for every year -- no per-year re-ranking
  // that would make the lines cross for a purely cosmetic reason.
  var HORT_SERIES_N = 6;
  function buildHortSeries(hort, latestYear) {
    var years = (hort.metadata.years_covered || []).slice();
    if (years.length < 2) return { years: years, series: [], headline: '' };

    var latest = hort.records.filter(function (r) { return r.year === latestYear && r.area_ha != null; });
    latest.sort(function (a, b) { return (b.area_ha || 0) - (a.area_ha || 0); });
    var picked = latest.slice(0, HORT_SERIES_N).map(function (r) { return r.crop; });

    var byCropYear = {};
    hort.records.forEach(function (r) {
      byCropYear[r.crop + '||' + r.year] = r;
    });

    var series = picked.map(function (crop) {
      return {
        crop: crop,
        data: years.map(function (y) {
          var rec = byCropYear[crop + '||' + y];
          return (rec && rec.production_tonnes != null) ? rec.production_tonnes : null;
        })
      };
    });

    // Headline: the real first-to-last change for the single largest crop.
    // Only stated when BOTH endpoints are genuinely published -- otherwise
    // no headline at all, rather than a change computed off a missing year.
    var headline = '';
    if (series.length) {
      var top = series[0];
      var a = top.data[0], b = top.data[top.data.length - 1];
      if (a != null && b != null && a > 0) {
        var pct = ((b - a) / a) * 100;
        var dir = pct >= 0 ? t('up', 'बढ़ा') : t('down', 'घटा');
        headline = top.crop + ' ' + t('production', 'उत्पादन') + ' ' + dir + ' ' +
          Math.abs(pct).toFixed(1) + '% — ' + fmtNum(a) + ' → ' + fmtNum(b) + ' ' +
          t('tonnes', 'टन') + ' (' + years[0] + ' → ' + years[years.length - 1] + ')';
      }
    }
    return { years: years, series: series, headline: headline };
  }

  // Shared portal palette (same hues the other panels' multi-series charts
  // use) -- colour identity per crop, assigned by rank, stable across
  // re-renders for a given state.
  var HORT_COLORS = ['#c26b1f', '#5cc3cd', '#8ad3aa', '#c9a843', '#b07fd0', '#e08a8a'];
  var _hortChart = null;
  function drawHortChart(model) {
    if (typeof Chart === 'undefined') return;
    var canvas = document.getElementById('chartHort');
    if (!canvas) return;
    if (_hortChart) { try { _hortChart.destroy(); } catch (e) {} }

    var base = (typeof chartOpts === 'function')
      ? chartOpts({ color: 'rgba(194,107,31,0.12)' })
      : { responsive: true, maintainAspectRatio: false, scales: { x: {}, y: {} }, plugins: {} };

    base.plugins = base.plugins || {};
    base.plugins.tooltip = base.plugins.tooltip || {};
    base.plugins.tooltip.callbacks = {
      // Exact published value + the crop-year it belongs to (item 7b: hover
      // must give the exact value and its date, not a rounded read-off).
      label: function (item) {
        if (item.parsed.y == null) return item.dataset.label + ': ' + t('not published', 'प्रकाशित नहीं');
        return item.dataset.label + ': ' + fmtNum(item.parsed.y) + ' ' + t('tonnes', 'टन') +
          ' (' + item.label + ')';
      }
    };
    base.scales = base.scales || {};
    base.scales.x = base.scales.x || {};
    base.scales.y = base.scales.y || {};
    base.scales.x.title = { display: true, text: t('Crop year', 'फसल वर्ष'), font: { size: 10, weight: 'bold' } };
    base.scales.y.title = { display: true, text: t('Production (tonnes)', 'उत्पादन (टन)'), font: { size: 10, weight: 'bold' } };
    base.scales.y.ticks = base.scales.y.ticks || {};
    base.scales.y.ticks.callback = function (v) { return fmtNum(v); };

    _hortChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: model.years,
        datasets: model.series.map(function (s, i) {
          var c = HORT_COLORS[i % HORT_COLORS.length];
          return {
            label: s.crop,
            data: s.data,
            borderColor: c,
            backgroundColor: c,
            borderWidth: 2,
            tension: 0.25,
            pointRadius: 3,
            // A year the source does not publish for this crop stays a
            // visible gap -- never bridged into a straight line that would
            // read as a real measured value.
            spanGaps: false
          };
        })
      },
      options: base
    });
  }

  function addPane() {
    var first = document.querySelector('.btm-pane');
    var host = first ? first.parentNode : null;
    if (!host || document.getElementById('pane-horticulture')) return;

    var p = document.createElement('div');
    p.innerHTML = '<div id="horticulture-box"></div>';
    p.className = 'btm-pane';
    p.id = 'pane-horticulture';
    host.appendChild(p);

    var firstTab = document.querySelector('.btm-tab');
    var tabs = firstTab ? firstTab.parentNode : null;
    if (tabs && !document.getElementById('horticulture-tab')) {
      var tab = document.createElement('div');
      tab.innerHTML = '<i class="fa fa-apple-whole"></i>' + t('Horticulture', 'बागवानी');
      tab.className = 'btm-tab';
      tab.id = 'horticulture-tab';
      tab.onclick = function () {
        var panes = document.querySelectorAll('.btm-pane'), i;
        for (i = 0; i < panes.length; i++) panes[i].classList.remove('active');
        document.getElementById('pane-horticulture').classList.add('active');
        var tb = document.querySelectorAll('.btm-tab');
        for (i = 0; i < tb.length; i++) tb[i].classList.remove('active');
        this.classList.add('active');
        render();
      };
      tabs.appendChild(tab);
    }

    var ds = document.getElementById('districtSelect');
    if (ds) ds.addEventListener('change', function () {
      var pane = document.getElementById('pane-horticulture');
      if (pane && pane.classList.contains('active')) render();
    });
  }

  function boot() {
    if (!document.querySelector('.btm-pane')) { setTimeout(boot, 700); return; }
    try { addPane(); } catch (e) { console.warn('[horticulture]', e); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1000); });
  } else {
    setTimeout(boot, 1000);
  }

  window.VindhyaHorticulture = { reload: function () { _hortCache = {}; render(); } };
})();
