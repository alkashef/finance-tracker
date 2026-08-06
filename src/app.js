/* AK47 Finance Tracker — entry module: the render loop (with the by-hand
 * focus/caret/scroll restoration a template-string render loop needs),
 * event delegation, and boot. Everything else lives under src/js/ — see
 * docs/design.md#rendering-model for the render cycle this drives. */

import { fmtMoney, parseEnv } from './js/format.js';
import { SCENARIO_MIN, SCENARIO_MAX } from './js/constants.js';
import { state, set, setRenderer } from './js/state.js';
import { buildViewModel } from './js/model.js';
import { viewSidebar, viewMain } from './js/views.js';
import { actions, fields } from './js/actions.js';

/* The what-if slider updates the readouts in place rather than through a full
   render — see updateScenarioReadouts() below — so its handler needs both that
   function and the render loop's lastVm. Both live in this file, one step
   downstream of actions.js in the module graph, so actions.js can't wire this
   in itself; this is the same pattern as the ENTITIES.transactions.after patch
   in actions.js. */
fields.stockScenario = function (v) {
  state.stockScenarioPrice = parseFloat(v);
  updateScenarioReadouts(state.stockScenarioPrice);
};

/* -------------------------------------------------------------- render --- */

var sidebarEl = null;
var mainEl = null;
var lastVm = null;

/* Stand-ins for what React's diffing gave for free: keep the focused field
   focused, its cursor where the user left it, and the scroll position put. */
function captureFocus() {
  var el = document.activeElement;
  if (!el || !el.dataset || !el.dataset.f) return null;
  var snap = { f: el.dataset.f, value: el.value, start: null, end: null };
  try { snap.start = el.selectionStart; snap.end = el.selectionEnd; } catch (e) { /* not a text field */ }
  return snap;
}

function restoreFocus(snap) {
  if (!snap) return;
  var el = document.querySelector('[data-f="' + snap.f + '"]');
  if (!el) return;
  el.focus();
  if (snap.start === null) return;
  try {
    /* If the handler reformatted the value (e.g. thousands separators),
       the old offset is meaningless — go to the end, as React does. */
    if (el.value === snap.value) el.setSelectionRange(snap.start, snap.end);
    else el.setSelectionRange(el.value.length, el.value.length);
  } catch (e) { /* selection unsupported on this input type */ }
}

function render() {
  var v = buildViewModel();
  lastVm = v;
  var snap = captureFocus();
  var mainScroll = mainEl.scrollTop;
  var sidebarScroll = sidebarEl.scrollTop;

  sidebarEl.className = v.sidebarOpen ? 'sidebar' : 'sidebar collapsed';
  sidebarEl.innerHTML = viewSidebar(v);
  mainEl.innerHTML = viewMain(v);

  sidebarEl.scrollTop = sidebarScroll;
  mainEl.scrollTop = mainScroll;
  restoreFocus(snap);
}

/* The what-if slider updates in place: replacing the range input mid-drag
   would drop the drag gesture, so only the dependent readouts are rewritten. */
function updateScenarioReadouts(price) {
  var inputs = lastVm.scenarioInputs;
  var fillPct = Math.min(100, Math.max(0, ((price - SCENARIO_MIN) / (SCENARIO_MAX - SCENARIO_MIN)) * 100));
  var byId = function (id) { return document.getElementById(id); };
  var priceEl = byId('scenario-price');
  var fillEl = byId('scenario-fill');
  var sellableEl = byId('scenario-sellable');
  var unvestedEl = byId('scenario-unvested');
  if (priceEl) priceEl.textContent = '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (fillEl) fillEl.style.width = fillPct + '%';
  if (sellableEl) sellableEl.textContent = fmtMoney(inputs.heldQty * price + inputs.stockCash);
  if (unvestedEl) unvestedEl.textContent = fmtMoney(inputs.unvestedUnits * price);
}

/* ---------------------------------------------------- event delegation --- */

