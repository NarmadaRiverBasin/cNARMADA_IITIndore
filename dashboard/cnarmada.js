/*
 * cnarmada.js -- cNARMADA basin panel (owner request, 2026-09-14).
 *
 * "jaise Mera Khet wala section perform kar raha hai waise cNarmada bhi
 *  perform kare ... Mera Khet ke niche cNarmada dikhe ... crop, agriculture,
 *  horticulture, climate, groundwater, soil moisture -- same as Mera Khet."
 *
 * MERA KHET IS NOT TOUCHED. The owner asked for no changes there, so this
 * file adds its own nav item, its own hidden bottom tab and its own pane,
 * using exactly the same integration pattern mera_khet.js already uses
 * (addNavItem -> .sidebar-nav, hidden .btm-tab-dup -> switchTab). It waits
 * for #mk-nav-item to exist before inserting, so cNARMADA always lands
 * directly BELOW Mera Khet in the sidebar rather than racing it.
 *
 * ---------------------------------------------------------------------
 * WHERE THE NUMBERS COME FROM -- this file invents nothing
 * ---------------------------------------------------------------------
 * The owner supplied a Narmada basin district shapefile + a matching
 * State/District Excel list. scripts/build_cnarmada_basin.py converts those
 * into data/cnarmada/narmada_basin_districts.geojson, which is used ONLY to
 * (a) populate the State/District selectors and (b) outline the selected
 * district on the map.
 *
 * Every analytic value shown is then read at runtime from the SAME real
 * per-district files the rest of this portal already publishes:
 *   climate       data/climate/<state>/<district>.json      (ERA5-Land+CHIRPS via GEE, 2000-2024)
 *   climate (IMD) data/mp_climate_data.json                 (Bhopal/Indore/Jabalpur -- IMD 0.05 deg village product)
 *   NDVI          data/ndvi/<state>/<district>.json         (MODIS MOD13Q1 via GEE)
 *   soil moisture data/soil_moisture/<state>/<district>.json(NASA SMAP L4, ~9 km)
 *   groundwater   data/groundwater/<state>/<district>.json  (CGWB monitoring stations)
 *   crops         data/crop_stats_des_by_district/<state>/<district>.json (DES)
 *   horticulture  data/horticulture_stats/<state>.json      (STATE level -- labelled as such)
 *   advisory      data/advisory/<state>/<district>.json     (rule-based, derived)
 *
 * The basin shapefile is NOT the Survey of India product used elsewhere in
 * this portal, so it is used for selection/outline only and says so on
 * screen. Where a district genuinely has no file for a layer, the card says
 * so instead of showing a blank or borrowing a neighbour's number.
 */
