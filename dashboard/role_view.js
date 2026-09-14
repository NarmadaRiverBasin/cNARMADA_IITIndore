/* ============================================================
   role_view.js -- AUDIT_FIX_PROMPT.md item 0D: three-role layered view
   ------------------------------------------------------------
   Spec origin note (honesty, per CLAUDE.md): AUDIT_FIX_PROMPT.md as
   checked in does NOT contain a "0D. TEEN-ROLE LAYERED VIEW" section --
   the whole repo was grepped for "0D"/"TEEN-ROLE"/"भूमिका" and nothing
   was found. This module is built to the spec the owner relayed in the
   2026-09-14 task brief, and that spec is transcribed verbatim into
   AUDIT_FIX_PROMPT.md's new "0D" section by this same change, so the
   file and the code agree from now on.

   WHAT THIS IS -- and what it deliberately is NOT
   -----------------------------------------------
   This is PURE UI PERSONALISATION: it only decides which already-built
   panel a visitor LANDS ON first, which font size they read it at, and
   which language it opens in. It is NOT a permission system.

   * Every panel stays reachable from every role. Nothing is deleted,
     nothing is disabled, no request is ever refused.
   * There is deliberately NO "access denied" / "permission denied" /
     "not authorised" string anywhere in this file. The three
     "technical" tabs a farmer does not land on are hidden behind an
     explicit "Advanced view दिखाएं" toggle that reveals them in place --
     one click, no gate, no explanation owed.
   * It invents NO data. It moves no numbers, computes no numbers, and
     hides no real value from anyone. Every pane it activates renders
     exactly the same real, sourced content it renders for every other
     role.

   ROLE -> DEFAULT VIEW
   --------------------
     admin      -> the existing full Dashboard. Unchanged from today's
                   default: bottom panel collapsed, map + Climate
                   Metrics, nothing stacked. Admin is the baseline, so
                   applying it must be a no-op on a fresh load.
     farmer     -> one combined stacked panel, in this order:
                     #pane-advisory     Farmer Advisory alert cards
                     #pane-agriculture  FARMER ADVISORY section --
                                        auto-filled climate summary
                                        (item 10a) + the Mera Khet
                                        area-scaled Fertilizer & Crop
                                        Recommendation card (item 10b)
                     #pane-village      Village Intelligence / reports
                     #pane-pmfby        PMFBY Insurance
                   plus Hindi by default and a larger base font.
     corporate  -> the business view: #pane-mandi (Mandi Prices) then
                   #pane-cropstats (Crop Statistics), stacked.

   WHAT IS IDENTICAL IN ALL THREE (the spec's own "core part same in all
   three" requirement, enforced by simply never touching them here):
   the map, the Location Selector, and the language toggle button.
   ============================================================ */
