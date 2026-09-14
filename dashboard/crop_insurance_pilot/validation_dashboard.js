/*
 * validation_dashboard.js -- GeoAI Crop Insurance Validation Dashboard
 * (owner request, 2026-09-14).
 *
 * Officer-side validation workflow over the existing synthetic 100-farmer
 * pilot dataset. Deliberately a THIRD page rather than an edit of the other
 * two, following the same reasoning CROP_INSURANCE_SYSTEM_PROMPT.md's
 * 2026-09-02 status log already recorded for pilot_study.html: the 8-module
 * page (index.html) carries live-tested real-data integrations, and the
 * 29-section research page carries a runtime-asserted disclaimer contract.
 * Merging a new workflow into either risked regressing work that is already
 * verified. This page reads the SAME dataset and re-uses the SAME real
 * assets; it adds no data of its own.
 *
 * ------------------------------------------------------------------
 * WHAT IS REAL AND WHAT IS SYNTHETIC HERE (do not blur this line)
 * ------------------------------------------------------------------
 *  REAL: the Simrol village boundary (Survey of India via NWDP), the census
 *        population/household counts attached to it, the DES Indore yield
 *        baselines and notified PMFBY farmer-premium caps that the generator
 *        used. These are real published values.
 *  SYNTHETIC: every farmer, name, khasra number, parcel polygon, girdawari
 *        entry, NDVI series, hazard event, loss figure, premium and claim.
 *        The dataset's own SYNTHETIC_DATA_NOTICE says so, and this page
 *        shows that notice rather than paraphrasing it.
 *
 * The one rule this page exists to enforce visually (owner's "core
 * principle"): the cadastral/Khasra area locates the parcel and links it to
 * the land record, and NOTHING else. Every crop, area, loss, yield and
 * insurance number is taken from the GeoAI-validated cultivated area. Where
 * the dataset carries both, both are shown side by side so the difference is
 * auditable rather than hidden -- see areaBasisNote().
 */