function bindEvents() {
  document.addEventListener('click', function (e) {
    if (!e.target || !e.target.closest) return;
    var el = e.target.closest('[data-act]');
    if (!el) return;
    var fn = actions[el.dataset.act];
    if (fn) fn(el.dataset);
  });
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.f) return;
    var fn = fields[el.dataset.f];
    if (fn) fn(el.value, el);
  });
}

/* ---------------------------------------------------------------- boot --- */

function restoreConfig() {
  try {
    var saved = JSON.parse(localStorage.getItem('financeTracker.config') || '{}');
    if (saved.clientId) {
      state.clientId = saved.clientId;
      state.spreadsheetId = saved.spreadsheetId || '';
      state.clientIdInput = saved.clientId;
      state.spreadsheetIdInput = saved.spreadsheetId || '';
      state.connected = true;
      state.showSettings = false;
    }
  } catch (e) { /* no usable saved config */ }
  /* GoldAPI.io / Alpha Vantage keys (src/js/marketData.js) — a separate
     localStorage key from financeTracker.config so editing one never touches
     the Sheets connection, and so a key typed before a Sheet is ever
     connected still survives a reload. */
  try {
    var keys = JSON.parse(localStorage.getItem('financeTracker.marketDataKeys') || '{}');
    state.goldApiKey = keys.goldApiKey || '';
    state.stockApiKey = keys.stockApiKey || '';
  } catch (e) { /* no usable saved keys */ }
}

/* Optional local convenience: a gitignored `config/.env` can prefill the two
   connection fields, and/or a GoldAPI.io key, so a dev copy doesn't need them
   retyped after every clear of site data. It is deliberately absent from the
   hosted site, where every value is typed in by hand instead (Settings for the
   first two, the Gold Manage screen for the key).

   This does not breach the "no data in the app" rule: the file is untracked, holds
   no financial figures, and the repo ships only `config/.env.example` with
   placeholders. Never commit a real one. parseEnv() itself lives in js/format.js —
   see the comment there. */
function applyLocalDefaults() {
  /* A saved value always wins, so editing Settings/the Gold key locally survives a
     reload — but the two concerns are independent: a Sheets connection saved in an
     earlier session shouldn't stop a GoldAPI key added to .env later from being
     picked up, and vice versa, so the fetch is only skipped once there is nothing
     left it could fill. */
  if (state.clientIdInput && state.spreadsheetIdInput && state.goldApiKey) return;
  /* Resolved from this module's own URL, not the document's — `fetch('config/.env')`
     resolves relative to whichever page loaded app.js, which is wrong from
     test/smoke.html (it would ask for test/config/.env). new URL(..., import.meta.url)
     always resolves relative to this file, regardless of which page loaded it. */
  fetch(new URL('../config/.env', import.meta.url), { cache: 'no-store' })
    .then(function (res) { return res && res.ok ? res.text() : ''; })
    .then(function (text) {
      if (!text) return;
      var env = parseEnv(text);
      var patch = {};
      /* Prefill only — never auto-connect. Requesting a token without a user
         gesture gets the OAuth popup blocked. */
      if (!state.clientIdInput && !state.spreadsheetIdInput) {
        var clientId = env.GOOGLE_OAUTH_CLIENT_ID || '';
        var spreadsheetId = env.SPREADSHEET_ID || '';
        if (clientId || spreadsheetId) {
          patch.clientIdInput = clientId;
          patch.spreadsheetIdInput = spreadsheetId;
          patch.fromLocalEnv = true;
        }
      }
      if (!state.goldApiKey && env['GOLDAPI-KEY']) {
        patch.goldApiKey = env['GOLDAPI-KEY'];
        patch.goldApiKeyFromEnv = true;
      }
      if (Object.keys(patch).length) set(patch);
    })
    .catch(function () { /* no local file, or the server won't serve dotfiles — fine */ });
}

function boot() {
  setRenderer(render);
  sidebarEl = document.getElementById('sidebar');
  mainEl = document.getElementById('main');
  restoreConfig();
  bindEvents();
  render();
  /* After the first paint: the fields fill in a tick later if the file is there. */
  applyLocalDefaults();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
