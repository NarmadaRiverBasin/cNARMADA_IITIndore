/*
 * national_ndvi_loader.js -- fills the NDVI panel for districts OUTSIDE
 * Madhya Pradesh's 52 DiCRA districts, using
 * dashboard/data/ndvi/<state_slug>/<district_slug>.json (real MODIS
 * MOD13Q1 v061 via Google Earth Engine, scripts/10_gee_national_ndvi.py,
 * Phase 8.4).
 *
 * dicra_ndvi_loader.js already owns MP's 52 districts and the NDVI chart
 * canvas for them; this file explicitly SKIPS any district
 * dicra_ndvi.json already has data for, and never overwrites/merges with
 * it -- the two NDVI sources (UNDP DiCRA vs MODIS/GEE) are always shown
 * labelled separately, per STANDING ORDERS / Phase 8.7 ("observed,
 * projected aur validation teeno ALAG, kabhi mila kar nahi" applies
 * equally here to the two observed-NDVI sources).
 */
(function () {
  'use strict';

  var manifestPromise = null;
  var lookup = null;       // districtSlug -> {stateSlug, districtSlug}
  var dicraDistricts = {}; // slug -> true, districts dicra_ndvi_loader.js already owns
  var cache = {};

  function fetchWithTimeout(url, opts) {
    var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 30000) : null;
    var o = opts || {};
    if (controller) o.signal = controller.signal;
    return fetch(url, o).finally(function () { if (timer) clearTimeout(timer); });
  }

  function slugify(s) {
    return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function fmt(v, d) {
    return (v == null || isNaN(v)) ? '—' : Number(v).toFixed(d == null ? 3 : d);
  }
  function setTxt(id, v) { var e = document.getElementById(id); if (e) e.textContent = v; }
  function setBar(id, pct) { var e = document.getElementById(id); if (e) e.style.width = pct + '%'; }

  function loadManifests() {
    if (manifestPromise) return manifestPromise;
    manifestPromise = Promise.all([
      fetchWithTimeout('data/ndvi_manifest.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
      fetchWithTimeout('data/dicra_ndvi.json').then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })
    ]).then(function (results) {
      var manifest = results[0];
      var dicra = results[1];
      lookup = {};
      if (manifest && manifest.gee_modis && Array.isArray(manifest.gee_modis.districts)) {
        manifest.gee_modis.districts.forEach(function (entry) {
          var parts = entry.split('/');
          if (parts.length === 2) lookup[parts[1]] = { stateSlug: parts[0], districtSlug: parts[1] };
        });
      }
      dicraDistricts = {};
      if (dicra && dicra.districts) {
        Object.keys(dicra.districts).forEach(function (k) { dicraDistricts[slugify(k)] = true; });
      }
      return lookup;
    }).catch(function () { lookup = {}; return lookup; });
    return manifestPromise;
  }

  var lastDistrictName = null;

  // AUDIT_FIX_PROMPT.md item 0C part 2: same guarded-reapply pattern as
  // national_climate_loader.js's reapplyLevelSuffix() -- only touches
  // ndvi-detail if the selection is still this same GEE-NDVI district (a
  // DiCRA MP district, or a since-changed selection, is a different owner
  // entirely and must not be overwritten with a stale label).
  function reapplyLevelSuffix() {
    var sel = (typeof window.getCurrentSelection === 'function') ? window.getCurrentSelection() : {};
    if (!sel.district || !lastDistrictName || slugify(sel.district) !== slugify(lastDistrictName)) return;
    if (dicraDistricts[slugify(sel.district)]) return;
    var el2 = document.getElementById('ndvi-detail');
    if (!el2) return;
    var base = el2.getAttribute('data-base');
    if (base == null) return;
    var suffix = (typeof window.climateLevelSuffix === 'function') ? window.climateLevelSuffix(false) : '';
    el2.textContent = base + suffix;
  }

  function applyGeeNdvi(file, districtName) {
    var summary = file.period_summary || {};
    var meta = file.metadata || {};
    lastDistrictName = districtName;

    var ndviVal = summary.ndvi_mean != null ? summary.ndvi_mean : null;
    if (ndviVal != null) {
      setTxt('m-ndvi', fmt(ndviVal, 2) + ' (MODIS)');
      setBar('bar-ndvi', Math.min(100, Math.max(0, Math.round(ndviVal * 100))));
    } else {
      setTxt('m-ndvi', 'Not available');
      setBar('bar-ndvi', 0);
    }
    var ndviDetailEl = document.getElementById('ndvi-detail');
    if (ndviDetailEl) {
      var base = ndviVal != null ? (districtName || '') + ' · MODIS via GEE' : 'Not available';
      ndviDetailEl.setAttribute('data-base', base);
      var suffix = (typeof window.climateLevelSuffix === 'function') ? window.climateLevelSuffix(false) : '';
      ndviDetailEl.textContent = base + suffix;
    }

    var host = document.getElementById('national-ndvi-panel');
    if (host) {
      var rows = (file.annual_ndvi || []).map(function (r) {
        return '<tr><td>' + r.year + '</td><td>' + fmt(r.ndvi_mean, 3) + '</td>'
          + '<td>' + fmt(r.ndvi_stddev, 3) + '</td><td>' + r.pixel_count + '</td></tr>';
      }).join('');
      host.innerHTML = ''
        + '<div class="section-header"><i class="fa fa-leaf" style="color:var(--green,#6fc795);font-size:0.7rem"></i>'
        + '<div class="section-title">NDVI — ' + (districtName || '') + ' '
        + '<span style="color:var(--text-dim);font-weight:500;font-size:0.6rem;letter-spacing:0.3px">MODIS MOD13Q1 via GEE, NOT DiCRA</span></div></div>'
        + '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;padding:0.75rem;">'
        + '  <div class="metric-card"><div class="metric-label">MEAN NDVI 2000–2024</div><div class="metric-value" style="color:var(--green,#6fc795)">' + fmt(summary.ndvi_mean, 3) + '</div></div>'
        + '  <div class="metric-card"><div class="metric-label">STD DEV</div><div class="metric-value" style="color:var(--orange)">' + fmt(summary.ndvi_stddev, 3) + '</div></div>'
        + '  <div class="metric-card"><div class="metric-label">MIN / MAX</div><div class="metric-value" style="color:var(--blue)">' + fmt(summary.ndvi_min, 2) + ' / ' + fmt(summary.ndvi_max, 2) + '</div></div>'
        + '  <div class="metric-card"><div class="metric-label">YEARS COVERED</div><div class="metric-value cyan">' + (summary.years_covered != null ? summary.years_covered : '—') + '</div></div>'
        + '</div>'
        + '<div style="max-height:160px;overflow:auto;padding:0 0.75rem;">'
        + '<table style="width:100%;font-size:0.65rem;border-collapse:collapse;"><thead><tr style="text-align:left;color:var(--text-dim)"><th>Year</th><th>NDVI mean</th><th>Std dev</th><th>Pixels</th></tr></thead><tbody>'
        + rows + '</tbody></table></div>'
        + '<div style="font-size:0.65rem;font-weight:600;color:var(--text-dim);padding:0.5rem 0.75rem">'
        + 'Source: MODIS MOD13Q1 v061 (Terra, 250m, 16-day) via Google Earth Engine. '
        + 'Distinct from UNDP DiCRA (used for Madhya Pradesh\'s 52 districts) — never merged. See Data Sources.</div>';
      host.classList.remove('u-hidden');
    }
    // AUDIT_FIX_PROMPT.md item 9: real content is showing below (this
    // panel), not in the #chartNdvi canvas above it (that's DiCRA-only) --
    // hide that canvas's own "select a district" message so the two don't
    // both claim empty/full at once.
    var emptyEl = document.getElementById('empty-chartNdvi');
    if (emptyEl) emptyEl.style.display = 'none';
  }

  // AUDIT_FIX_PROMPT.md item 0C part 2 (2026-09-14), caught live on the
  // deployed site: #chartNdvi is DiCRA-only, and dicra_ndvi_loader.js only
  // ever re-runs for the 5 districts mp_climate_loader.js covers -- so
  // selecting Madhya Pradesh -> Jabalpur and then Uttar Pradesh -> Agra
  // left Jabalpur's real 278-point DiCRA series alive in that canvas with
  // Agra on the breadcrumb. Nothing was clearing it: the district is not a
  // DiCRA district, so dicra_ndvi_loader.js's own handler never fires.
  // Whenever the selected district is NOT a DiCRA district, any chart in
  // this canvas can ONLY be a leftover from a previously-selected one.
  function killStaleDicraChart() {
    if (typeof Chart === 'undefined' || !Chart.getChart) return;
    var c;
    try { c = Chart.getChart('chartNdvi'); } catch (e) { return; }
    if (c) { try { c.destroy(); } catch (e) {} }
  }

  function clearNationalPanel() {
    var host = document.getElementById('national-ndvi-panel');
    if (host) host.classList.add('u-hidden');
    // Previously this asked `!!Chart.getChart('chartNdvi')` and treated a
    // live instance as proof that DiCRA had drawn a real chart FOR THIS
    // district -- which is exactly how a previous district's series stayed
    // on screen unchallenged. Callers now clear the stale chart first (see
    // killStaleDicraChart), so an empty canvas here genuinely means empty.
    var hasRealChart = (typeof Chart !== 'undefined' && Chart.getChart) ? !!Chart.getChart('chartNdvi') : false;
    if (!hasRealChart) {
      var emptyEl = document.getElementById('empty-chartNdvi');
      if (emptyEl) emptyEl.style.display = 'flex';
    }
  }

  function handleDistrictChange(districtName) {
    if (!districtName) return;
    var dslug = slugify(districtName);
    if (dicraDistricts[dslug]) { clearNationalPanel(); return; } // dicra_ndvi_loader.js owns this one
    // Not a DiCRA district -- so whatever is in the DiCRA-only #chartNdvi
    // canvas belongs to a district that is no longer selected. Drop it
    // before deciding what this pane should show.
    killStaleDicraChart();
    loadManifests().then(function () {
      var entry = lookup[dslug];
      if (!entry) { clearNationalPanel(); return; } // GEE hasn't computed this district's NDVI yet
      var key = entry.stateSlug + '/' + entry.districtSlug;
      if (cache[key]) { applyGeeNdvi(cache[key], districtName); return; }
      fetchWithTimeout('data/ndvi/' + entry.stateSlug + '/' + entry.districtSlug + '.json')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (file) {
          if (!file) { clearNationalPanel(); return; }
          cache[key] = file;
          applyGeeNdvi(file, districtName);
        })
        .catch(function () { clearNationalPanel(); });
    });
  }

  function boot() {
    loadManifests();
    var originalOnDistrictChange = window.onDistrictChange;
    window.onDistrictChange = function (distKey) {
      if (typeof originalOnDistrictChange === 'function') originalOnDistrictChange(distKey);
      handleDistrictChange(distKey);
    };

    // AUDIT_FIX_PROMPT.md item 0C part 2 (2026-09-14): the wrapper above is
    // NOT reliably reached. `window.onDistrictChange = ...` is a single-slot
    // assignment, so whichever module boots LAST silently wins -- measured
    // live on the deployed site, `String(window.onDistrictChange).length`
    // was 59 and contained no reference to handleDistrictChange at all, i.e.
    // this file's wrapper had been overwritten and its district handler had
    // not been running. That is why the stale-DiCRA-chart clear added in the
    // previous commit still did nothing for Uttar Pradesh -> Agra.
    //
    // A real addEventListener does not have that failure mode: listeners
    // accumulate instead of clobbering each other, so this one runs no
    // matter what any other module assigns to window.onDistrictChange
    // afterwards. Guarded against double-binding so the wrapper path and
    // this path cannot both act on one change.
    var ds = document.getElementById('districtSelect');
    if (ds && !ds._ndviStaleBound) {
      ds._ndviStaleBound = true;
      ds.addEventListener('change', function () {
        try { handleDistrictChange(ds.value || null); }
        catch (e) { console.warn('[national_ndvi] district change:', e); }
      });
    }
    var originalOnBlockChange = window.onBlockChange;
    window.onBlockChange = function (blockName) {
      if (typeof originalOnBlockChange === 'function') originalOnBlockChange(blockName);
      reapplyLevelSuffix();
    };
    var originalOnVillageChangeNdvi = window.onVillageChange;
    window.onVillageChange = function (village) {
      if (typeof originalOnVillageChangeNdvi === 'function') originalOnVillageChangeNdvi(village);
      reapplyLevelSuffix();
    };
  }

  // Wait for #districtSelect to exist before booting -- it is created by the
  // location selector, which may not be in the DOM 1000ms in on a slow load.
  // Without this the addEventListener above would silently be skipped and we
  // would be back to depending on the clobber-prone window.onDistrictChange.
  function bootWhenReady(tries) {
    if (!document.getElementById('districtSelect') && (tries || 0) < 40) {
      setTimeout(function () { bootWhenReady((tries || 0) + 1); }, 500);
      return;
    }
    boot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(function(){ bootWhenReady(0); }, 1000); });
  } else {
    setTimeout(function(){ bootWhenReady(0); }, 1000);
  }
})();