(function () {
  'use strict';

  var DATA_URL = '../data/crop_insurance_pilot/synthetic_farmers_100.json';
  var VILLAGE_URL = '../data/crop_insurance_pilot/simrol_boundary.geojson';

  var DATA = null, FARMERS = [], META = {};
  var map = null, baseCad = null, baseSat = null;
  var layerVillage = null, layerParcels = null, layerLabels = null,
      layerSelected = null, layerComponents = null;
  var selected = null;
  var showKhasra = true, showComponents = true;
  var charts = {};

  var COMP_STYLE = {
    cultivated: { color: '#2f7d4f', label: 'Cultivated (GeoAI-detected)' },
    bund:       { color: '#a9803f', label: 'Bund / field boundary' },
    fallow:     { color: '#cbb994', label: 'Fallow / uncropped' },
    road:       { color: '#9aa7b2', label: 'Farm road / access' },
    water:      { color: '#3d7ea6', label: 'Water body' },
    noncrop:    { color: '#7a6a55', label: 'Other non-crop (tree/plantation/structure)' }
  };

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function ha(v) { return (v === null || v === undefined || isNaN(v)) ? '--' : Number(v).toFixed(2) + ' ha'; }
  function pct(v, d) { return (v === null || v === undefined || isNaN(v)) ? '--' : Number(v).toFixed(d == null ? 1 : d) + '%'; }
  // Indian digit grouping, same convention as the dashboard's mandi panel.
  function inr(v) {
    if (v === null || v === undefined || isNaN(v)) return '--';
    var s = Math.round(v).toString(), neg = s.charAt(0) === '-';
    if (neg) s = s.slice(1);
    if (s.length > 3) {
      var last3 = s.slice(-3), rest = s.slice(0, -3);
      s = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
    }
    return (neg ? '-' : '') + '₹' + s;
  }
  function t(v) { return (v === null || v === undefined || v === '') ? '--' : esc(v); }

  // ------------------------------------------------------------------
  // Load
  // ------------------------------------------------------------------
  function fetchJson(url) {
    var c = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = c ? setTimeout(function () { c.abort(); }, 30000) : null;
    return fetch(url, c ? { signal: c.signal } : {})
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + url); return r.json(); })
      .finally(function () { if (timer) clearTimeout(timer); });
  }

  function boot() {
    initMap();
    Promise.all([fetchJson(DATA_URL), fetchJson(VILLAGE_URL).catch(function () { return null; })])
      .then(function (res) {
        DATA = res[0];
        META = DATA.metadata || {};
        FARMERS = DATA.farmers || [];
        try { drawVillage(res[1]); } catch (e) { console.warn('[validation] village boundary:', e); }
        drawAllParcels();
        buildCascade();
        showCoverage();
      })
      .catch(function (err) {
        el('coverage').innerHTML = '<b style="color:#96231f">Dataset failed to load</b> (' + esc(err.message) + ')';
      });
  }

  // Honest coverage line: this pilot is Simrol-only by design
  // (CROP_INSURANCE_SYSTEM_PROMPT.md's own ZAROORI NIYAM #1), so the
  // cascade is built national-shaped but states plainly how far the data
  // actually goes instead of implying statewide coverage.
  function showCoverage() {
    var d = {}, v = {};
    FARMERS.forEach(function (f) { d[f.district] = 1; v[f.village] = 1; });
    el('coverage').innerHTML = FARMERS.length + ' synthetic farmers &middot; ' +
      Object.keys(d).length + ' district, ' + Object.keys(v).length +
      ' village (pilot scope) &middot; village boundary is <b>real</b> Survey of India';
  }

  // ------------------------------------------------------------------
  // Map
  // ------------------------------------------------------------------
  function initMap() {
    map = L.map('map', { zoomControl: true, attributionControl: true });
    map.setView([22.5379, 75.9011], 15);

    // "Cadastral sheet" base: a pale parchment canvas so the parcel
    // geometry reads like a digital land-record sheet (Bhu-Naksha style)
    // rather than a satellite mashup. Satellite stays one click away
    // because the GeoAI evidence only makes sense against imagery.
    // Keyless basemap on purpose: CARTO's light_all now watermarks tiles
    // with "API KEY REQUIRED" (seen live while building this page), and this
    // repo has no tile credentials to hand. Standard OSM at low opacity gives
    // the pale cadastral-sheet ground the parcels are meant to sit on.
    baseCad = L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, opacity: 0.35, attribution: '&copy; OpenStreetMap contributors' });
    baseSat = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles &copy; Esri' });
    baseCad.addTo(map);

    layerVillage = L.layerGroup().addTo(map);
    layerParcels = L.layerGroup().addTo(map);
    layerLabels = L.layerGroup().addTo(map);
    layerComponents = L.layerGroup().addTo(map);
    layerSelected = L.layerGroup().addTo(map);

    el('btnBaseCad').onclick = function () { setBase('cad'); };
    el('btnBaseSat').onclick = function () { setBase('sat'); };
    el('btnLyrKhasra').onclick = function () {
      showKhasra = !showKhasra; this.classList.toggle('on', showKhasra);
      if (showKhasra) map.addLayer(layerLabels); else map.removeLayer(layerLabels);
    };
    el('btnLyrComp').onclick = function () {
      showComponents = !showComponents; this.classList.toggle('on', showComponents);
      renderComponents();
    };
    el('btnZoomVillage').onclick = function () {
      if (layerVillage.getLayers().length) {
        var b = L.featureGroup(layerVillage.getLayers()).getBounds();
        if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });
      }
    };
    el('btnZoomParcel').onclick = zoomToParcel;
  }

  function setBase(which) {
    var cad = which === 'cad';
    el('btnBaseCad').classList.toggle('on', cad);
    el('btnBaseSat').classList.toggle('on', !cad);
    if (cad) { map.removeLayer(baseSat); baseCad.addTo(map); }
    else { map.removeLayer(baseCad); baseSat.addTo(map); }
  }

  function drawVillage(geo) {
    layerVillage.clearLayers();
    if (!geo) return;
    // simrol_boundary.geojson is {metadata, feature}, not a bare GeoJSON
    // object -- passing it straight to L.geoJSON throws "Invalid GeoJSON
    // object" and took the whole Promise.all into its catch, which is why
    // the page first reported "Dataset failed to load" when the dataset had
    // in fact loaded fine.
    if (geo && !geo.type && geo.feature) geo = geo.feature;
    if (!geo || !geo.type) return;
    L.geoJSON(geo, {
      style: { color: '#0d5c63', weight: 2.5, fill: false, dashArray: '6 4' }
    }).addTo(layerVillage);
    var b = L.geoJSON(geo).getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });
  }

  function drawAllParcels() {
    layerParcels.clearLayers();
    layerLabels.clearLayers();
    FARMERS.forEach(function (f) {
      if (!f.geometry) return;
      var poly = L.geoJSON(f.geometry, {
        style: {
          color: '#6b4f2a', weight: 1, fillColor: '#e8dcc2', fillOpacity: 0.45
        }
      });
      poly.on('click', function () { selectFarmer(f.farmer_id, true); });
      poly.bindTooltip(esc(f.khasra_no) + ' &middot; ' + esc(f.farmer_name), { sticky: true });
      poly.addTo(layerParcels);

      if (f.centroid) {
        L.marker([f.centroid[1], f.centroid[0]], {
          interactive: false,
          icon: L.divIcon({ className: '', html: '<div class="khasra-label">' + esc(f.khasra_no) + '</div>', iconSize: null })
        }).addTo(layerLabels);
      }
    });
  }

  function renderSelectedOnMap() {
    layerSelected.clearLayers();
    if (!selected || !selected.geometry) return;
    L.geoJSON(selected.geometry, {
      style: { color: '#b3341f', weight: 3, fill: false }
    }).addTo(layerSelected);
    renderComponents();
  }

  // The land-use split is drawn from the dataset's own component polygons
  // (generated by negative-buffer ring + difference, so they sum to the
  // cadastral area) -- not re-derived here.
  function renderComponents() {
    layerComponents.clearLayers();
    if (!selected || !showComponents || !selected.components) return;
    Object.keys(COMP_STYLE).forEach(function (key) {
      var g = selected.components[key];
      if (!g) return;
      L.geoJSON(g, {
        style: { color: COMP_STYLE[key].color, weight: 1, fillColor: COMP_STYLE[key].color, fillOpacity: 0.55 }
      }).bindTooltip(COMP_STYLE[key].label).addTo(layerComponents);
    });
  }

  function zoomToParcel() {
    if (!selected || !selected.geometry) return;
    var b = L.geoJSON(selected.geometry).getBounds();
    if (b.isValid()) map.fitBounds(b, { padding: [60, 60], maxZoom: 19 });
  }

  // ------------------------------------------------------------------
  // Cascade: District -> Village -> Farmer
  // ------------------------------------------------------------------
  function buildCascade() {
    var dsel = el('selDistrict');
    var districts = [];
    FARMERS.forEach(function (f) { if (districts.indexOf(f.district) < 0) districts.push(f.district); });
    districts.sort();
    districts.forEach(function (d) {
      var o = document.createElement('option'); o.value = d; o.textContent = d; dsel.appendChild(o);
    });

    dsel.onchange = function () { fillVillages(this.value); };
    el('selVillage').onchange = function () { fillFarmers(el('selDistrict').value, this.value); };
    el('selFarmer').onchange = function () { selectFarmer(this.value, false); };
    el('btnClear').onclick = clearAll;
    el('btnReport').onclick = openReport;
    el('btnCloseReport').onclick = function () { el('reportModal').classList.remove('open'); };

    // Single district in the pilot -- preselect it rather than making the
    // officer pick from a list of one.
    if (districts.length === 1) { dsel.value = districts[0]; fillVillages(districts[0]); }
  }

  function fillVillages(district) {
    var vsel = el('selVillage');
    vsel.innerHTML = '<option value="">-- Select village --</option>';
    resetFarmerSelect('-- Select village first --');
    clearSelection();
    if (!district) { vsel.disabled = true; vsel.innerHTML = '<option value="">-- Select district first --</option>'; return; }
    var vs = [];
    FARMERS.forEach(function (f) { if (f.district === district && vs.indexOf(f.village) < 0) vs.push(f.village); });
    vs.sort();
    vs.forEach(function (v) {
      var o = document.createElement('option'); o.value = v; o.textContent = v; vsel.appendChild(o);
    });
    vsel.disabled = false;
    if (vs.length === 1) { vsel.value = vs[0]; fillFarmers(district, vs[0]); }
  }

  function fillFarmers(district, village) {
    var fsel = el('selFarmer');
    fsel.innerHTML = '<option value="">-- Select farmer --</option>';
    clearSelection();
    if (!village) { resetFarmerSelect('-- Select village first --'); return; }
    var rows = FARMERS.filter(function (f) { return f.district === district && f.village === village; });
    rows.sort(function (a, b) { return String(a.farmer_id).localeCompare(String(b.farmer_id)); });
    rows.forEach(function (f) {
      var o = document.createElement('option');
      o.value = f.farmer_id;
      o.textContent = f.farmer_id + ' · ' + f.farmer_name + ' · ' + f.khasra_no;
      fsel.appendChild(o);
    });
    fsel.disabled = false;
  }

  function resetFarmerSelect(msg) {
    var fsel = el('selFarmer');
    fsel.innerHTML = '<option value="">' + msg + '</option>';
    fsel.disabled = true;
  }

  function clearSelection() {
    selected = null;
    layerSelected.clearLayers();
    layerComponents.clearLayers();
    el('btnReport').disabled = true;
    el('btnZoomParcel').disabled = true;
    destroyCharts();
    ['panelParcel', 'panelArea', 'panelLandUse', 'panelHazard', 'panelLoss', 'panelInsurance']
      .forEach(function (id) { el(id).innerHTML = '<div class="empty">&mdash;</div>'; });
    el('panelParcel').innerHTML = '<div class="empty"><b>No farmer selected</b>Choose a farmer to begin validation.</div>';
    el('integratedBody').innerHTML = '<div class="empty"><b>No farmer selected</b>Pick District &rarr; Village &rarr; Farmer above.</div>';
  }

  function clearAll() {
    el('selVillage').value = '';
    el('selFarmer').value = '';
    clearSelection();
  }

  function destroyCharts() {
    Object.keys(charts).forEach(function (k) {
      try { charts[k].destroy(); } catch (e) {}
      delete charts[k];
    });
  }

  // Map click and dropdown must land in exactly the same state -- the map
  // path simply drives the same <select> and then shares this function,
  // so the two cannot diverge.
  function selectFarmer(farmerId, fromMap) {
    if (!farmerId) { clearSelection(); return; }
    var f = FARMERS.filter(function (x) { return String(x.farmer_id) === String(farmerId); })[0];
    if (!f) { clearSelection(); return; }

    // Sync the dropdowns FIRST, then set `selected`. fillVillages() and
    // fillFarmers() both call clearSelection(), which nulls `selected` --
    // assigning before this block left renderSelectedOnMap() with nothing
    // to draw on the map-click path (caught by reading the call chain, and
    // confirmed live: clicking a parcel selected it in the dropdown but
    // drew no highlight).
    if (fromMap) {
      if (el('selDistrict').value !== f.district) { el('selDistrict').value = f.district; fillVillages(f.district); }
      if (el('selVillage').value !== f.village) { el('selVillage').value = f.village; fillFarmers(f.district, f.village); }
      el('selFarmer').value = f.farmer_id;
    }
    selected = f;

    el('btnReport').disabled = false;
    el('btnZoomParcel').disabled = false;
    renderSelectedOnMap();
    zoomToParcel();
    destroyCharts();
    renderParcel(f);
    renderArea(f);
    renderLandUse(f);
    renderHazard(f);
    renderLoss(f);
    renderInsurance(f);
    renderIntegrated(f);
  }

  // ------------------------------------------------------------------
  // Panels
  // ------------------------------------------------------------------
  function areaBasisNote() {
    return '<div class="note"><b>Basis:</b> every figure in this panel is computed on the ' +
      '<b>GeoAI-detected cultivated area</b>. The cadastral / Khasra area is shown only to locate the parcel ' +
      'and to expose the difference &mdash; it is never the basis of a loss or claim figure.</div>';
  }

  function renderParcel(f) {
    var h = '<div class="big">' +
      '<div class="b refbox"><div class="lab">Khasra / parcel</div><div class="val">' + t(f.khasra_no) + '</div>' +
      '<div class="sub">' + t(f.parcel_id) + '</div></div>' +
      '<div class="b refbox"><div class="lab">Cadastral area</div><div class="val">' + ha(f.cadastral_area_ha) + '</div>' +
      '<div class="sub">reference only</div></div>' +
      '</div>';
    h += '<div class="kv">' +
      row('Farmer', t(f.farmer_name) + (f.farmer_name_local ? ' <span style="color:#64798e">(' + t(f.farmer_name_local) + ')</span>' : '')) +
      row('Farmer ID', t(f.farmer_id)) +
      row('Village / Tehsil', t(f.village) + ' / ' + t(f.tehsil)) +
      row('District / State', t(f.district) + ' / ' + t(f.state)) +
      row('Land status', t(f.land_status)) +
      '<div class="sep"></div>' +
      row('Girdawari crop', t(f.girdawari && f.girdawari.crop)) +
      row('Girdawari season', t(f.girdawari && f.girdawari.season)) +
      row('Girdawari reported area', ha(f.girdawari && f.girdawari.reported_area_ha)) +
      row('Girdawari reported loss', pct(f.girdawari && f.girdawari.reported_loss_pct)) +
      row('Record / evidence', t(f.girdawari && f.girdawari.record_id) + ' &middot; ' + t(f.girdawari && f.girdawari.evidence_available)) +
      row('Assessment status', t(f.girdawari && f.girdawari.assessment_status)) +
      '</div>';
    h += '<div class="note">Khasra number, parcel polygon and girdawari entry are <b>synthetic</b>. The village they sit ' +
      'in (' + t(f.village) + ', LGD ' + t(META.village_real_boundary && META.village_real_boundary.vil_lgd) +
      ') and its boundary are <b>real</b> Survey of India data.</div>';
    el('panelParcel').innerHTML = h;
  }

  function row(k, v) { return '<div class="k">' + k + '</div><div class="v">' + v + '</div>'; }

  function renderArea(f) {
    var tech = f.tech || {};
    var cad = f.cadastral_area_ha, det = tech.detected_cultivated_area_ha, rec = f.cultivated_area_ha;
    var diffPct = tech.area_difference_pct;
    var cls = (diffPct >= 30) ? 'bad' : (diffPct >= 15 ? 'warn' : 'ok');
    var h = '<div class="big">' +
      '<div class="b hero"><div class="lab">Actual cultivated (GeoAI)</div><div class="val">' + ha(det) + '</div>' +
      '<div class="sub">basis for every calculation</div></div>' +
      '<div class="b refbox"><div class="lab">Cadastral / Khasra</div><div class="val">' + ha(cad) + '</div>' +
      '<div class="sub">reference only</div></div>' +
      '<div class="b"><div class="lab">Difference</div><div class="val">' + ha(tech.area_difference_ha) + '</div>' +
      '<div class="sub"><span class="tag ' + cls + '">' + pct(diffPct) + ' of cadastral</span></div></div>' +
      '</div>';
    h += '<div class="kv">' +
      row('Crop identified (GeoAI)', t(tech.ai_crop)) +
      row('Classifier confidence', pct(tech.ai_confidence_pct)) +
      row('Crop stage', t(tech.crop_stage)) +
      row('Crop health score', (tech.crop_health_score != null ? tech.crop_health_score + ' / 100' : '--')) +
      row('Vegetation anomaly', t(tech.vegetation_anomaly)) +
      '<div class="sep"></div>' +
      row('Cultivated (parcel geometry)', ha(rec)) +
      row('Irrigated / rainfed', ha(f.irrigated_area_ha) + ' / ' + ha(f.rainfed_area_ha)) +
      row('Irrigation source', t(f.irrigation_source)) +
      '</div>';

    if (tech.ai_confidence_components && tech.ai_confidence_components.length) {
      h += '<div style="margin-top:11px"><table class="t"><thead><tr><th>Confidence factor</th><th style="text-align:right">Score</th><th style="text-align:right">Weight</th></tr></thead><tbody>';
      tech.ai_confidence_components.forEach(function (c) {
        h += '<tr><td>' + t(c.factor) + '<div style="color:#64798e;font-size:11.5px">' + t(c.value) + '</div></td>' +
          '<td class="n">' + (c.score != null ? Number(c.score).toFixed(1) : '--') + '</td>' +
          '<td class="n">' + (c.weight != null ? Number(c.weight).toFixed(2) : '--') + '</td></tr>';
      });
      h += '</tbody></table></div>';
    }
    h += areaBasisNote();
    el('panelArea').innerHTML = h;
  }

  function renderLandUse(f) {
    var parts = [
      { key: 'cultivated', v: f.cultivated_area_ha },
      { key: 'bund', v: f.bund_area_ha },
      { key: 'fallow', v: f.fallow_area_ha },
      { key: 'road', v: f.farm_road_ha },
      { key: 'water', v: f.waterbody_ha },
      { key: 'noncrop', v: f.noncrop_area_ha }
    ].filter(function (p) { return p.v != null; });
    var sum = parts.reduce(function (a, p) { return a + (p.v || 0); }, 0);

    var h = '<div class="chartbox"><canvas id="chartLandUse"></canvas></div>';
    h += '<table class="t" style="margin-top:10px"><thead><tr><th>Class</th><th style="text-align:right">Area</th><th style="text-align:right">Share</th></tr></thead><tbody>';
    parts.forEach(function (p) {
      h += '<tr><td><span style="display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;background:' +
        COMP_STYLE[p.key].color + '"></span>' + COMP_STYLE[p.key].label + '</td>' +
        '<td class="n">' + ha(p.v) + '</td>' +
        '<td class="n">' + (sum > 0 ? pct(p.v / sum * 100) : '--') + '</td></tr>';
    });
    h += '<tr class="total"><td>Total (= cadastral area)</td><td class="n">' + ha(sum) + '</td><td class="n">100.0%</td></tr>';
    h += '</tbody></table>';
    h += '<div class="note">Component polygons come from the dataset itself (negative-buffer ring + geometric difference), ' +
      'which is why they sum to the cadastral area rather than being counted independently. ' +
      '<b>Only the cultivated class</b> feeds the loss, yield and insurance calculations below.</div>';
    el('panelLandUse').innerHTML = h;

    var cv = el('chartLandUse');
    if (cv && typeof Chart !== 'undefined') {
      charts.landuse = new Chart(cv, {
        type: 'doughnut',
        data: {
          labels: parts.map(function (p) { return COMP_STYLE[p.key].label; }),
          datasets: [{
            data: parts.map(function (p) { return Number((p.v || 0).toFixed(3)); }),
            backgroundColor: parts.map(function (p) { return COMP_STYLE[p.key].color; }),
            borderWidth: 1, borderColor: '#fff'
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '55%',
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: function (i) {
              return i.label + ': ' + Number(i.parsed).toFixed(2) + ' ha (' +
                (sum > 0 ? (i.parsed / sum * 100).toFixed(1) : '--') + '%)';
            } } }
          }
        }
      });
    }
  }

  function intensityTag(intensity) {
    var s = String(intensity || '').toLowerCase();
    if (s.indexOf('very severe') >= 0 || s.indexOf('extreme') >= 0) return 'bad';
    if (s.indexOf('severe') >= 0) return 'bad';
    if (s.indexOf('moderate') >= 0) return 'warn';
    return 'ok';
  }

  function renderHazard(f) {
    var e = f.event;
    if (!e) {
      el('panelHazard').innerHTML = '<div class="big">' +
        '<div class="b"><div class="lab">Crop (GeoAI)</div><div class="val" style="font-size:16px">' +
        t(f.tech && f.tech.ai_crop) + '</div></div>' +
        '<div class="b"><div class="lab">Hazard event</div><div class="val" style="font-size:16px">None recorded</div>' +
        '<div class="sub">healthy-crop scenario</div></div></div>' +
        '<div class="note">This synthetic farmer is in the healthy-crop group: no adverse climate event is recorded for the ' +
        'season, so there is no hazard-driven loss to validate. Yield and insurance below still reflect the ' +
        'cultivated area.</div>';
      return;
    }
    var h = '<div class="big">' +
      '<div class="b"><div class="lab">Crop (GeoAI)</div><div class="val" style="font-size:16px">' + t(f.tech && f.tech.ai_crop) + '</div>' +
      '<div class="sub">girdawari says ' + t(f.girdawari && f.girdawari.crop) + '</div></div>' +
      '<div class="b"><div class="lab">Hazard</div><div class="val" style="font-size:15px">' + t(e.type) + '</div>' +
      '<div class="sub"><span class="tag ' + intensityTag(e.intensity) + '">' + t(e.intensity) + '</span></div></div>' +
      '<div class="b"><div class="lab">Affected area</div><div class="val">' + ha(e.affected_area_ha) + '</div>' +
      '<div class="sub">within cultivated area</div></div>' +
      '</div>';
    h += '<div class="kv">' +
      row('Event date', t(e.date)) +
      row('Description', t(e.description)) +
      row('Condition before', t(e.pre_event_condition)) +
      row('Condition after', t(e.post_event_condition)) +
      '<div class="sep"></div>' +
      row('NDVI before event', e.pre_event_ndvi != null ? Number(e.pre_event_ndvi).toFixed(3) : '--') +
      row('NDVI after event', e.post_event_ndvi != null ? Number(e.post_event_ndvi).toFixed(3) : '--') +
      row('NDVI expected (undamaged)', e.expected_ndvi != null ? Number(e.expected_ndvi).toFixed(3) : '--') +
      row('Decline vs expected', pct(e.ndvi_decline_pct)) +
      '</div>';
    h += '<div class="note">Damage is measured against the <b>expected undamaged NDVI for that date</b>, not against the ' +
      'previous month &mdash; early-season canopy growth would otherwise register as negative loss. The expected ' +
      'baseline is shown above so the figure can be checked.</div>';
    el('panelHazard').innerHTML = h;
  }

  function renderLoss(f) {
    var e = f.event || {}, ins = f.insurance || {}, tech = f.tech || {};
    var cult = tech.detected_cultivated_area_ha != null ? tech.detected_cultivated_area_ha : f.cultivated_area_ha;
    var affected = e.affected_area_ha;
    var lossPct = (affected != null && cult) ? (affected / cult * 100) : null;

    var h = '<div class="big">' +
      '<div class="b hero"><div class="lab">Cultivated area</div><div class="val">' + ha(cult) + '</div>' +
      '<div class="sub">GeoAI basis</div></div>' +
      '<div class="b"><div class="lab">Affected / lost</div><div class="val">' + ha(affected) + '</div>' +
      '<div class="sub">' + (lossPct != null ? pct(lossPct) + ' of cultivated' : 'no event') + '</div></div>' +
      '<div class="b"><div class="lab">Yield shortfall</div><div class="val">' + pct(ins.yield_shortfall_pct) + '</div>' +
      '<div class="sub">vs threshold yield</div></div>' +
      '</div>';
    h += '<div class="kv">' +
      row('Expected yield (threshold)', ins.threshold_yield_t_ha != null ? Number(ins.threshold_yield_t_ha).toFixed(3) + ' t/ha' : '--') +
      row('Estimated actual yield', ins.actual_yield_t_ha != null ? Number(ins.actual_yield_t_ha).toFixed(3) + ' t/ha' : '--') +
      row('Indemnity level', pct(ins.indemnity_level_pct, 0)) +
      '<div class="sep"></div>' +
      row('Expected production (cultivated)', prod(ins.threshold_yield_t_ha, cult)) +
      row('Estimated production (cultivated)', prod(ins.actual_yield_t_ha, cult)) +
      row('Production shortfall', prodDiff(ins.threshold_yield_t_ha, ins.actual_yield_t_ha, cult)) +
      '</div>';
    h += '<div class="chartbox" style="margin-top:11px"><canvas id="chartYield"></canvas></div>';
    h += '<div class="note">Production figures are yield &times; <b>cultivated</b> area. Using the cadastral area ' +
      '(' + ha(f.cadastral_area_ha) + ') instead would overstate production by ' +
      prodDiff(ins.threshold_yield_t_ha, 0, (f.cadastral_area_ha || 0) - (cult || 0)) + ' at threshold yield ' +
      '&mdash; which is exactly why this dashboard does not do that.</div>';
    el('panelLoss').innerHTML = h;

    var cv = el('chartYield');
    if (cv && typeof Chart !== 'undefined' && ins.threshold_yield_t_ha != null) {
      charts.yield = new Chart(cv, {
        type: 'bar',
        data: {
          labels: ['Expected (threshold)', 'Estimated actual'],
          datasets: [{
            label: 't/ha',
            data: [Number(ins.threshold_yield_t_ha), Number(ins.actual_yield_t_ha)],
            backgroundColor: ['#9aa7b2', '#b3341f'], borderRadius: 4
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false },
            tooltip: { callbacks: { label: function (i) { return Number(i.parsed.y).toFixed(3) + ' t/ha'; } } } },
          scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Yield (t/ha)', font: { size: 10, weight: 'bold' } } },
            x: { grid: { display: false } }
          }
        }
      });
    }
  }

  function prod(yieldTha, areaHa) {
    if (yieldTha == null || areaHa == null) return '--';
    return (Number(yieldTha) * Number(areaHa)).toFixed(3) + ' t';
  }
  function prodDiff(a, b, areaHa) {
    if (a == null || b == null || areaHa == null) return '--';
    return ((Number(a) - Number(b)) * Number(areaHa)).toFixed(3) + ' t';
  }

  function renderInsurance(f) {
    var ins = f.insurance || {}, tech = f.tech || {};
    var cult = tech.detected_cultivated_area_ha != null ? tech.detected_cultivated_area_ha : f.cultivated_area_ha;
    var si = ins.sum_insured, siHa = ins.sum_insured_per_ha;
    // Indicative crop value and loss value are derived here from the
    // dataset's own real-DES-derived yield numbers and the notified sum
    // insured per hectare -- both on the CULTIVATED area, never cadastral.
    var lossValue = (ins.yield_shortfall_pct != null && si != null)
      ? (ins.yield_shortfall_pct / 100) * si : null;

    var h = '<div class="big">' +
      '<div class="b hero"><div class="lab">Indicative claim</div><div class="val">' + inr(ins.indicative_claim) + '</div>' +
      '<div class="sub">yield-shortfall basis</div></div>' +
      '<div class="b"><div class="lab">Sum insured</div><div class="val">' + inr(si) + '</div>' +
      '<div class="sub">' + inr(siHa) + '/ha &times; ' + ha(ins.insured_area_ha) + '</div></div>' +
      '</div>';
    h += '<div class="kv">' +
      row('Insured area', ha(ins.insured_area_ha)) +
      row('Sum insured per ha', inr(siHa)) +
      row('Sum insured (total)', inr(si)) +
      row('Indicative loss value', inr(lossValue)) +
      '<div class="sep"></div>' +
      row('Farmer premium rate', pct(ins.farmer_premium_rate_pct) + ' (' + t(ins.premium_rate_basis) + ')') +
      row('Farmer premium', inr(ins.farmer_premium)) +
      row('Gross premium', inr(ins.gross_premium)) +
      row('Government subsidy', inr(ins.subsidy)) +
      '<div class="sep"></div>' +
      row('Threshold yield', ins.threshold_yield_t_ha != null ? Number(ins.threshold_yield_t_ha).toFixed(3) + ' t/ha' : '--') +
      row('Actual yield', ins.actual_yield_t_ha != null ? Number(ins.actual_yield_t_ha).toFixed(3) + ' t/ha' : '--') +
      row('Yield shortfall', pct(ins.yield_shortfall_pct)) +
      row('Policy status', t(ins.status)) +
      '</div>';
    h += '<div class="note"><b>Claim basis.</b> The indicative claim follows PMFBY\'s yield-shortfall formula ' +
      '(shortfall &divide; threshold &times; sum insured), <b>not</b> damage-area &times; sum insured. The sum insured ' +
      'itself is built on the <b>insured/cultivated</b> area (' + ha(ins.insured_area_ha) + '), not the cadastral area ' +
      '(' + ha(f.cadastral_area_ha) + '). Premium caps and yield baselines come from real notified PMFBY rates and real ' +
      'DES Indore yield history; the policy record itself is synthetic.</div>';
    el('panelInsurance').innerHTML = h;
  }

  function renderIntegrated(f) {
    var tech = f.tech || {}, ins = f.insurance || {}, e = f.event || {}, g = f.girdawari || {};
    var cult = tech.detected_cultivated_area_ha != null ? tech.detected_cultivated_area_ha : f.cultivated_area_ha;
    var rows = [
      ['Cadastral / land record', f.khasra_no + ' &middot; ' + ha(f.cadastral_area_ha), 'Survey/record reference only', 'ref'],
      ['Girdawari (field record)', t(g.crop) + ' &middot; ' + ha(g.reported_area_ha) + ' &middot; loss ' + pct(g.reported_loss_pct), t(g.assessment_status), 'syn'],
      ['GeoAI cultivated area', ha(cult), 'difference vs cadastral ' + pct(tech.area_difference_pct), 'ai'],
      ['GeoAI crop identification', t(tech.ai_crop), 'confidence ' + pct(tech.ai_confidence_pct), 'ai'],
      ['Satellite evidence', (e.post_event_ndvi != null ? 'NDVI ' + Number(e.post_event_ndvi).toFixed(3) + ' vs expected ' + Number(e.expected_ndvi).toFixed(3) : 'season NDVI series'), 'Sentinel-2 style series (simulated)', 'syn'],
      ['Climate hazard', e.type ? t(e.type) + ' &middot; ' + t(e.date) : 'None recorded', e.intensity ? t(e.intensity) + ' &middot; ' + ha(e.affected_area_ha) + ' affected' : '--', e.type ? intensityTag(e.intensity) : 'ok'],
      ['Crop loss', e.affected_area_ha != null && cult ? pct(e.affected_area_ha / cult * 100) + ' of cultivated' : 'no event', 'area basis: GeoAI cultivated', 'ai'],
      ['Yield estimate', (ins.actual_yield_t_ha != null ? Number(ins.actual_yield_t_ha).toFixed(3) + ' t/ha' : '--'), 'threshold ' + (ins.threshold_yield_t_ha != null ? Number(ins.threshold_yield_t_ha).toFixed(3) : '--') + ' t/ha', 'ai'],
      ['Insurance assessment', inr(ins.indicative_claim), 'on sum insured ' + inr(ins.sum_insured), 'syn']
    ];
    var h = '<table class="t"><thead><tr><th>Validation layer</th><th>Value</th><th>Basis / note</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td><span class="tag ' + r[3] + '">' + r[3] + '</span> ' + r[2] + '</td></tr>';
    });
    h += '</tbody></table>';

    // Consistency checks an officer would actually want flagged.
    var flags = [];
    if (tech.ai_crop && g.crop && tech.ai_crop !== g.crop) {
      flags.push(['bad', 'Crop mismatch', 'GeoAI identifies <b>' + t(tech.ai_crop) + '</b> but girdawari records <b>' + t(g.crop) + '</b>. Field verification required before settlement.']);
    }
    if (tech.area_difference_pct != null && tech.area_difference_pct >= 30) {
      flags.push(['warn', 'Area mismatch', 'GeoAI cultivated area is ' + pct(tech.area_difference_pct) + ' below the cadastral area. Some gap is normal (bund, road, fallow); this one is above the pilot\'s 30% review threshold.']);
    }
    if (g.reported_loss_pct != null && e.ndvi_decline_pct != null && Math.abs(g.reported_loss_pct - e.ndvi_decline_pct) > 20) {
      flags.push(['warn', 'Loss discrepancy', 'Girdawari reports ' + pct(g.reported_loss_pct) + ' loss; satellite anomaly indicates ' + pct(e.ndvi_decline_pct) + '. Difference exceeds 20 points.']);
    }
    if (f.anomalies && f.anomalies.length) {
      f.anomalies.forEach(function (a) {
        flags.push(['warn', 'Flagged anomaly', typeof a === 'string' ? esc(a) : esc(JSON.stringify(a))]);
      });
    }
    if (!flags.length) flags.push(['ok', 'No inconsistency flagged', 'Land record, GeoAI detection and satellite evidence agree within the pilot\'s review thresholds.']);

    h += '<div style="margin-top:13px">';
    flags.forEach(function (fl) {
      h += '<div style="display:flex;gap:9px;align-items:flex-start;margin-bottom:7px">' +
        '<span class="tag ' + fl[0] + '" style="flex:0 0 auto;margin-top:1px">' + fl[1] + '</span>' +
        '<span style="font-size:12.5px;color:#33465a">' + fl[2] + '</span></div>';
    });
    h += '</div>';
    h += '<div class="note">' + esc(META.SYNTHETIC_DATA_NOTICE || '') + '</div>';
    el('integratedBody').innerHTML = h;
  }

  // ------------------------------------------------------------------
  // Officer report
  // ------------------------------------------------------------------
  function openReport() {
    if (!selected) return;
    var f = selected, tech = f.tech || {}, ins = f.insurance || {}, e = f.event || {}, g = f.girdawari || {};
    var cult = tech.detected_cultivated_area_ha != null ? tech.detected_cultivated_area_ha : f.cultivated_area_ha;
    var now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    el('repSub').innerHTML = 'Generated ' + now + ' &middot; pilot validation workflow &middot; ' +
      '<b style="color:#8a2f00">SYNTHETIC / NOT AN OFFICIAL DETERMINATION</b>';

    function sec(title, kv) {
      var h = '<div class="sec"><h4>' + title + '</h4><div class="kv">';
      kv.forEach(function (r) { h += row(r[0], r[1]); });
      return h + '</div></div>';
    }

    var h = '';
    h += '<div style="background:#fff1e6;border:1px solid #e0873f;border-radius:7px;padding:9px 12px;font-size:12px;color:#8a2f00;font-weight:700">' +
      esc(META.SYNTHETIC_DATA_NOTICE || 'SYNTHETIC DATA') + '</div>';

    h += sec('Identification', [
      ['Farmer ID', t(f.farmer_id)],
      ['Farmer name', t(f.farmer_name)],
      ['District', t(f.district)],
      ['Tehsil', t(f.tehsil)],
      ['Village', t(f.village)],
      ['Parcel / Khasra reference', t(f.khasra_no) + ' (' + t(f.parcel_id) + ')'],
      ['Land status', t(f.land_status)]
    ]);

    h += sec('Area validation (basis of all figures below)', [
      ['Cadastral / Khasra area', ha(f.cadastral_area_ha) + ' &mdash; reference only'],
      ['<b>GeoAI actual cultivated area</b>', '<b>' + ha(cult) + '</b>'],
      ['Difference', ha(tech.area_difference_ha) + ' (' + pct(tech.area_difference_pct) + ')'],
      ['Bund / fallow / road / water / other', ha(f.bund_area_ha) + ' / ' + ha(f.fallow_area_ha) + ' / ' +
        ha(f.farm_road_ha) + ' / ' + ha(f.waterbody_ha) + ' / ' + ha(f.noncrop_area_ha)]
    ]);

    h += sec('Crop', [
      ['Crop (GeoAI)', t(tech.ai_crop) + ' &middot; confidence ' + pct(tech.ai_confidence_pct)],
      ['Crop (girdawari)', t(g.crop)],
      ['Season', t(g.season)],
      ['Crop stage', t(tech.crop_stage)],
      ['Crop health score', tech.crop_health_score != null ? tech.crop_health_score + ' / 100' : '--']
    ]);

    h += sec('Hazard event', e.type ? [
      ['Event', t(e.type)],
      ['Date', t(e.date)],
      ['Intensity', t(e.intensity)],
      ['Affected area', ha(e.affected_area_ha)],
      ['NDVI after vs expected', (e.post_event_ndvi != null ? Number(e.post_event_ndvi).toFixed(3) : '--') +
        ' vs ' + (e.expected_ndvi != null ? Number(e.expected_ndvi).toFixed(3) : '--')],
      ['Decline vs expected', pct(e.ndvi_decline_pct)]
    ] : [['Event', 'None recorded for this season (healthy-crop scenario)']]);

    h += sec('Crop loss and yield', [
      ['Affected / lost area', ha(e.affected_area_ha)],
      ['Crop loss (% of cultivated)', (e.affected_area_ha != null && cult) ? pct(e.affected_area_ha / cult * 100) : '--'],
      ['Expected yield (threshold)', ins.threshold_yield_t_ha != null ? Number(ins.threshold_yield_t_ha).toFixed(3) + ' t/ha' : '--'],
      ['Estimated actual yield', ins.actual_yield_t_ha != null ? Number(ins.actual_yield_t_ha).toFixed(3) + ' t/ha' : '--'],
      ['Yield shortfall', pct(ins.yield_shortfall_pct)],
      ['Expected production (cultivated)', prod(ins.threshold_yield_t_ha, cult)],
      ['Estimated production (cultivated)', prod(ins.actual_yield_t_ha, cult)]
    ]);

    h += sec('Insurance and scheme assessment', [
      ['Scheme basis', 'PMFBY-style yield-shortfall (indicative)'],
      ['Insured area', ha(ins.insured_area_ha)],
      ['Sum insured per ha', inr(ins.sum_insured_per_ha)],
      ['Sum insured', inr(ins.sum_insured)],
      ['Farmer premium', inr(ins.farmer_premium) + ' at ' + pct(ins.farmer_premium_rate_pct)],
      ['Gross premium / subsidy', inr(ins.gross_premium) + ' / ' + inr(ins.subsidy)],
      ['Indemnity level', pct(ins.indemnity_level_pct, 0)],
      ['<b>Indicative claim</b>', '<b>' + inr(ins.indicative_claim) + '</b>'],
      ['Policy status', t(ins.status)]
    ]);

    h += sec('Officer decision', [
      ['Assessment status', t(g.assessment_status)],
      ['Evidence on record', t(g.evidence_available)],
      ['Verified by', '________________________'],
      ['Date', '________________________']
    ]);

    h += '<div style="margin-top:16px;font-size:11.5px;color:#64798e;border-top:1px solid #dfe6ee;padding-top:9px;line-height:1.6">' +
      esc(META.disclaimer || '') + '</div>';

    el('reportBody').innerHTML = h;
    el('reportModal').classList.add('open');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