(function () {
  'use strict';

  var BASIN_URL = 'data/cnarmada/narmada_basin_districts.geojson';
  var BASIN = null, FEATS = [], BMETA = {};
  var layer = null, sel = { state: '', district: '' };
  var charts = {};
  var cache = {};

  // Agro-climatic zone. This is the SAME coarse classification
  // mp_climate_loader.js already uses -- a typed-in agro-climatic zone
  // table, NOT a soil survey and NOT a measured dataset. Two honesty rules
  // apply here that do not apply there:
  //   1. mp_climate_loader.js falls back to `malwa` for any unlisted
  //      district. That is harmless inside MP but would be outright wrong
  //      for the basin's Gujarat / Chhattisgarh / Maharashtra districts, so
  //      this lookup returns null instead of guessing.
  //   2. It is labelled as an indicative zone classification, never as
  //      "soil type" measured for this district. CLAUDE.md lists soil
  //      type/pH/NPK among the subjects with NO real source in this repo.
  var AGRO_ZONES = {
    'Black Soil (Regur) — Malwa plateau': ['indore','dhar','ujjain','ratlam','mandsaur','neemuch','dewas','shajapur','rajgarh','barwani','khargone','khandwa','burhanpur','alirajpur','jhabua','east_nimar'],
    'Mixed Red & Black — Bundelkhand': ['sagar','damoh','panna','chhatarpur','tikamgarh','niwari','datia','guna','ashoknagar','shivpuri','morena','bhind','gwalior'],
    'Alluvial Clay Loam — Narmada valley': ['narsinghpur','jabalpur','narmadapuram','harda','raisen','sehore','bhopal','mandla','dindori'],
    'Red & Yellow Loam — Vindhya': ['rewa','sidhi','satna','maihar','mauganj','singrauli','shahdol','umaria','anuppur','katni'],
    'Laterite & Sandy Loam — Satpura': ['balaghat','seoni','chhindwara','betul','pandhurna']
  };
  function agroZone(districtSlug) {
    for (var z in AGRO_ZONES) if (AGRO_ZONES[z].indexOf(districtSlug) >= 0) return z;
    return null;   // never guess
  }

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function num(v, d) { return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toFixed(d == null ? 2 : d); }

  function fetchJson(url) {
    if (cache[url] !== undefined) return Promise.resolve(cache[url]);
    var c = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = c ? setTimeout(function () { c.abort(); }, 30000) : null;
    return fetch(url, c ? { signal: c.signal } : {})
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (j) { cache[url] = j; return j; })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  // ------------------------------------------------------------------
  // Nav + pane, mirroring mera_khet.js
  // ------------------------------------------------------------------
  function addNavItem() {
    if (el('cn-nav-item')) return true;
    var nav = document.querySelector('.sidebar-nav');
    if (!nav) return false;
    var mk = el('mk-nav-item');
    // Wait for Mera Khet so cNARMADA reliably sits BELOW it, as asked.
    if (!mk) return false;
    var item = document.createElement('div');
    item.className = 'nav-item';
    item.id = 'cn-nav-item';
    item.title = 'cNARMADA -- Narmada basin districts (owner-supplied basin shapefile). '
      + 'Select a basin district to see this portal\'s existing real climate, NDVI, soil-moisture, '
      + 'groundwater, crop and horticulture data for it.';
    item.innerHTML = '<span class="nav-icon"><i class="fa fa-water"></i></span>'
      + '<span class="nav-label">cNARMADA</span><span class="nav-badge">BASIN</span>';
    item.onclick = function () {
      document.querySelectorAll('.nav-item').forEach(function (i) { i.classList.remove('active'); });
      item.classList.add('active');
      var tab = el('cn-tab');
      if (tab) tab.click();
    };
    if (mk.nextSibling) nav.insertBefore(item, mk.nextSibling); else nav.appendChild(item);
    return true;
  }

  function addTabAndPane() {
    var first = document.querySelector('.btm-pane');
    var host = first ? first.parentNode : null;
    var firstTab = document.querySelector('.btm-tab');
    var tabsHost = firstTab ? firstTab.parentNode : null;
    if (!host || !tabsHost || el('pane-cnarmada')) return false;

    var tab = document.createElement('div');
    // btm-tab-dup = hidden in the bottom strip; the sidebar already owns
    // this entry, and audit item 1's rule is one name in one place.
    tab.className = 'btm-tab btm-tab-dup';
    tab.id = 'cn-tab';
    tab.innerHTML = '<i class="fa fa-water"></i>cNARMADA';
    tab.onclick = function () { if (typeof switchTab === 'function') switchTab(tab, 'cnarmada'); };
    tabsHost.appendChild(tab);

    var pane = document.createElement('div');
    pane.className = 'btm-pane';
    pane.id = 'pane-cnarmada';
    pane.innerHTML =
      '<div class="section-header"><i class="fa fa-water u-cyan-sm"></i>' +
      '<div class="section-title">cNARMADA &mdash; NARMADA BASIN DISTRICTS ' +
      '<span id="cn-sel-label" class="u-orange"></span></div></div>' +
      '<div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;padding:8px 14px 4px">' +
      '<div><label style="display:block;font-size:10px;font-weight:700;letter-spacing:.05em;opacity:.7;text-transform:uppercase;margin-bottom:3px">Basin state</label>' +
      '<select id="cn-state" style="padding:5px 8px;border:1px solid var(--border);border-radius:5px;background:var(--bg-card);color:var(--text);font-size:12px;min-width:170px"><option value="">-- Select state --</option></select></div>' +
      '<div><label style="display:block;font-size:10px;font-weight:700;letter-spacing:.05em;opacity:.7;text-transform:uppercase;margin-bottom:3px">Basin district</label>' +
      '<select id="cn-district" disabled style="padding:5px 8px;border:1px solid var(--border);border-radius:5px;background:var(--bg-card);color:var(--text);font-size:12px;min-width:190px"><option value="">-- Select state first --</option></select></div>' +
      '<button id="cn-zoom" disabled style="padding:6px 13px;border:1px solid var(--border);background:var(--bg-card);color:var(--text);border-radius:5px;cursor:pointer;font-size:12px">Zoom to district</button>' +
      '<span id="cn-coverage" style="font-size:11px;opacity:.7;flex-basis:100%"></span></div>' +
      '<div id="cn-body" style="overflow-y:auto;flex:1;padding:6px 14px 14px"></div>';
    host.appendChild(pane);

    el('cn-state').onchange = function () { onState(this.value); };
    el('cn-district').onchange = function () { onDistrict(this.value); };
    el('cn-zoom').onclick = zoomToDistrict;
    return true;
  }

  // ------------------------------------------------------------------
  // Selection
  // ------------------------------------------------------------------
  function fillStates() {
    var s = el('cn-state');
    if (!s) return;
    var states = [];
    FEATS.forEach(function (f) {
      var st = f.properties.state;
      if (states.indexOf(st) < 0) states.push(st);
    });
    states.sort();
    states.forEach(function (st) {
      var o = document.createElement('option');
      o.value = st; o.textContent = st + ' (' + FEATS.filter(function (f) { return f.properties.state === st; }).length + ')';
      s.appendChild(o);
    });
    var cov = el('cn-coverage');
    if (cov) {
      cov.innerHTML = BMETA.district_count + ' basin districts across ' + states.length +
        ' states &middot; boundary: owner-supplied basin shapefile (not Survey of India) &middot; ' +
        'all analytics below are this portal\'s existing real per-district data';
    }
  }

  function onState(state) {
    sel.state = state || '';
    sel.district = '';
    var d = el('cn-district');
    d.innerHTML = '<option value="">-- Select district --</option>';
    clearLayer();
    el('cn-body').innerHTML = '';
    el('cn-sel-label').textContent = '';
    el('cn-zoom').disabled = true;
    if (!state) { d.disabled = true; d.innerHTML = '<option value="">-- Select state first --</option>'; return; }
    FEATS.filter(function (f) { return f.properties.state === state; })
      .sort(function (a, b) { return a.properties.district.localeCompare(b.properties.district); })
      .forEach(function (f) {
        var o = document.createElement('option');
        o.value = f.properties.district_slug;
        o.textContent = f.properties.district;
        d.appendChild(o);
      });
    d.disabled = false;
  }

  function currentFeature() {
    return FEATS.filter(function (f) {
      return f.properties.state === sel.state && f.properties.district_slug === sel.district;
    })[0];
  }

  function clearLayer() {
    if (layer && window.leafletMap) { try { window.leafletMap.removeLayer(layer); } catch (e) {} }
    layer = null;
  }

  function drawDistrict(f) {
    clearLayer();
    var map = window.leafletMap;
    if (!map || !f) return;
    // Same casing technique the portal's other boundaries use (dark
    // underlay + bright line on top), in the basin panel's own colour.
    layer = L.layerGroup([
      L.geoJSON(f.geometry, { style: { color: '#000', weight: 6, opacity: 0.55, fill: false } }),
      L.geoJSON(f.geometry, { style: { color: '#00E5FF', weight: 3, fill: false } })
    ]).addTo(map);
  }

  function zoomToDistrict() {
    var f = currentFeature();
    if (!f || !window.leafletMap) return;
    var b = L.geoJSON(f.geometry).getBounds();
    if (b.isValid()) window.leafletMap.fitBounds(b, { padding: [24, 24] });
  }

  function destroyCharts() {
    Object.keys(charts).forEach(function (k) { try { charts[k].destroy(); } catch (e) {} delete charts[k]; });
  }

  function onDistrict(slug) {
    sel.district = slug || '';
    destroyCharts();
    if (!slug) { clearLayer(); el('cn-body').innerHTML = ''; el('cn-zoom').disabled = true; return; }
    var f = currentFeature();
    if (!f) return;
    el('cn-sel-label').textContent = '— ' + f.properties.district + ', ' + f.properties.state;
    el('cn-zoom').disabled = false;
    drawDistrict(f);
    zoomToDistrict();
    render(f);
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  function card(title, tag, inner, src) {
    return '<div style="border:1px solid var(--border);border-radius:8px;margin-bottom:10px;background:var(--bg-card)">' +
      '<div style="padding:7px 11px;border-bottom:1px solid var(--border);font-size:11px;font-weight:700;' +
      'letter-spacing:.05em;text-transform:uppercase;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
      title + (tag ? ' <span style="font-size:9.5px;font-weight:700;border-radius:10px;padding:1px 7px;' +
        'background:rgba(0,229,255,.12);color:var(--cyan)">' + tag + '</span>' : '') + '</div>' +
      '<div style="padding:9px 11px">' + inner +
      (src ? '<div style="margin-top:7px;padding-top:6px;border-top:1px solid var(--border);font-size:10.5px;opacity:.7;line-height:1.55">' + src + '</div>' : '') +
      '</div></div>';
  }
  function na(reason) {
    return '<div style="font-size:12px;opacity:.8;line-height:1.6">' +
      '<b>Not available</b> — ' + reason + '</div>';
  }
  function kv(rows) {
    var h = '<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:3px 12px;font-size:12.5px">';
    rows.forEach(function (r) {
      h += '<div style="opacity:.8">' + r[0] + '</div><div style="font-weight:700;text-align:right;font-variant-numeric:tabular-nums">' + r[1] + '</div>';
    });
    return h + '</div>';
  }

  function render(f) {
    var p = f.properties, s = p.state_slug, d = p.district_slug;
    var body = el('cn-body');
    body.innerHTML = '<div style="padding:14px;font-size:12px;opacity:.75">Loading real data for ' + esc(p.district) + '…</div>';

    Promise.all([
      p.layers.climate ? fetchJson('data/climate/' + s + '/' + d + '.json') : Promise.resolve(null),
      p.layers.ndvi ? fetchJson('data/ndvi/' + s + '/' + d + '.json') : Promise.resolve(null),
      p.layers.soil_moisture ? fetchJson('data/soil_moisture/' + s + '/' + d + '.json') : Promise.resolve(null),
      p.layers.groundwater ? fetchJson('data/groundwater/' + s + '/' + d + '.json') : Promise.resolve(null),
      p.layers.crop_des ? fetchJson('data/crop_stats_des_by_district/' + s + '/' + d + '.json') : Promise.resolve(null),
      fetchJson('data/horticulture_stats/' + s + '.json'),
      p.layers.advisory ? fetchJson('data/advisory/' + s + '/' + d + '.json') : Promise.resolve(null),
      p.climate_kind === 'imd_village' ? fetchJson('data/mp_climate_data.json') : Promise.resolve(null)
    ]).then(function (r) {
      // Selection may have moved while these were in flight.
      if (sel.district !== d) return;
      var h = '';
      h += renderHeader(p);
      h += renderBasinProfile(p, r[0], r[1], r[2], r[3], r[4], r[7]);
      h += renderClimate(p, r[0], r[7]);
      h += renderNdvi(r[1]);
      h += renderSoil(r[2]);
      h += renderGroundwater(r[3]);
      h += renderCrops(r[4]);
      h += renderHorticulture(p, r[5]);
      h += renderAdvisory(r[6]);
      body.innerHTML = h;
      drawNdviChart(r[1]);
      drawCropChart(r[4]);
      drawCropShareChart(r[4]);
      drawCropTrendChart(r[4]);
    });
  }

  function renderHeader(p) {
    var note = p.renamed_from_source
      ? 'Basin shapefile calls this district <b>' + esc(p.district_as_supplied) + '</b>; this portal\'s data is keyed to the ' +
        'Survey of India name <b>' + esc(p.district) + '</b>, so the two are matched here.'
      : '';
    return card('Selection', 'basin layer',
      kv([['Basin district', esc(p.district)], ['State', esc(p.state)],
          ['Data key (SoI name)', esc(p.district_slug)]]) +
      (note ? '<div style="margin-top:6px;font-size:11.5px;opacity:.85;line-height:1.6">' + note + '</div>' : ''),
      'Boundary source · ' + esc(BMETA.source || 'owner-supplied basin shapefile') +
      '. Used for selection and outline only — <b>not</b> the Survey of India boundary product used elsewhere in this portal.');
  }

  // ------------------------------------------------------------------
  // Basin Profile -- the "Village Profile"-style summary the owner asked
  // for, but for a basin district. Every tile is a REAL published value
  // pulled from the layer files above; where a layer is missing the tile
  // says so rather than showing a zero.
  // ------------------------------------------------------------------
  function tile(label, value, sub, accent) {
    return '<div style="flex:1 1 130px;border:1px solid var(--border);border-radius:7px;padding:8px 10px;background:var(--bg-card)">' +
      '<div style="font-size:9.5px;font-weight:800;letter-spacing:.05em;opacity:.65;text-transform:uppercase">' + label + '</div>' +
      '<div style="font-size:17px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:2px' +
      (accent ? ';color:' + accent : '') + '">' + value + '</div>' +
      (sub ? '<div style="font-size:10px;opacity:.65;margin-top:1px">' + sub + '</div>' : '') + '</div>';
  }

  function cropAgg(cs) {
    // Share of sown area by crop in the latest published year, and the
    // multi-year series for the top crops. Plain sums of published DES
    // numbers -- nothing modelled.
    if (!cs || !cs.records || !cs.records.length) return null;
    var years = [];
    cs.records.forEach(function (r) { if (years.indexOf(r.year) < 0) years.push(r.year); });
    years.sort();
    var latest = years[years.length - 1];
    var byCrop = {};
    cs.records.filter(function (r) { return r.year === latest && r.area_ha != null; })
      .forEach(function (r) { byCrop[r.crop] = (byCrop[r.crop] || 0) + r.area_ha; });
    var rows = Object.keys(byCrop).map(function (c) { return { crop: c, area: byCrop[c] }; })
      .sort(function (a, b) { return b.area - a.area; });
    var total = rows.reduce(function (a, r) { return a + r.area; }, 0);
    return { years: years, latest: latest, rows: rows, total: total };
  }

  function renderBasinProfile(p, gee, ndvi, sm, gw, cs, mpimd) {
    var tiles = '';
    // rainfall + heat: GEE district file, or the IMD village product for the 3
    var idx = (gee && gee.indices) || (mpimd && mpimd.districts && mpimd.districts[p.district_slug] && mpimd.districts[p.district_slug].indices) || null;
    var rain = idx ? (idx.annual_rain_mm != null ? idx.annual_rain_mm : idx.annual_rain_mm_mean) : null;
    tiles += tile('Annual rainfall', rain != null ? num(rain, 0) + ' mm' : 'n/a',
                  idx ? '2000–2024 mean' : 'no climate file', '#1a8a9e');
    tiles += tile('Max summer Tmax', idx && idx.max_summer_tmax != null ? num(idx.max_summer_tmax, 1) + ' °C' : 'n/a',
                  idx ? '2000–2024' : 'no climate file', '#c26b1f');
    tiles += tile('Drought probability', idx && idx.drought_probability_pct != null ? num(idx.drought_probability_pct, 1) + '%' : 'n/a',
                  idx ? 'share of years' : 'no climate file', '#96231f');
    var ps = ndvi && ndvi.period_summary;
    tiles += tile('NDVI mean', ps ? num(ps.ndvi_mean, 3) : 'n/a', ps ? esc(ps.years_covered) : 'no NDVI file', '#2d8f5c');
    tiles += tile('Surface soil moisture', sm && sm.district ? num(sm.district.sm_surface_mean, 3) + ' m³/m³' : 'n/a',
                  sm ? 'SMAP ~9 km mean' : 'no SMAP file', '#3a9d8f');
    // .trend is an OBJECT ({mean_slope_m_per_year, direction,
    // n_stations_with_trend}) -- printing it directly rendered
    // "below ground · [object Object]" on screen. Caught live.
    var gwTrend = (gw && gw.district && gw.district.trend) || null;
    var gwSub = gw && gw.district
      ? 'below ground' + (gwTrend && gwTrend.direction ? ' · ' + esc(gwTrend.direction) : '')
      : 'no CGWB file';
    tiles += tile('Groundwater level', gw && gw.district && gw.district.latest_gwl_mean_m != null ? num(gw.district.latest_gwl_mean_m, 2) + ' m' : 'n/a',
                  gwSub, '#14508f');

    var agg = cropAgg(cs);
    if (agg) {
      tiles += tile('Net sown area', num(agg.total, 0) + ' ha', 'all crops, ' + esc(agg.latest), '#6b4f2a');
      tiles += tile('Crops reported', agg.rows.length, esc(agg.latest), '#5a4b8a');
    }

    var zone = agroZone(p.district_slug);
    var inner = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' + tiles + '</div>';

    // Soil / agro-climatic zone -- honest about what it is
    inner += '<div style="border:1px solid var(--border);border-radius:7px;padding:8px 10px;margin-bottom:10px;background:var(--bg-card)">' +
      '<div style="font-size:9.5px;font-weight:800;letter-spacing:.05em;opacity:.65;text-transform:uppercase">Soil / agro-climatic zone</div>';
    if (zone) {
      inner += '<div style="font-size:13.5px;font-weight:700;margin-top:2px">' + esc(zone) + '</div>' +
        '<div style="font-size:10.5px;opacity:.75;margin-top:3px;line-height:1.55">Indicative <b>agro-climatic zone</b> classification, not a soil survey ' +
        'and not measured for this district. No Soil Health Card / soil-survey dataset is integrated in this portal.</div>';
    } else {
      inner += '<div style="font-size:13px;font-weight:700;margin-top:2px;opacity:.85">Not available</div>' +
        '<div style="font-size:10.5px;opacity:.75;margin-top:3px;line-height:1.55">The zone table this portal carries covers Madhya Pradesh districts only, ' +
        'so no zone is claimed for ' + esc(p.district) + ' (' + esc(p.state) + '). A neighbouring zone is deliberately not substituted.</div>';
    }
    inner += '</div>';

    if (agg) {
      inner += '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<div style="flex:1 1 240px;min-width:0"><div style="font-size:10px;font-weight:800;letter-spacing:.05em;opacity:.65;text-transform:uppercase;margin-bottom:4px">Major crops — share of sown area (' + esc(agg.latest) + ')</div>' +
        '<div class="chart-wrap u-h140"><canvas id="cn-chart-share"></canvas></div></div>' +
        '<div style="flex:1 1 240px;min-width:0"><div style="font-size:10px;font-weight:800;letter-spacing:.05em;opacity:.65;text-transform:uppercase;margin-bottom:4px">Top crops — sown area over time</div>' +
        '<div class="chart-wrap u-h140"><canvas id="cn-chart-trend"></canvas></div></div></div>';
      var top = agg.rows.slice(0, 5);
      inner += '<table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-top:9px">' +
        '<tr style="text-align:left;font-size:9.5px;opacity:.65"><th style="padding:3px 0">MAJOR CROP</th>' +
        '<th style="text-align:right">AREA (ha)</th><th style="text-align:right">SHARE</th></tr>';
      top.forEach(function (r) {
        inner += '<tr style="border-top:1px solid var(--border)"><td style="padding:3px 0">' + esc(r.crop) + '</td>' +
          '<td style="text-align:right">' + num(r.area, 0) + '</td>' +
          '<td style="text-align:right;font-weight:700">' + num(r.area / agg.total * 100, 1) + '%</td></tr>';
      });
      inner += '</table>';
    }

    return card('Basin Profile — ' + esc(p.district), 'real data',
      inner,
      'Every tile above is a published value read from this portal\'s existing per-district files ' +
      '(climate, NDVI, SMAP, CGWB, DES). Nothing on this card is modelled or interpolated; where a layer has no file ' +
      'for this district the tile reads n/a rather than showing a zero.');
  }

  var CROP_COLORS = ['#2d8f5c','#5cc3cd','#c9a843','#c26b1f','#b07fd0','#e08a8a','#8ad3aa','#9aa7b2'];

  function drawCropShareChart(cs) {
    var agg = cropAgg(cs);
    var cv = el('cn-chart-share');
    if (!agg || !cv || typeof Chart === 'undefined') return;
    var top = agg.rows.slice(0, 6);
    var other = agg.total - top.reduce(function (a, r) { return a + r.area; }, 0);
    var labels = top.map(function (r) { return r.crop; });
    var data = top.map(function (r) { return Math.round(r.area); });
    if (other > 0) { labels.push('All other crops'); data.push(Math.round(other)); }
    charts.share = new Chart(cv, {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: data, backgroundColor: CROP_COLORS, borderWidth: 1, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '52%',
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 9, font: { size: 10 } } },
          tooltip: { callbacks: { label: function (i) {
            return i.label + ': ' + Number(i.parsed).toLocaleString('en-IN') + ' ha (' +
              (i.parsed / agg.total * 100).toFixed(1) + '%)';
          } } }
        }
      }
    });
  }

  function drawCropTrendChart(cs) {
    var agg = cropAgg(cs);
    var cv = el('cn-chart-trend');
    if (!agg || !cv || typeof Chart === 'undefined') return;
    var top = agg.rows.slice(0, 3).map(function (r) { return r.crop; });
    var byCropYear = {};
    cs.records.forEach(function (r) {
      if (r.area_ha == null) return;
      var k = r.crop + '||' + r.year;
      byCropYear[k] = (byCropYear[k] || 0) + r.area_ha;
    });
    var opts = baseOpts('Sown area (ha)', 'Crop year');
    opts.plugins = opts.plugins || {};
    opts.plugins.legend = { display: true, labels: { boxWidth: 9, font: { size: 10 } } };
    charts.trend = new Chart(cv, {
      type: 'line',
      data: {
        labels: agg.years,
        datasets: top.map(function (c, i) {
          return {
            label: c,
            data: agg.years.map(function (y) { var v = byCropYear[c + '||' + y]; return v == null ? null : v; }),
            borderColor: CROP_COLORS[i], backgroundColor: CROP_COLORS[i],
            borderWidth: 2, tension: 0.25, pointRadius: 0, spanGaps: false
          };
        })
      },
      options: opts
    });
  }

  function renderClimate(p, gee, mp) {
    if (p.climate_kind === 'imd_village' && mp && mp.districts && mp.districts[p.district_slug]) {
      var dd = mp.districts[p.district_slug], idx = dd.indices || {};
      return card('Climate', 'IMD village product',
        kv([['Heatwave days/yr', num(idx.heatwave_days, 1)],
            ['Severe heatwave days/yr', num(idx.severe_heatwave_days, 1)],
            ['Max summer Tmax', num(idx.max_summer_tmax, 1) + ' °C'],
            ['Annual rainfall (mean)', num(idx.annual_rain_mm_mean, 0) + ' mm'],
            ['Drought probability', num(idx.drought_probability_pct, 1) + '%'],
            ['SPI-12', num(idx.spi_12, 2)]]),
        'Source · IMD 0.05° gridded daily, village-centroid sample, 2000–2024. This district is one of the five with ' +
        'the IMD village-level product, so it has no national GEE climate file — that is by design, not a gap.');
    }
    if (!gee || !gee.indices) {
      return card('Climate', null, na('no climate file has been computed for this district yet. ' +
        'The national run (ERA5-Land + CHIRPS via Google Earth Engine) writes one file per district as it progresses.'), null);
    }
    var i = gee.indices, m = gee.metadata || {};
    return card('Climate', 'ERA5-Land + CHIRPS (GEE)',
      kv([['Heatwave days/yr', num(i.heatwave_days, 1)],
          ['Severe heatwave days/yr', num(i.severe_heatwave_days, 1)],
          ['Max summer Tmax', num(i.max_summer_tmax, 1) + ' °C'],
          ['Mean summer Tmax', num(i.mean_summer_tmax, 1) + ' °C'],
          ['Drought months/yr', num(i.drought_months, 1)],
          ['Drought probability', num(i.drought_probability_pct, 1) + '%'],
          ['SPI-12', num(i.spi_12, 2)]]),
      'Source · ' + esc(m.source || 'ERA5-Land + CHIRPS via Google Earth Engine') +
      ' · ' + esc(m.resolution || '') + ' · ' + esc(m.years || '2000–2024'));
  }

  function renderNdvi(n) {
    if (!n || !n.period_summary) return card('NDVI / vegetation', null, na('no NDVI file for this district.'), null);
    var ps = n.period_summary, m = n.metadata || {};
    return card('NDVI / vegetation', 'MODIS MOD13Q1',
      kv([['Period', esc(ps.years_covered)], ['NDVI mean', num(ps.ndvi_mean, 3)],
          ['NDVI std dev', num(ps.ndvi_stddev, 3)],
          ['NDVI min / max', num(ps.ndvi_min, 3) + ' / ' + num(ps.ndvi_max, 3)]]) +
      '<div class="chart-wrap u-h140" style="margin-top:8px"><canvas id="cn-chart-ndvi"></canvas></div>',
      'Source · ' + esc(m.source || 'MODIS MOD13Q1 via GEE') + ' · ' + esc(m.resolution || '250 m') + ' · district zonal mean');
  }

  function renderSoil(sm) {
    if (!sm || !sm.district) return card('Soil moisture', null, na('no SMAP soil-moisture file for this district.'), null);
    var dd = sm.district, m = sm.metadata || {};
    return card('Soil moisture', 'NASA SMAP L4',
      kv([['Surface SM (mean)', num(dd.sm_surface_mean, 4) + ' m³/m³'],
          ['Surface SM (std dev)', num(dd.sm_surface_stddev, 4)],
          ['Root-zone SM (mean)', num(dd.sm_rootzone_mean, 4) + ' m³/m³'],
          ['Grid cells in district', dd.n_cells != null ? dd.n_cells : '—'],
          ['Blocks covered', sm.blocks ? sm.blocks.length : '—'],
          ['Villages assigned', sm.village_count_assigned != null ? sm.village_count_assigned : '—']]),
      'Source · ' + esc(m.source || 'NASA SMAP L4') + ' · ' + esc(m.resolution || '~9 km') +
      ' · ' + esc(m.observation_window || '') + '. A ~9 km cell is larger than most villages — this is a real reading at grid scale, not a village-resolved product.');
  }

  function renderGroundwater(gw) {
    if (!gw || !gw.district) return card('Groundwater', null, na('no CGWB station file for this district.'), null);
    var dd = gw.district, m = gw.metadata || {};
    return card('Groundwater', 'CGWB stations',
      kv([['Latest mean water level', num(dd.latest_gwl_mean_m, 2) + ' m bgl'],
          ['Latest reading date', esc(dd.latest_reading_date)],
          ['Monitoring stations', dd.n_stations != null ? dd.n_stations : '—'],
          ['Trend', dd.trend && dd.trend.direction
              ? esc(dd.trend.direction) +
                (dd.trend.mean_slope_m_per_year != null
                  ? ' (' + num(dd.trend.mean_slope_m_per_year, 3) + ' m/yr' +
                    (dd.trend.n_stations_with_trend != null ? ', ' + dd.trend.n_stations_with_trend + ' stations' : '') + ')'
                  : '')
              : '—']]),
      'Source · ' + esc(m.source || 'Central Ground Water Board') + ' · ' + esc(m.unit || 'metres below ground level') +
      ' · real monitoring-station readings, not an interpolated surface.');
  }

  function renderCrops(cs) {
    if (!cs || !cs.records || !cs.records.length) {
      return card('Crops / agriculture', null, na('no DES district crop file for this district.'), null);
    }
    var m = cs.metadata || {};
    var years = [];
    cs.records.forEach(function (r) { if (years.indexOf(r.year) < 0) years.push(r.year); });
    years.sort();
    var latest = years[years.length - 1];
    var rows = cs.records.filter(function (r) { return r.year === latest && r.area_ha != null; })
      .sort(function (a, b) { return b.area_ha - a.area_ha; }).slice(0, 8);
    var h = kv([['Years covered', esc(m.year_range || (years[0] + ' to ' + latest))],
                ['Records', cs.records.length], ['Latest year', esc(latest)]]);
    h += '<div class="chart-wrap u-h140" style="margin-top:8px"><canvas id="cn-chart-crop"></canvas></div>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:11.5px;margin-top:8px">' +
      '<tr style="text-align:left;font-size:9.5px;opacity:.65;letter-spacing:.3px"><th style="padding:3px 0">CROP</th>' +
      '<th>SEASON</th><th style="text-align:right">AREA (ha)</th><th style="text-align:right">YIELD</th></tr>';
    rows.forEach(function (r) {
      h += '<tr style="border-top:1px solid var(--border)"><td style="padding:3px 0">' + esc(r.crop) + '</td>' +
        '<td style="opacity:.8">' + esc(r.season) + '</td>' +
        '<td style="text-align:right">' + num(r.area_ha, 0) + '</td>' +
        '<td style="text-align:right;font-weight:700">' + num(r.yield_per_ha, 2) + '</td></tr>';
    });
    h += '</table>';
    return card('Crops / agriculture', 'DES district',
      h, 'Source · ' + esc(m.source || 'Directorate of Economics & Statistics') + ' · ' + esc(m.year_range || '') +
      ' · top 8 crops by sown area in ' + esc(latest) + '.');
  }

  function renderHorticulture(p, hort) {
    if (!hort || !hort.records || !hort.records.length) {
      return card('Horticulture', 'state level',
        na('the source (Horticultural Statistics at a Glance) does not publish an individually-reported table for ' +
           esc(p.state) + '.'), null);
    }
    var m = hort.metadata || {};
    var years = (m.years_covered || []);
    var latest = years[years.length - 1];
    var rows = hort.records.filter(function (r) { return r.year === latest && r.area_ha != null; })
      .sort(function (a, b) { return b.area_ha - a.area_ha; }).slice(0, 6);
    var h = '<div style="font-size:11.5px;opacity:.85;margin-bottom:6px;line-height:1.55">' +
      '<b>State-level figure for ' + esc(p.state) + '</b> — this source publishes no district-wise horticulture data, ' +
      'so these numbers apply to the whole state, not specifically to ' + esc(p.district) + '.</div>';
    h += '<table style="width:100%;border-collapse:collapse;font-size:11.5px">' +
      '<tr style="text-align:left;font-size:9.5px;opacity:.65"><th style="padding:3px 0">CROP</th>' +
      '<th style="text-align:right">AREA (ha)</th><th style="text-align:right">PRODUCTION (t)</th></tr>';
    rows.forEach(function (r) {
      h += '<tr style="border-top:1px solid var(--border)"><td style="padding:3px 0">' + esc(r.crop) + '</td>' +
        '<td style="text-align:right">' + num(r.area_ha, 0) + '</td>' +
        '<td style="text-align:right;font-weight:700">' + num(r.production_tonnes, 0) + '</td></tr>';
    });
    h += '</table>';
    return card('Horticulture', 'state level', h,
      'Source · ' + esc(m.source || 'Horticultural Statistics at a Glance') + ' · state-level · ' + esc(latest || ''));
  }

  function renderAdvisory(a) {
    if (!a || !a.flags) return card('Advisory flags', null, na('no advisory file for this district.'), null);
    var flags = a.flags, keys = Object.keys(flags);
    if (!keys.length) return card('Advisory flags', 'rule-based', '<div style="font-size:12px;opacity:.8">No flag raised for this district.</div>', null);
    var h = '';
    keys.forEach(function (k) {
      var v = flags[k];
      var txt = (v && typeof v === 'object') ? (v.message || v.level || JSON.stringify(v)) : String(v);
      h += '<div style="display:flex;gap:8px;margin-bottom:5px;font-size:12px;line-height:1.5">' +
        '<b style="flex:0 0 auto;opacity:.75">' + esc(k.replace(/_/g, ' ')) + '</b>' +
        '<span style="opacity:.9">' + esc(txt) + '</span></div>';
    });
    return card('Advisory flags', 'rule-based', h,
      'Source · derived, rule-based layer computed from this portal\'s own published climate/NDVI/soil-moisture outputs. ' +
      'Fixed threshold rules — <b>not</b> a machine-learning model and not a probability score.');
  }

  // ------------------------------------------------------------------
  // Charts (shared chartOpts, same as every other chart in the portal)
  // ------------------------------------------------------------------
  function baseOpts(yTitle, xTitle) {
    var o = (typeof chartOpts === 'function') ? chartOpts({ color: 'rgba(138,211,170,0.15)' })
      : { responsive: true, maintainAspectRatio: false, scales: { x: {}, y: {} }, plugins: {} };
    o.scales = o.scales || {}; o.scales.x = o.scales.x || {}; o.scales.y = o.scales.y || {};
    o.scales.y.title = { display: true, text: yTitle, font: { size: 10, weight: 'bold' } };
    o.scales.x.title = { display: true, text: xTitle, font: { size: 10, weight: 'bold' } };
    return o;
  }

  function drawNdviChart(n) {
    if (!n || !n.annual_ndvi || typeof Chart === 'undefined') return;
    var cv = el('cn-chart-ndvi');
    if (!cv) return;
    charts.ndvi = new Chart(cv, {
      type: 'line',
      data: {
        labels: n.annual_ndvi.map(function (r) { return r.year; }),
        datasets: [{
          label: 'Annual NDVI mean', data: n.annual_ndvi.map(function (r) { return r.ndvi_mean; }),
          borderColor: '#6fc795', backgroundColor: 'rgba(111,199,149,0.15)',
          borderWidth: 2, tension: 0.3, pointRadius: 2, fill: true
        }]
      },
      options: baseOpts('NDVI mean', 'Year')
    });
  }

  function drawCropChart(cs) {
    if (!cs || !cs.records || typeof Chart === 'undefined') return;
    var cv = el('cn-chart-crop');
    if (!cv) return;
    var years = [];
    cs.records.forEach(function (r) { if (years.indexOf(r.year) < 0) years.push(r.year); });
    years.sort();
    var latest = years[years.length - 1];
    var rows = cs.records.filter(function (r) { return r.year === latest && r.area_ha != null; })
      .sort(function (a, b) { return b.area_ha - a.area_ha; }).slice(0, 8);
    charts.crop = new Chart(cv, {
      type: 'bar',
      data: {
        labels: rows.map(function (r) { return r.crop; }),
        datasets: [{
          label: 'Sown area (ha), ' + latest, data: rows.map(function (r) { return r.area_ha; }),
          backgroundColor: 'rgba(92,195,205,0.55)', borderColor: '#5cc3cd', borderWidth: 1
        }]
      },
      options: baseOpts('Area (ha)', 'Crop')
    });
  }

  // ------------------------------------------------------------------
  // Boot
  // ------------------------------------------------------------------
  var tries = 0;
  function boot() {
    var navOk = addNavItem();
    var paneOk = el('pane-cnarmada') || addTabAndPane();
    if ((!navOk || !paneOk) && tries++ < 60) { setTimeout(boot, 600); return; }
    if (BASIN) return;
    fetchJson(BASIN_URL).then(function (j) {
      if (!j || !j.features) {
        var b = el('cn-coverage');
        if (b) b.innerHTML = '<b style="color:#c0392b">Basin layer failed to load.</b>';
        return;
      }
      BASIN = j; FEATS = j.features; BMETA = j.metadata || {};
      fillStates();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 1200); });
  } else {
    setTimeout(boot, 1200);
  }

  window.VindhyaCNarmada = {
    select: function (state, districtSlug) {
      var s = el('cn-state'); if (!s) return;
      s.value = state; onState(state);
      var d = el('cn-district'); if (d) { d.value = districtSlug; onDistrict(districtSlug); }
    }
  };
})();
