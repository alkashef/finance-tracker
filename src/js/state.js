/* The single source of truth, plus the three mutators every handler uses to
   change it. */

import { ENTITIES, TAG_SPENDING, TAG_SAVING_OTHER } from './constants.js';

export var state = {
  clientId: '',
  accessToken: '',
  tokenExpiry: 0,
  spreadsheetId: '',
  clientIdInput: '',
  spreadsheetIdInput: '',
  fromLocalEnv: false,
  connected: false,
  connecting: false,
  showSettings: true,
  loading: false,
  error: '',
  activeSheet: 'dashboard',
  accounts: [],
  types: [],
  transactions: [],
  search: '',
  sortCol: null,
  sortDir: 'asc',
  accountOwners: {},
  accountTags: {},
  acctForm: { mode: 'add', index: -1, name: '', owner: '', tag: TAG_SPENDING },
  savingNavOpen: true,
  spendingNavOpen: true,
  accountSettingsOpen: true,
  recentTxOpen: false,
  typeForm: ENTITIES.types.emptyForm(),
  tags: [],
  tagForm: ENTITIES.tags.emptyForm(),
  txForm: ENTITIES.transactions.emptyForm(),
  planItems: [],
  planForm: ENTITIES.plan.emptyForm(),
  goldItems: [],
  goldForm: ENTITIES.gold.emptyForm(),
  goldPriceForm: { currentPrice: '', asOf: '' },
  certItems: [],
  certForm: ENTITIES.certs.emptyForm(),
  rates: [],
  rateForm: { currency: '', rate: '', asOf: '' },
  providentFund: null,
  pfForm: { balance: '', asOf: '', tag: TAG_SAVING_OTHER },
  stockMeta: null,
  stockHoldings: [],
  stockVesting: [],
  stockTab: 'overview',
  stockScenarioPrice: null,
  holdingForm: ENTITIES.holdings.emptyForm(),
  vestingForm: ENTITIES.vesting.emptyForm(),
  stockPriceForm: { symbol: '', currentPrice: '', cash: '', asOf: '' },
  dashCurrencyOpen: true,
  goldTab: 'overview',
  certsTab: 'overview',
  txTab: 'overview',
  pfTab: 'overview',
  sidebarOpen: true,
  certGroupOpen: {},
  dashSpendingOpen: true,
  dashSchoolOpen: true,
  dashOtherOpen: true,
  dashMaturityOpen: false,
  dashSavingOpen: true,
};

/* Every mutator below calls render() synchronously — the same thing function
   hoisting gave the code for free when it was one IIFE. render() itself lives in
   app.js (it needs the DOM elements and the view builders), which is the last
   file in the module graph, so nothing here can import it directly without a
   cycle. app.js hands its render function to setRenderer() once, at boot,
   before any handler can fire. */
var renderer = function () {};

export function setRenderer(fn) { renderer = fn; }

export function render() { renderer(); }

export function set(patch) {
  Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
  render();
}

export function setForm(formName, key, value) {
  state[formName][key] = value;
  render();
}

export function toggle(key) {
  state[key] = !state[key];
  render();
}
