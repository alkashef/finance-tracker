/* The `actions` and `fields` maps bindEvents() (in app.js) dispatches every
   click and input through, plus the descriptor-driven CRUD machinery that
   derives most of edit/cancel/delete/submit from ENTITIES (see
   constants.js and docs/design.md#rendering-model). */

import { formatAmountDisplay } from './format.js';
import {
  TX_HEADERS, LEDGER_HEADERS, GOLD_HEADERS, RATE_HEADERS, STOCK_META_HEADERS,
  ENTITIES, TAG_SPENDING, TAG_SAVING_OTHER,
} from './constants.js';
import { state, set, setForm, toggle, render } from './state.js';
import { writeSheet, ensureSheets, deleteSheet, renameSheet, persist } from './sheets.js';
import { recomputeAndWriteAllLedgers, computeLedger, loadAll, toFieldRequired } from './model.js';

/* ENTITIES.transactions.after needs recomputeAndWriteAllLedgers, which lives in
   model.js — constants.js can't import that without turning the module graph
   into a cycle (see the comment on the descriptor in constants.js). This is the
   first point downstream of both that can patch it in, and it runs before
   anything below can submit the transactions form. */
ENTITIES.transactions.after = function () { return recomputeAndWriteAllLedgers(); };

function downloadCsv(filename, headers, rows) {
  var quote = function (v) { return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"'; };
  var csv = [headers.map(quote).join(',')].concat(rows.map(function (r) {
    return headers.map(function (h) { return quote(r[h]); }).join(',');
  })).join('\n');
  var url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function writeAccountsSheet(accounts, owners, tags) {
  return writeSheet('Accounts', ['Account Name', 'Owner', 'Tag'], accounts.map(function (a) {
    return { 'Account Name': a, Owner: owners[a] || '', Tag: tags[a] || TAG_SPENDING };
  }));
}

function goto(sheet) {
  set({ activeSheet: sheet, search: '' });
}

function removeAt(list, index) {
  return list.filter(function (_, i) { return i !== index; });
}

/* --- descriptor-driven CRUD ---
   The four handlers every entity in ENTITIES needs, derived from its descriptor
   rather than written out ten times over. Only `submit` varies enough to be
   worth spelling out per entity, and only for three of them. */

function sheetRows(desc, list) {
  return desc.toRow ? list.map(function (item) { return desc.toRow(item); }) : list;
}

/* The tail every save shares: put the record into the list at the form's index
   (or on the end), write the sheet, clear the form. The three hand-written
   submit handlers call this once they have built their record. */
function saveRecord(desc, record) {
  var f = state[desc.form];
  var list = state[desc.list].slice();
  if (f.mode === 'edit') list[f.index] = record; else list.push(record);
  var patch = {};
  patch[desc.list] = list;
  patch[desc.form] = desc.emptyForm();
  persist(desc.sheet, desc.headers, sheetRows(desc, list), patch, 'Save error', desc.after);
}

function makeEdit(desc) {
  return function (d) {
    var index = +d.i;
    var form = desc.toForm(state[desc.list][index]);
    form.mode = 'edit';
    form.index = index;
    var patch = {};
    patch[desc.form] = form;
    set(patch);
  };
}

function makeCancel(desc) {
  return function () {
    var patch = {};
    patch[desc.form] = desc.emptyForm();
    set(patch);
  };
}

function makeSubmit(desc) {
  return function () {
    /* '' means "nothing to save, say nothing" — an empty name field, not an
       error the user needs told about. */
    var problem = desc.validate(state[desc.form], state[desc.list]);
    if (problem !== null) {
      if (problem) set({ error: problem });
      return;
    }
    saveRecord(desc, desc.toRecord(state[desc.form]));
  };
}

function makeDelete(desc) {
  return function (d) {
    var index = +d.i;
    if (desc.confirmDelete && !confirm(desc.confirmDelete(state[desc.list][index]))) return;
    var list = removeAt(state[desc.list], index);
    var patch = {};
    patch[desc.list] = list;
    persist(desc.sheet, desc.headers, sheetRows(desc, list), patch, 'Delete error', desc.after);
  };
}

/* Turns a descriptor's `fields` map into handlers. Also used for the four forms
   that aren't entities (account, gold price, currency rate, provident fund,
   stock price) — same one-liner, no descriptor to hang it off. */
function formFields(formName, map) {
  var out = {};
  Object.keys(map).forEach(function (dataF) {
    var key = map[dataF];
    out[dataF] = function (v) { setForm(formName, key, v); };
  });
  return out;
}

export var actions = {
  /* --- connection --- */
  saveAndConnect: function () {
    var clientId = state.clientIdInput.trim();
    var spreadsheetId = state.spreadsheetIdInput.trim();
    if (!clientId) { set({ error: 'Paste your Google OAuth Client ID first.' }); return; }
    if (!spreadsheetId) { set({ error: 'Paste the Spreadsheet ID of the Sheet holding your data.' }); return; }
    localStorage.setItem('financeTracker.config', JSON.stringify({ clientId: clientId, spreadsheetId: spreadsheetId }));
    set({ clientId: clientId, spreadsheetId: spreadsheetId, connected: true, connecting: true, showSettings: false, error: '' });
    loadAll();
  },
  openSettings: function () { set({ showSettings: true }); },
  closeSettings: function () { set({ showSettings: false }); },
  refreshFromSheet: function () { loadAll(); },

  /* --- navigation --- */
  toggleSidebar: function () { toggle('sidebarOpen'); },
  toggleSavingNav: function () { toggle('savingNavOpen'); },
  toggleSpendingNav: function () { toggle('spendingNavOpen'); },
  toggleAccountSettings: function () { toggle('accountSettingsOpen'); },
  toggleRecentTx: function () { toggle('recentTxOpen'); },
  toggleDashCurrency: function () { toggle('dashCurrencyOpen'); },
  toggleDashSpending: function () { toggle('dashSpendingOpen'); },
  toggleDashSchool: function () { toggle('dashSchoolOpen'); },
  toggleDashOther: function () { toggle('dashOtherOpen'); },
  toggleDashMaturity: function () { toggle('dashMaturityOpen'); },
  toggleDashSaving: function () { toggle('dashSavingOpen'); },
  goDashboard: function () { goto('dashboard'); },
  goAccounts: function () { goto('accounts'); },
  goTypes: function () { goto('types'); },
  goTags: function () { goto('tags'); },
  goTransactions: function () { goto('transactions'); },
  goGold: function () { goto('gold'); },
  goCerts: function () { goto('certs'); },
  goStocks: function () { goto('stocks'); },
  goProvidentFund: function () { goto('pf'); },
  goPlan: function () { goto('plan'); },
  selectAccount: function (d) { goto('account:' + state.accounts[+d.i]); },
  goldTabOverview: function () { set({ goldTab: 'overview' }); },
  goldTabManage: function () { set({ goldTab: 'manage' }); },
  certsTabOverview: function () { set({ certsTab: 'overview' }); },
  certsTabManage: function () { set({ certsTab: 'manage' }); },
  txTabOverview: function () { set({ txTab: 'overview' }); },
  txTabManage: function () { set({ txTab: 'manage' }); },
  pfTabOverview: function () { set({ pfTab: 'overview' }); },
  pfTabManage: function () { set({ pfTab: 'manage' }); },
  stockTabOverview: function () { set({ stockTab: 'overview' }); },
  stockTabManage: function () { set({ stockTab: 'manage' }); },
  toggleCertGroup: function (d) {
    var open = {};
    Object.keys(state.certGroupOpen).forEach(function (k) { open[k] = state.certGroupOpen[k]; });
    open[d.k] = state.certGroupOpen[d.k] === false;
    set({ certGroupOpen: open });
  },

  /* --- accounts --- */
  editAccount: function (d) {
    var index = +d.i;
    var name = state.accounts[index];
    set({ acctForm: { mode: 'edit', index: index, name: name, owner: state.accountOwners[name] || '', tag: state.accountTags[name] || TAG_SPENDING } });
  },
  cancelAccountForm: function () {
    set({ acctForm: { mode: 'add', index: -1, name: '', owner: '', tag: TAG_SPENDING } });
  },
  submitAccountForm: function () {
    var f = state.acctForm;
    var name = f.name.trim();
    var owner = f.owner.trim();
    var tag = f.tag || TAG_SPENDING;
    if (!name) return;
    var accounts = state.accounts.slice();
    var owners = {};
    var tags = {};
    Object.keys(state.accountOwners).forEach(function (k) { owners[k] = state.accountOwners[k]; });
    Object.keys(state.accountTags).forEach(function (k) { tags[k] = state.accountTags[k]; });
    set({ loading: true });

    var prep;
    if (f.mode === 'edit') {
      var oldName = accounts[f.index];
      accounts[f.index] = name;
      if (oldName !== name) {
        delete owners[oldName];
        delete tags[oldName];
        prep = renameSheet(oldName, name).then(function (renamed) {
          return renamed ? null : ensureSheets([name]);
        });
      } else {
        prep = Promise.resolve();
      }
    } else {
      if (accounts.indexOf(name) !== -1) { set({ loading: false, error: 'Account already exists.' }); return; }
      accounts.push(name);
      prep = ensureSheets([name]);
    }
    owners[name] = owner;
    tags[name] = tag;

    prep.then(function () {
      return writeAccountsSheet(accounts, owners, tags);
    }).then(function () {
      set({
        accounts: accounts, accountOwners: owners, accountTags: tags,
        acctForm: { mode: 'add', index: -1, name: '', owner: '', tag: TAG_SPENDING },
      });
      return recomputeAndWriteAllLedgers();
    }).then(function () {
      set({ loading: false });
    }).catch(function (e) {
      set({ loading: false, error: 'Save error: ' + e.message });
    });
  },
  deleteAccount: function (d) {
    var index = +d.i;
    var name = state.accounts[index];
    if (!confirm('Delete account "' + name + '"? Its ledger tab will be removed.')) return;
    var accounts = removeAt(state.accounts, index);
    var owners = {};
    var tags = {};
    Object.keys(state.accountOwners).forEach(function (k) { if (k !== name) owners[k] = state.accountOwners[k]; });
    Object.keys(state.accountTags).forEach(function (k) { if (k !== name) tags[k] = state.accountTags[k]; });
    set({ loading: true });
    writeAccountsSheet(accounts, owners, tags).then(function () {
      return deleteSheet(name);
    }).then(function () {
      set({
        accounts: accounts, accountOwners: owners, accountTags: tags, loading: false,
        activeSheet: state.activeSheet === 'account:' + name ? 'dashboard' : state.activeSheet,
      });
    }).catch(function (e) {
      set({ loading: false, error: 'Delete error: ' + e.message });
    });
  },

  /* --- transactions ---
     Types and tags are wholly descriptor-driven; see the loop below. */
  sortByDate: function () {
    set({ sortCol: 'Date', sortDir: state.sortCol === 'Date' && state.sortDir === 'asc' ? 'desc' : 'asc' });
  },
  sortByAmount: function () {
    set({ sortCol: 'Amount', sortDir: state.sortCol === 'Amount' && state.sortDir === 'asc' ? 'desc' : 'asc' });
  },
  /* Bespoke: whether To Account is required depends on the transaction type, and
     the amount arrives from the field carrying thousands separators. */
  submitTxForm: function () {
    var f = state.txForm;
    var toRequired = toFieldRequired(f.type);
    var rawAmount = f.amount.replace(/,/g, '');
    var amountValid = rawAmount !== '' && rawAmount !== '-' && !isNaN(parseFloat(rawAmount));
    if (!f.date || !amountValid || !f.from || (toRequired && !f.to)) {
      set({ error: toRequired ? 'Date, Amount, From and To Account are required.' : 'Date, Amount and From Account are required.' });
      return;
    }
    saveRecord(ENTITIES.transactions, {
      Date: f.date, Amount: rawAmount, Description: f.description, 'Transaction Type': f.type,
      'From Account': f.from, 'To Account': toRequired ? f.to : '',
    });
  },
  exportTransactionsCsv: function () {
    downloadCsv('transactions.csv', TX_HEADERS, state.transactions);
  },
  exportLedgerCsv: function () {
    var name = state.activeSheet.replace('account:', '');
    downloadCsv(name.replace(/\s+/g, '_') + '_ledger.csv', LEDGER_HEADERS, computeLedger(name, state.transactions));
  },

  /* --- gold ---
     Plan is wholly descriptor-driven; see the loop below. */

  /* Bespoke: a lot saved without a current price inherits one, and its as-of
     date, from the most recently priced lot — or, failing that, from its own
     purchase date. */
  submitGoldForm: function () {
    var f = state.goldForm;
    var qty = parseFloat(f.quantity);
    var weight = parseFloat(f.weight);
    var price = parseFloat(f.purchasePrice);
    if (!qty || !weight || isNaN(price) || !f.purchaseDate) {
      set({ error: 'Quantity, Weight, Purchase Price and Purchase Date are required.' });
      return;
    }
    var currentPrice = parseFloat(f.currentPrice);
    var asOf = f.asOf;
    if (!currentPrice || !asOf) {
      var latest = state.goldItems.reduce(function (max, it) {
        return (!max || (it['As Of'] || '') > (max['As Of'] || '')) ? it : max;
      }, null);
      var latestPrice = latest ? (parseFloat(latest['Current Price per Gram (EGP)']) || 0) : 0;
      currentPrice = currentPrice || latestPrice;
      asOf = asOf || (latest && latest['As Of']) || f.purchaseDate;
    }
    saveRecord(ENTITIES.gold, {
      Quantity: qty, Type: f.type.trim(), Brand: f.brand.trim(), 'Weight (gm)': weight, Where: f.where.trim(),
      'Purchase Price per Gram (EGP)': price, 'Purchase Date': f.purchaseDate,
      'Current Price per Gram (EGP)': currentPrice, 'As Of': asOf, Tag: f.tag || TAG_SAVING_OTHER,
    });
  },
  applyGoldPriceUpdate: function () {
    var price = parseFloat(state.goldPriceForm.currentPrice);
    var asOf = state.goldPriceForm.asOf;
    if (!price || !asOf) { set({ error: 'Enter a current price and as-of date first.' }); return; }
    var goldItems = state.goldItems.map(function (it) {
      var copy = {};
      Object.keys(it).forEach(function (k) { copy[k] = it[k]; });
      copy['Current Price per Gram (EGP)'] = price;
      copy['As Of'] = asOf;
      return copy;
    });
    persist('Gold', GOLD_HEADERS, goldItems, { goldItems: goldItems }, 'Save error');
  },

  /* --- certificates & rates ---
     Bespoke submit: the form takes an interest rate as a percentage, the sheet
     stores it as a fraction. */
  submitCertForm: function () {
    var f = state.certForm;
    var amount = parseFloat(f.amount);
    var ratePct = parseFloat(f.rate);
    if (!amount || !f.currency.trim() || !f.openDate || !f.maturityDate || isNaN(ratePct)) {
      set({ error: 'Amount, Currency, Open Date, Maturity Date and Interest Rate are required.' });
      return;
    }
    saveRecord(ENTITIES.certs, {
      'Certificate Number': f.number.trim(), 'Product Name': f.product.trim(), 'Open Date': f.openDate,
      Amount: amount, Currency: f.currency.trim().toUpperCase(), 'Interest Frequency': f.frequency.trim(),
      'Maturity Date': f.maturityDate, 'Interest Rate': ratePct / 100, Tag: f.tag || TAG_SAVING_OTHER,
    });
  },
  applyRateUpdate: function () {
    var currency = state.rateForm.currency.trim().toUpperCase();
    var rate = parseFloat(state.rateForm.rate);
    var asOf = state.rateForm.asOf;
    if (!currency || !rate || !asOf) { set({ error: 'Enter a currency, rate and as-of date first.' }); return; }
    var rates = state.rates.slice();
    var idx = rates.map(function (r) { return r.Currency; }).indexOf(currency);
    var record = { Currency: currency, 'Rate to EGP': rate, 'As Of': asOf };
    if (idx >= 0) rates[idx] = record; else rates.push(record);
    persist('Currency Rates', RATE_HEADERS, rates, { rates: rates, rateForm: { currency: '', rate: '', asOf: '' } }, 'Save error');
  },

  /* --- provident fund --- */
  submitPfForm: function () {
    var balance = parseFloat(state.pfForm.balance.replace(/,/g, ''));
    var asOf = state.pfForm.asOf;
    var tag = state.pfForm.tag || TAG_SAVING_OTHER;
    if (!isFinite(balance) || !asOf) { set({ error: 'Enter a balance and an as-of date.' }); return; }
    var record = { Balance: balance, 'As Of': asOf, Tag: tag };
    persist('Provident Fund', ['Balance', 'As Of', 'Tag'], [record], {
      providentFund: record, pfForm: { balance: '', asOf: '', tag: tag },
    }, 'Save error');
  },

  /* --- stocks ---
     Holdings and vesting are wholly descriptor-driven; see the loop below. */
  applyStockPriceUpdate: function () {
    var f = state.stockPriceForm;
    /* Blank fields keep whatever the Sheet already holds; on a fresh Sheet there
       is nothing to fall back to, so the price has to be entered. */
    var prev = state.stockMeta || {};
    var price = f.currentPrice !== '' ? parseFloat(f.currentPrice) : parseFloat(prev['Current Price (USD)']);
    var cash = f.cash !== '' ? parseFloat(f.cash) : parseFloat(prev['Cash (USD)']);
    if (isNaN(price)) { set({ error: 'Enter a current price first.' }); return; }
    var stockMeta = {
      Symbol: f.symbol.trim() || prev.Symbol || '',
      'Current Price (USD)': price,
      'Cash (USD)': isNaN(cash) ? 0 : cash,
      'As Of': f.asOf || prev['As Of'] || '',
    };
    persist('Stock Meta', STOCK_META_HEADERS, [stockMeta], {
      stockMeta: stockMeta, stockScenarioPrice: price,
      stockPriceForm: { symbol: '', currentPrice: '', cash: '', asOf: '' },
    }, 'Save error');
  },
};

/* Generate the four handlers every entity in ENTITIES needs. `submit` is only
   generated where the descriptor carries validate/toRecord — the three above
   that validate on their own already occupy their name in `actions`, and this
   loop must never overwrite one. */
Object.keys(ENTITIES).forEach(function (key) {
  var desc = ENTITIES[key];
  actions['edit' + desc.act] = makeEdit(desc);
  actions['cancel' + desc.act + 'Form'] = makeCancel(desc);
  actions['delete' + desc.act] = makeDelete(desc);
  var submitName = 'submit' + desc.act + 'Form';
  if (desc.validate && desc.toRecord) actions[submitName] = makeSubmit(desc);
  else if (!actions[submitName]) throw new Error('no submit handler for ' + key);
});

/* Input handlers, keyed by the control's data-f attribute.
   Everything that just copies the typed value into a form field is generated
   from a form-key map; only the handlers below, which rewrite what the user
   typed, are written out. Adding a plain field is a line in a descriptor's
   `fields`, not a handler here.

   `stockScenario` is deliberately absent: it updates the what-if readouts in
   place via updateScenarioReadouts(), which lives in app.js alongside the
   render loop's lastVm — one file downstream of this one — so app.js patches
   it onto `fields` after import, the same way ENTITIES.transactions.after is
   patched above. */
export var fields = {
  clientId: function (v) { set({ clientIdInput: v }); },
  spreadsheetId: function (v) { set({ spreadsheetIdInput: v }); },
  search: function (v) { set({ search: v }); },

  /* Reformats as you type, so it cannot go through setForm: the value shown
     back is not the value received. render() then puts the caret at the end. */
  txAmount: function (v) {
    if (v === '' || /^-?[\d,]*\.?\d*$/.test(v)) state.txForm.amount = formatAmountDisplay(v);
    render();
  },
  /* Filters rather than reformats — a rejected keystroke leaves state alone. */
  pfBalance: function (v) {
    if (v === '' || /^[\d,]*\.?\d*$/.test(v)) state.pfForm.balance = v;
    render();
  },

  /* Currency codes and ticker symbols are upper-case by convention; doing it on
     input keeps what is stored and what is shown the same string. */
  certCurrency: function (v) { setForm('certForm', 'currency', v.toUpperCase()); },
  rateCurrency: function (v) { setForm('rateForm', 'currency', v.toUpperCase()); },
  stockSymbol: function (v) { setForm('stockPriceForm', 'symbol', v.toUpperCase()); },
};

/* The forms with no entity behind them: accounts (tab lifecycle), the two
   bulk-update panels, provident fund and stock meta. */
var STANDALONE_FIELDS = [
  ['acctForm', { acctName: 'name', acctOwner: 'owner', acctTag: 'tag' }],
  ['goldPriceForm', { goldPriceCurrent: 'currentPrice', goldPriceAsOf: 'asOf' }],
  ['rateForm', { rateValue: 'rate', rateAsOf: 'asOf' }],
  ['pfForm', { pfAsOf: 'asOf', pfTag: 'tag' }],
  ['stockPriceForm', { stockPrice: 'currentPrice', stockCash: 'cash', stockAsOf: 'asOf' }],
];

/* A generated name colliding with one of the transforming handlers above would
   silently drop the transform, which is exactly the bug this milestone could
   introduce. Refuse to start instead. */
function addFields(generated) {
  Object.keys(generated).forEach(function (name) {
    if (fields[name]) throw new Error('generated field handler would shadow ' + name);
    fields[name] = generated[name];
  });
}

Object.keys(ENTITIES).forEach(function (key) {
  var desc = ENTITIES[key];
  addFields(formFields(desc.form, desc.fields));
});
STANDALONE_FIELDS.forEach(function (pair) {
  addFields(formFields(pair[0], pair[1]));
});