(function () {
  'use strict';

  var STORE = 'vindhya_visitor';
  var ROLES = ['admin', 'farmer', 'corporate'];

  var LABEL = {
    admin:     { en: 'Administration', hi: 'प्रशासन' },
    farmer:    { en: 'Farmer',         hi: 'किसान' },
    corporate: { en: 'Corporate',      hi: 'कॉर्पोरेट' }
  };
  var ICON = { admin: 'fa-building', farmer: 'fa-tractor', corporate: 'fa-industry' };
  var DESC = {
    admin:     { en: 'District & Panchayat Officials', hi: 'ज़िला व पंचायत अधिकारी' },
    farmer:    { en: 'Crop Advisory & Risk Alerts',    hi: 'फ़सल सलाह और जोखिम चेतावनी' },
    corporate: { en: 'Agri-Business & Insurance',      hi: 'कृषि-व्यवसाय और बीमा' }
  };

  /* The stack each role lands on. Order here IS the on-screen order --
     applied via CSS `order`, so the panes stay where they already live
     in the DOM (no cloning, no duplicate element ids). */
  var STACK = {
    admin:     [],
    farmer:    ['pane-advisory', 'pane-agriculture', 'pane-village', 'pane-pmfby'],
    corporate: ['pane-mandi', 'pane-cropstats']
  };

  /* The three "technical" panes a farmer does not land on. Hidden ONLY
     until the farmer clicks "Advanced view दिखाएं" -- never removed. */
  var TECH_PANES = ['gee', 'validation', 'api'];

  function isHi() { return !!(document.body && document.body.classList.contains('lang-hi')); }
  function t(en, hi) { return isHi() ? hi : en; }

  // ---------- storage ----------
  function readVisitor() {
    try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { return {}; }
  }
  function getRole() {
    var r = readVisitor().role;
    return ROLES.indexOf(r) >= 0 ? r : null;
  }
  function setRole(role) {
    if (ROLES.indexOf(role) < 0) return;
    var v = readVisitor();
    v.role = role;
    // Never re-ask for the name/organisation: whatever is already stored
    // is preserved untouched, which is what makes "switch role without
    // re-entering your details" work.
    try { localStorage.setItem(STORE, JSON.stringify(v)); } catch (e) {}
  }

  // ---------- tagging ----------
  /* Tag the technical tabs / nav items once, so CSS can hide-and-reveal
     them declaratively. Re-runnable: loaders add tabs asynchronously. */
  function tagTechnical() {
    document.querySelectorAll('.btm-tab').forEach(function (tab) {
      var m = (tab.getAttribute('onclick') || '').match(/switchTab\s*\(\s*this\s*,\s*['"]([^'"]+)['"]/);
      if (m && TECH_PANES.indexOf(m[1]) >= 0) tab.setAttribute('data-role-tech', '1');
    });
    document.querySelectorAll('#sidebar .nav-item').forEach(function (nav) {
      var m = (nav.getAttribute('onclick') || '').match(/setNav\s*\(\s*this\s*,\s*['"]([^'"]+)['"]/);
      if (m && TECH_PANES.indexOf(m[1]) >= 0) nav.setAttribute('data-role-tech', '1');
    });
  }

  // ---------- stacking ----------
  function clearStack() {
    document.body.classList.remove('role-stack');
    document.querySelectorAll('.btm-pane.role-stacked').forEach(function (p) {
      p.classList.remove('role-stacked', 'active');
      p.style.order = '';
    });
    var hdrs = document.querySelectorAll('.role-stack-label');
    for (var i = 0; i < hdrs.length; i++) hdrs[i].remove();
  }

  /* Stack several existing panes into one scrolling panel. Returns the
     number actually found -- a pane whose loader has not finished yet is
     skipped, and applyRole() retries, rather than rendering a blank box. */
  function stackPanes(ids) {
    var found = 0;
    // Suppress the per-pane hash push in index.html's .btm-pane observer
    // while several panes go active together -- see that comment. Cleared
    // on a macrotask, after the observer's microtask callbacks have run.
    window.__vindhyaRoleStacking = true;
    ids.forEach(function (id, i) {
      var pane = document.getElementById(id);
      if (!pane) return;
      found++;
      pane.classList.add('role-stacked', 'active');
      pane.style.order = String(i + 1);
    });
    if (found) {
      document.body.classList.add('role-stack');
      var bp = document.getElementById('bottom-panel');
      if (bp && !bp.classList.contains('expanded')) bp.classList.add('expanded');
      setTimeout(function () {
        if (window.leafletMap) window.leafletMap.invalidateSize();
      }, 260);
    }
    setTimeout(function () { window.__vindhyaRoleStacking = false; }, 0);
    return found;
  }

  // ---------- language ----------
  /* Farmer opens in Hindi. This drives the SAME global toggle the topbar
     button drives (toggleGlobalLang) rather than a second private switch
     -- so the language button keeps behaving identically in all three
     roles, which the spec requires. It is a default, not a lock: the
     farmer can toggle straight back to English. */
  function ensureHindi() {
    if (!isHi() && typeof window.toggleGlobalLang === 'function') window.toggleGlobalLang();
  }

  // ---------- advanced toggle ----------
  function renderAdvancedToggle() {
    var old = document.getElementById('roleAdvancedToggle');
    if (old) old.remove();
    if (getRole() !== 'farmer') return;
    var tabs = document.querySelector('.btm-tabs');
    if (!tabs) return;
    var on = document.body.classList.contains('role-advanced');
    var btn = document.createElement('div');
    btn.id = 'roleAdvancedToggle';
    btn.className = 'btm-tab role-advanced-toggle';
    btn.innerHTML = '<i class="fa ' + (on ? 'fa-eye-slash' : 'fa-sliders') + '"></i>' +
      (on ? t('Hide advanced view', 'Advanced view छिपाएं')
          : t('Show advanced view', 'Advanced view दिखाएं'));
    btn.title = t('Show the technical tabs (GEE Workflow, Validation, API Hub)',
                  'तकनीकी टैब दिखाएं (GEE Workflow, Validation, API Hub)');
    btn.onclick = function () {
      document.body.classList.toggle('role-advanced');
      renderAdvancedToggle();
    };
    tabs.appendChild(btn);
  }

  // ---------- main ----------
  var applyTries = 0;
  function applyRole(role, isRetry) {
    if (!isRetry) applyTries = 0;
    role = ROLES.indexOf(role) >= 0 ? role : 'admin';

    tagTechnical();
    ROLES.forEach(function (r) { document.body.classList.remove('role-view-' + r); });
    document.body.classList.add('role-view-' + role);
    if (role !== 'farmer') document.body.classList.remove('role-advanced');
    clearStack();
    updateRoleButton();

    // ensureHindi() flips the global language, which changes what the
    // role button should read -- so refresh the label AFTER it, not only
    // before (the earlier call covers the non-farmer roles).
    if (role === 'farmer') { ensureHindi(); updateRoleButton(); }

    var want = STACK[role];
    if (want.length) {
      var got = stackPanes(want);
      // Loaders (advisory_loader.js, mandi_loader.js, crop_stats_loader.js)
      // build their panes on their own ~700-950ms timers -- retry rather
      // than settle for a half-built stack.
      if (got < want.length && applyTries < 12) {
        applyTries++;
        setTimeout(function () { applyRole(role, true); }, 500);
        return;
      }
      // One hash for the whole combined view, so the URL actually
      // describes what is on screen and "#farmer"/"#corporate" is a
      // shareable deep link to it (item 15c's rule, applied to 0D).
      setTimeout(function () {
        if (history.pushState && location.hash !== '#' + role) {
          history.pushState(null, '', '#' + role);
        }
      }, 30);
    } else {
      /* Admin has no stack. Switching INTO admin from a stacked role must
         put the page back to the genuine default, not leave the shell of
         the previous role behind: an expanded #bottom-panel with no
         .active pane is exactly the empty reserved space item 14c
         forbids ("click se pehle wahan koi khali reserved space na ho").
         Only collapse when nothing else is active -- if the visitor got
         here by clicking a real tab, that tab keeps its panel. */
      if (!document.querySelector('.btm-pane.active')) {
        var bp = document.getElementById('bottom-panel');
        if (bp) bp.classList.remove('expanded');
        setTimeout(function () {
          if (window.leafletMap) window.leafletMap.invalidateSize();
        }, 260);
        if (history.pushState && location.hash !== '#dashboard') {
          history.pushState(null, '', '#dashboard');
        }
      }
    }
    renderAdvancedToggle();
  }

  // ---------- role switcher ----------
  function closeSwitcher() {
    var m = document.getElementById('roleSwitcherOverlay');
    if (m) m.remove();
  }

  function openSwitcher() {
    closeSwitcher();
    var cur = getRole() || 'admin';
    var ov = document.createElement('div');
    ov.id = 'roleSwitcherOverlay';
    ov.addEventListener('click', function (e) { if (e.target === ov) closeSwitcher(); });

    var cards = ROLES.map(function (r) {
      return '<div class="role-switch-card' + (r === cur ? ' selected' : '') + '" data-role="' + r + '">' +
        '<div class="role-switch-icon"><i class="fa ' + ICON[r] + '"></i></div>' +
        '<div class="role-switch-title">' + t(LABEL[r].en, LABEL[r].hi) + '</div>' +
        '<div class="role-switch-desc">' + t(DESC[r].en, DESC[r].hi) + '</div>' +
        (r === cur ? '<div class="role-switch-cur">' + t('current', 'वर्तमान') + '</div>' : '') +
        '</div>';
    }).join('');

    ov.innerHTML =
      '<div class="role-switch-box" role="dialog" aria-modal="true" aria-label="' +
        t('Switch role', 'भूमिका बदलें') + '">' +
        '<div class="role-switch-head">' + t('Switch role', 'भूमिका बदलें') + '</div>' +
        '<div class="role-switch-sub">' +
          t('Changes only which panel opens first. Every panel stays available in every role.',
            'सिर्फ़ यह बदलता है कि पहले कौन-सा पैनल खुले। हर पैनल हर भूमिका में उपलब्ध रहता है।') +
        '</div>' +
        '<div class="role-switch-grid">' + cards + '</div>' +
        '<button class="role-switch-close" type="button">' + t('Close', 'बंद करें') + '</button>' +
      '</div>';

    ov.querySelectorAll('.role-switch-card').forEach(function (c) {
      c.addEventListener('click', function () {
        var r = c.getAttribute('data-role');
        setRole(r);
        closeSwitcher();
        applyRole(r);
      });
    });
    ov.querySelector('.role-switch-close').addEventListener('click', closeSwitcher);
    document.body.appendChild(ov);
  }

  function updateRoleButton() {
    var lbl = document.getElementById('topbarRoleLabel');
    if (!lbl) return;
    var r = getRole();
    lbl.textContent = r ? t(LABEL[r].en, LABEL[r].hi) : t('Role', 'भूमिका');
  }

  /* Any manual tab click leaves the role's combined default view and
     behaves exactly as it always did -- the role view is a landing
     default, never a mode the visitor gets stuck in. Capture phase so
     this runs before switchTab()/each loader's own onclick. */
  document.addEventListener('click', function (e) {
    var tab = e.target && e.target.closest && e.target.closest('.btm-tab');
    if (!tab || tab.id === 'roleAdvancedToggle') return;
    if (document.body.classList.contains('role-stack')) clearStack();
  }, true);

  /* Same for sidebar navigation. */
  document.addEventListener('click', function (e) {
    var nav = e.target && e.target.closest && e.target.closest('#sidebar .nav-item');
    if (!nav) return;
    if (document.body.classList.contains('role-stack')) clearStack();
  }, true);

  var booted = false;

  window.VindhyaRole = {
    get: getRole,
    set: setRole,
    apply: applyRole,
    openSwitcher: openSwitcher,
    closeSwitcher: closeSwitcher,
    refreshLabel: updateRoleButton,
    /* Called from launchApp(). Deferred so every loader's own boot() has
       had a chance to create its pane first. */
    boot: function () {
      if (booted) return;
      booted = true;
      tagTechnical();
      updateRoleButton();
      // A "#farmer"/"#corporate"/"#admin" deep link wins over the stored
      // role for this visit (that is what makes the link worth sharing),
      // but it is NOT written back to localStorage -- opening someone
      // else's shared link must not silently change your own saved role.
      var h = (location.hash || '').replace(/^#/, '');
      var want = ROLES.indexOf(h) >= 0 ? h : (getRole() || 'admin');
      setTimeout(function () { applyRole(want); }, 1400);
    }
  };

  /* LOAD-ORDER SAFETY NET (found live, 2026-09-14, not theorised).
     index.html's inline script defers its router with
     `setTimeout(initRouting, 0)`. That macrotask can fire BEFORE this
     external <script src> -- which sits ~2000 lines further down the
     page -- has executed, in which case launchApp()'s
     `if (window.VindhyaRole) window.VindhyaRole.boot()` sees `undefined`
     and the whole role view is silently skipped. Observed exactly that
     way on an uncached load: body ended up with only `lang-hi`, no
     `role-view-*` class, nothing stacked, technical tabs untagged.
     So do not rely solely on being called: if the dashboard is already
     on screen by the time this file runs, boot ourselves. boot() is
     idempotent (the `booted` flag), so the two paths cannot double-run,
     and on the hero/login screens #app is display:none so this no-ops
     and the normal launchApp() call still does the work. */
  (function selfBoot(tries) {
    var app = document.getElementById('app');
    if (app && getComputedStyle(app).display !== 'none') { window.VindhyaRole.boot(); return; }
    if ((tries || 0) < 20) setTimeout(function () { selfBoot((tries || 0) + 1); }, 300);
  })(0);
})();
