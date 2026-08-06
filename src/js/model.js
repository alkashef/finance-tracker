/* `buildViewModel()` is a composition, not a computation. Every figure on every
   screen is produced by one of the per-domain builders below, and the builders
   run in dependency order.

   The contract: a builder takes the state plus whatever it needs from the
   builders before it, and returns the slice of the view model its screens read.
   The four whose numbers the dashboard also reports — gold, certificates,
   stocks and provident fund — return `{ view: …, totals: … }` instead: `view` is
   merged into the model, `totals` is handed to `dashboardModel`, which adds
   those figures up rather than deriving them a second time. The per-account
   ledgers and the currency-rate map are built once up front for the same
   reason: three domains read them.

   No builder reaches for `state` directly, and none mutates what it is handed —
   the model is rebuilt from scratch on every render, and a builder that
   quietly mutated a shared intermediate would corrupt whichever one runs next.
   The whole model is still built on every keystroke; there is deliberately no
   per-screen laziness or caching, because at this size there is nothing to buy.

   computeLedger, recomputeAndWriteAllLedgers and loadAll live here too, rather
   than in sheets.js: they need computeLedger's own ledger math (loadAll via
   recomputeAndWriteAllLedgers), and sheets.js sits earlier than model.js in the
   module graph (format -> constants -> state -> sheets -> model -> ...), so
   they can't live upstream of the computation they depend on. */

import { fmtMoney, fmtEGP, fmtEUR, signed } from './format.js';
import {
  TAG_SPENDING, TAG_SAVING_SCHOOL, TAG_SAVING_OTHER, TAG_FALLBACK_OPTIONS,
  MONTHS, SCENARIO_MIN, SCENARIO_MAX, MATURITY_WATCH_DAYS, LEDGER_HEADERS, PLAN_STEP_LABELS,
} from './constants.js';
import { state, set } from './state.js';
import { writeSheet, getAll, ensureSheets } from './sheets.js';

/* ------------------------------------------------------ ledgers & load --- */

export function computeLedger(accountName, transactions) {
  var sorted = transactions.map(function (t, i) {
    var copy = {};
    Object.keys(t).forEach(function (k) { copy[k] = t[k]; });
    copy._i = i;
    return copy;
  }).sort(function (a, b) {
    return (a.Date || '').localeCompare(b.Date || '') || a._i - b._i;
  });
  var balance = 0;
  var rows = [];
  for (var i = 0; i < sorted.length; i++) {
    var t = sorted[i];
    var amt = parseFloat(t.Amount) || 0;
    var hasTo = !!t['To Account'];
    var signedAmt = null;
    if (!hasTo && t['From Account'] === accountName) signedAmt = amt;
    else if (t['From Account'] === accountName && t['To Account'] === accountName) continue;
    else if (t['From Account'] === accountName) signedAmt = -amt;
    else if (t['To Account'] === accountName) signedAmt = amt;
    else continue;
    balance += signedAmt;
    rows.push({
      Date: t.Date || '', Description: t.Description || '',
      'Transaction Type': signedAmt < 0 ? 'Out' : 'In', Amount: signedAmt, Balance: balance,
    });
  }
  return rows;
}

export function recomputeAndWriteAllLedgers() {
  return state.accounts.reduce(function (chain, name) {
    return chain.then(function () {
      return writeSheet(name, LEDGER_HEADERS, computeLedger(name, state.transactions));
    });
  }, Promise.resolve());
}

export function loadAll() {
  set({ loading: true, error: '' });
  return getAll().then(function (data) {
    var rawAccounts = data.accounts || [];
    var accountOwners = {};
    var accountTags = {};
    rawAccounts.forEach(function (a) {
      if (a && typeof a !== 'string') { accountOwners[a.name] = a.owner || ''; accountTags[a.name] = a.tag || ''; }
    });
    var accounts = rawAccounts.map(function (a) { return typeof a === 'string' ? a : a.name; });
    set({
      accounts: accounts, accountOwners: accountOwners, accountTags: accountTags,
      types: data.types || [], tags: data.tags || [], transactions: data.transactions || [],
      planItems: data.plan || [], goldItems: data.gold || [], certItems: data.certificates || [],
      rates: data.rates || [], providentFund: data.providentFund || null,
      stockMeta: data.stockMeta || null, stockHoldings: data.stockHoldings || [],
      stockVesting: data.stockVesting || [], connecting: false,
    });

    /* Nothing is seeded: the Sheet is the only source of data. Empty tabs stay
       empty, and the app never writes a row the user did not enter. Tabs are
       still created if missing so later writes have somewhere to land. */
    return ensureSheets(accounts)
      .then(function () {
        return ensureSheets(['Plan', 'Gold', 'Certificates', 'Currency Rates', 'Tags', 'Provident Fund', 'Stock Meta', 'Stock Holdings', 'Stock Vesting']);
      })
      .then(recomputeAndWriteAllLedgers)
      .then(function () { set({ loading: false }); });
  }).catch(function (e) {
    set({ loading: false, connecting: false, error: 'Sync error: ' + e.message });
  });
}

/* -------------------------------------------------------- view model --- */

export function accountTagOf(s, name) {
  return (s.accountTags[name] && s.accountTags[name].trim()) || TAG_SPENDING;
}

/* Whether a transaction's To Account is required — also used by the
   Transactions screen (views/transactions.js) to enable/disable the field. */
export function toFieldRequired(type) {
  var t = (type || '').trim().toLowerCase();
  return t !== 'starting balance' && t !== 'plug';
}

function lastBalance(rows) {
  return rows.length ? rows[rows.length - 1].Balance : 0;
}

/* Merge a builder's slice into the view model. */
function assign(target, slice) {
  Object.keys(slice).forEach(function (k) { target[k] = slice[k]; });
  return target;
}

/* n >= 0 gets the positive class, else the negative one. Every screen that
   colours a gain/loss figure reduces to this; the two optional args cover
   the two places that colour something other than the plain gain-pos/neg
   pair (a card border, ESPP's alternate positive shade). Lives here rather
   than with the view helpers in views/helpers.js because every call site is a
   builder below — moving it downstream of them would need model.js to import
   from views.js, against the module graph's direction. */
export function gainClass(n, posClass, negClass) {
  return n >= 0 ? (posClass || 'gain-pos') : (negClass || 'gain-neg');
}

/* ------------------------------------------------ shared intermediates --- */

/* Every account's running ledger — read by the ledger screen, the dashboard's
   owner groups and the dashboard's saving-cash total. */
function buildLedgers(s) {
  var ledgers = {};
  s.accounts.forEach(function (name) { ledgers[name] = computeLedger(name, s.transactions); });
  return ledgers;
}

/* Currency → rate to EGP. A currency with no rate set converts at 0. */
function buildRatesMap(s) {
  var ratesMap = {};
  s.rates.forEach(function (r) { ratesMap[r.Currency] = parseFloat(r['Rate to EGP']) || 0; });
  return ratesMap;
}

/* -------------------------------------------------------------- shell --- */

/* Connection state, the settings screen, and which screen is showing. */
function shellModel(s) {
  var isLedger = s.activeSheet.indexOf('account:') === 0;
  return {
    sidebarOpen: s.sidebarOpen,
    activeSheet: s.activeSheet,
    connected: s.connected,
    loading: s.loading,
    errorMessage: s.error,
    showSettings: s.showSettings,
    showAppBody: s.connected && !s.showSettings,
    hasSavedConfig: !!s.clientId,
    fromLocalEnv: s.fromLocalEnv,
    clientIdInput: s.clientIdInput,
    spreadsheetIdInput: s.spreadsheetIdInput,
    connectLabel: s.connecting ? 'Connecting…' : 'Save & Connect to Google',
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/' + s.spreadsheetId + '/edit',
    isLedger: isLedger,
    ledgerAccountName: isLedger ? s.activeSheet.slice('account:'.length) : '',
  };
}

/* The sidebar's account lists: Spending in one group, everything else in the
   other. The dashboard splits saving accounts further; this does not. */
function navModel(s) {
  var navItems = s.accounts.map(function (name, i) { return { name: name, index: i }; });
  return {
    spendingAccountNavItems: navItems.filter(function (it) { return accountTagOf(s, it.name) === TAG_SPENDING; }),
    savingAccountNavItems: navItems.filter(function (it) { return accountTagOf(s, it.name) !== TAG_SPENDING; }),
    savingNavOpen: s.savingNavOpen,
    spendingNavOpen: s.spendingNavOpen,
    accountSettingsOpen: s.accountSettingsOpen,
  };
}

/* The Accounts / Transaction Types / Tags screens, plus the option lists the
   other screens' forms fill their selects from. */
function listsModel(s) {
  return {
    tagOptions: s.tags.length ? s.tags : TAG_FALLBACK_OPTIONS,
    accountRows: s.accounts.map(function (name, i) {
      return { index: i, name: name, owner: s.accountOwners[name] || '', tagDisplay: s.accountTags[name] || TAG_SPENDING };
    }),
    typeRows: s.types.map(function (name, i) { return { index: i, name: name }; }),
    tagRows: s.tags.map(function (name, i) { return { index: i, name: name }; }),
    accounts: s.accounts,
    types: s.types,
  };
}

/* ------------------------------------------------------- transactions --- */

/* The Transactions screen (searched and sorted) and the dashboard's recent
   strip. Rows are copied before sorting — `s.transactions` is index-addressed
   by every edit and delete handler, so its order must not move. */
function transactionsModel(s) {
  var txWithIndex = s.transactions.map(function (t, i) {
    var copy = {};
    Object.keys(t).forEach(function (k) { copy[k] = t[k]; });
    copy._i = i;
    return copy;
  });
  if (s.search.trim()) {
    var q = s.search.toLowerCase();
    txWithIndex = txWithIndex.filter(function (t) {
      return Object.keys(t).map(function (k) { return t[k]; }).join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }
  if (s.sortCol) {
    txWithIndex.sort(function (a, b) {
      var av = a[s.sortCol], bv = b[s.sortCol];
      if (s.sortCol === 'Amount') {
        av = parseFloat(av) || 0; bv = parseFloat(bv) || 0;
        return s.sortDir === 'asc' ? av - bv : bv - av;
      }
      return s.sortDir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  } else {
    txWithIndex.sort(function (a, b) { return (b.Date || '').localeCompare(a.Date || '') || b._i - a._i; });
  }
  return {
    transactionRows: txWithIndex.map(function (t) {
      return {
        index: t._i, date: t.Date, description: t.Description, type: t['Transaction Type'],
        from: t['From Account'], to: t['To Account'], amountDisplay: fmtMoney(t.Amount),
      };
    }),
    dateSortArrow: s.sortCol === 'Date' ? (s.sortDir === 'asc' ? ' ↑' : ' ↓') : '',
    amountSortArrow: s.sortCol === 'Amount' ? (s.sortDir === 'asc' ? ' ↑' : ' ↓') : '',
    recentTransactions: s.transactions.map(function (t, i) {
      return { t: t, i: i };
    }).sort(function (a, b) {
      return (b.t.Date || '').localeCompare(a.t.Date || '') || b.i - a.i;
    }).slice(0, 8).map(function (x) {
      return {
        date: x.t.Date, description: x.t.Description,
        fromTo: x.t['From Account'] + ' → ' + x.t['To Account'],
        amountDisplay: fmtMoney(x.t.Amount),
      };
    }),
  };
}

/* ------------------------------------------------------------- ledger --- */

/* One account's ledger screen. Newest first on screen, so the rows are copied
   before reversing — `ledgers` is shared with the dashboard. */
function ledgerModel(s, ledgers, isLedger, accountName) {
  var rawRows = isLedger ? (ledgers[accountName] || []) : [];
  var last = rawRows.length ? rawRows[rawRows.length - 1] : null;
  return {
    ledgerRows: rawRows.slice().reverse().map(function (r) {
      return {
        date: r.Date, description: r.Description, type: r['Transaction Type'],
        typeClass: r['Transaction Type'] === 'In' ? 'type-in' : r['Transaction Type'] === 'Out' ? 'type-out' : 'type-none',
        amountDisplay: fmtMoney(r.Amount), balanceDisplay: fmtMoney(r.Balance),
      };
    }),
    ledgerCurrentBalanceDisplay: fmtMoney(last ? last.Balance : 0),
    ledgerLastDateDisplay: last ? last.Date : '—',
    ledgerOwnerDisplay: s.accountOwners[accountName] || '—',
  };
}

/* --------------------------------------------------------------- gold --- */

/* Owed to the dashboard: `currentValueEgp`, the EGP side of savings by currency. */
function goldModel(s) {
  var totalGrams = 0, totalCost = 0, totalValue = 0;
  var goldRows = s.goldItems.map(function (it, i) {
    var qty = parseFloat(it.Quantity) || 0;
    var weight = parseFloat(it['Weight (gm)']) || 0;
    var grams = qty * weight;
    var cost = grams * (parseFloat(it['Purchase Price per Gram (EGP)']) || 0);
    var value = grams * (parseFloat(it['Current Price per Gram (EGP)']) || 0);
    var gain = value - cost;
    totalGrams += grams; totalCost += cost; totalValue += value;
    return {
      index: i, quantity: it.Quantity, type: it.Type, brand: it.Brand || '',
      weightDisplay: weight.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' gm',
      where: it.Where || '', purchaseDate: it['Purchase Date'],
      costDisplay: fmtEGP(cost), valueDisplay: fmtEGP(value),
      gainDisplay: signed(gain, fmtEGP), gainClass: gainClass(gain),
      tagDisplay: it.Tag || TAG_SAVING_OTHER,
    };
  });
  var goldGain = totalValue - totalCost;
  return {
    view: {
      goldRows: goldRows,
      goldEmpty: s.goldItems.length === 0,
      hasGold: s.goldItems.length > 0,
      goldTotalCurrentDisplay: fmtEGP(totalValue),
      goldTotalPurchaseDisplay: fmtEGP(totalCost),
      goldTotalGramsDisplay: totalGrams.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' gm',
      goldGainDisplay: signed(goldGain, fmtEGP),
      goldGainPctDisplay: signed(totalCost ? (goldGain / totalCost * 100) : 0, function (n) { return n.toFixed(1) + '%'; }),
      goldGainCardClass: gainClass(goldGain, 'c-gain', 'c-loss'),
    },
    totals: { currentValueEgp: totalValue },
  };
}

/* ------------------------------------------------------ currency rates --- */

/* The rates table itself. The map every other builder converts through is
   `buildRatesMap()`, not this. */
function ratesModel(s) {
  return {
    rateRows: s.rates.map(function (r) {
      return {
        currency: r.Currency,
        rateDisplay: (parseFloat(r['Rate to EGP']) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }),
        asOf: r['As Of'],
      };
    }),
  };
}

/* ------------------------------------------------------- certificates --- */

/* Owed to the dashboard: the rows near or past maturity, and the native
   per-currency principal that feeds savings by currency. */
function certificatesModel(s, ratesMap) {
  var today = new Date(new Date().toISOString().slice(0, 10));
  var certTotalNow = 0, certTotalMaturity = 0, certPrincipalEgp = 0;
  var nativeEgp = 0, nativeUsd = 0, nativeEur = 0;
  var maturityRows = [];
  var certRows = s.certItems.map(function (c, i) {
    var amount = parseFloat(c.Amount) || 0;
    var rate = parseFloat(c['Interest Rate']) || 0;
    var rateToEgp = ratesMap[c.Currency] === undefined ? 0 : ratesMap[c.Currency];
    var egpNow = amount * rateToEgp;
    var egpMaturity = amount * (1 + rate) * rateToEgp;
    certTotalNow += egpNow; certTotalMaturity += egpMaturity; certPrincipalEgp += egpNow;
    if (c.Currency === 'USD') nativeUsd += amount;
    else if (c.Currency === 'EUR') nativeEur += amount;
    else nativeEgp += amount;
    var daysToMaturity = Math.round((new Date(c['Maturity Date']) - today) / 86400000);
    var flagText, flagClass;
    if (daysToMaturity < 0) { flagText = 'Matured ' + Math.abs(daysToMaturity) + 'd ago'; flagClass = 'flag--matured'; }
    else if (daysToMaturity <= MATURITY_WATCH_DAYS) { flagText = 'Matures in ' + daysToMaturity + 'd'; flagClass = 'flag--soon'; }
    else { flagText = daysToMaturity + 'd to go'; flagClass = 'flag--later'; }
    var row = {
      index: i, product: c['Product Name'] || '', number: c['Certificate Number'] || '',
      amountDisplay: amount.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + c.Currency,
      rateDisplay: (rate * 100).toFixed(1) + '% / ' + (c['Interest Frequency'] || ''),
      maturityDate: c['Maturity Date'], flagText: flagText, flagClass: flagClass,
      egpNowDisplay: fmtEGP(egpNow), egpMaturityDisplay: fmtEGP(egpMaturity),
      tagDisplay: c.Tag || TAG_SAVING_OTHER,
    };
    if (daysToMaturity <= MATURITY_WATCH_DAYS) {
      maturityRows.push({
        product: row.product, maturityDate: row.maturityDate, flagText: flagText, flagClass: flagClass,
        maturityEgpDisplay: fmtEGP(egpMaturity), days: daysToMaturity,
      });
    }
    return row;
  });
  maturityRows.sort(function (a, b) { return a.days - b.days; });
  var certGroupMap = {};
  s.certItems.forEach(function (c, i) {
    (certGroupMap[c.Currency] = certGroupMap[c.Currency] || []).push(certRows[i]);
  });
  var certGain = certTotalMaturity - certPrincipalEgp;
  return {
    view: {
      certGroups: Object.keys(certGroupMap).sort().map(function (currency) {
        return { currency: currency, rows: certGroupMap[currency], isOpen: s.certGroupOpen[currency] !== false };
      }),
      certEmpty: s.certItems.length === 0,
      hasCerts: s.certItems.length > 0,
      certTotalCurrentDisplay: fmtEGP(certTotalNow),
      certTotalMaturityDisplay: fmtEGP(certTotalMaturity),
      certGainDisplay: signed(certGain, fmtEGP),
      certGainPctDisplay: signed(certPrincipalEgp ? (certGain / certPrincipalEgp * 100) : 0, function (n) { return n.toFixed(1) + '%'; }),
      certGainCardClass: gainClass(certGain, 'c-gain', 'c-loss'),
    },
    totals: {
      maturityRows: maturityRows,
      nativeEgp: nativeEgp, nativeUsd: nativeUsd, nativeEur: nativeEur,
    },
  };
}

/* ------------------------------------------------------------- stocks --- */

/* Owed to the dashboard: what is sellable now, split RSU/ESPP/cash for the
   maturity watch, and the symbol suffix its two rows are labelled with.
   Unvested stock is deliberately not among them — it is excluded from savings. */
function stocksModel(s) {
  var stockMeta = s.stockMeta || {};
  var stockPrice = parseFloat(stockMeta['Current Price (USD)']) || 0;
  var stockCash = parseFloat(stockMeta['Cash (USD)']) || 0;
  var stockSymbol = stockMeta.Symbol || '';
  var rsuNowQty = 0, rsuNowVal = 0, rsuNowCost = 0, esppNowQty = 0, esppNowVal = 0, esppNowCost = 0;
  var holdingRows = s.stockHoldings.map(function (h, i) {
    var qty = parseFloat(h.Quantity) || 0;
    var cost = parseFloat(h['Cost Basis (USD)']) || 0;
    var val = qty * stockPrice;
    var gain = val - cost;
    var src = h.Source || 'Vested RSU';
    if (src === 'ESPP') { esppNowQty += qty; esppNowVal += val; esppNowCost += cost; }
    else { rsuNowQty += qty; rsuNowVal += val; rsuNowCost += cost; }
    return {
      index: i, source: src, label: h.Label || '',
      sourceClass: src === 'ESPP' ? 'pill-source--espp' : 'pill-source--rsu',
      quantityDisplay: qty.toLocaleString('en-US', { maximumFractionDigits: 4 }),
      costDisplay: fmtMoney(cost), valueDisplay: fmtMoney(val),
      gainDisplay: signed(gain, fmtMoney), gainClass: gainClass(gain),
      tagDisplay: h.Tag || TAG_SAVING_OTHER,
    };
  });
  var heldQty = rsuNowQty + esppNowQty;
  var shareVal = rsuNowVal + esppNowVal;
  var sellableNow = shareVal + stockCash;
  var totalNowCost = rsuNowCost + esppNowCost;
  var totalNowGain = shareVal - totalNowCost;
  var esppGain = esppNowVal - esppNowCost;

  var unvestedTotal = 0, unvestedUnits = 0;
  var yearMap = {};
  var vestingRows = s.stockVesting.map(function (vest, i) {
    var units = parseFloat(vest.Units) || 0;
    var val = units * stockPrice;
    var date = vest['Vest Date'] || '';
    var yr = date.slice(0, 4);
    unvestedTotal += val; unvestedUnits += units;
    if (!yearMap[yr]) yearMap[yr] = { units: 0, val: 0, months: [] };
    yearMap[yr].units += units;
    yearMap[yr].val += val;
    if (date) {
      var m = parseInt(date.slice(5, 7), 10);
      if (yearMap[yr].months.indexOf(m) === -1) yearMap[yr].months.push(m);
    }
    return {
      index: i, date: date, grant: vest.Grant || '',
      unitsDisplay: units.toLocaleString('en-US', { maximumFractionDigits: 3 }),
      valueDisplay: fmtMoney(val),
    };
  });

  var scenario = (s.stockScenarioPrice !== null && !isNaN(s.stockScenarioPrice)) ? s.stockScenarioPrice : stockPrice;
  /* Empty until a Symbol is set in the Sheet — keep the parenthetical off entirely. */
  var stockSymbolSuffix = stockSymbol ? ' (' + stockSymbol + ')' : '';
  return {
    view: {
      holdingRows: holdingRows,
      vestingRows: vestingRows,
      vestingByYear: Object.keys(yearMap).sort().map(function (yr) {
        var g = yearMap[yr];
        var ms = g.months.slice().sort(function (a, b) { return a - b; });
        var monthLabel = ms.length ? (ms.length > 1 ? MONTHS[ms[0]] + '–' + MONTHS[ms[ms.length - 1]] : MONTHS[ms[0]]) : '';
        return { label: (monthLabel ? monthLabel + ' ' : '') + yr, valueDisplay: fmtMoney(g.val) };
      }),
      scenarioFillPct: Math.min(100, Math.max(0, ((scenario - SCENARIO_MIN) / (SCENARIO_MAX - SCENARIO_MIN)) * 100)),
      scenarioSellableDisplay: fmtMoney(heldQty * scenario + stockCash),
      scenarioUnvestedDisplay: fmtMoney(unvestedUnits * scenario),
      stockScenarioValue: scenario,
      stockScenarioPriceDisplay: scenario.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      scenarioSliderMin: SCENARIO_MIN,
      scenarioSliderMax: SCENARIO_MAX,
      // Read via lastVm in updateScenarioReadouts(); do not delete as unused.
      scenarioInputs: { heldQty: heldQty, stockCash: stockCash, unvestedUnits: unvestedUnits },
      hasStocks: s.stockHoldings.length > 0 || s.stockVesting.length > 0,
      hasEspp: esppNowQty > 0,
      stockSymbol: stockSymbol,
      stockSymbolSuffix: stockSymbolSuffix,
      stockPriceDisplay: stockPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      stockAsOfDisplay: stockMeta['As Of'] || '—',
      stockCashDisplay: fmtMoney(stockCash),
      sellableNowDisplay: fmtMoney(sellableNow),
      heldSharesDisplay: heldQty.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' shares',
      rsuNowValueDisplay: fmtMoney(rsuNowVal),
      rsuNowQtyDisplay: rsuNowQty.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' sh',
      esppNowValueDisplay: fmtMoney(esppNowVal),
      esppNowQtyDisplay: esppNowQty.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' sh',
      stockNowGainDisplay: signed(totalNowGain, fmtMoney),
      stockNowGainClass: gainClass(totalNowGain),
      stockNowGainPctDisplay: signed(totalNowCost ? (totalNowGain / totalNowCost * 100) : 0, function (n) { return n.toFixed(2) + '%'; }),
      esppGainDisplay: signed(esppGain, fmtMoney),
      esppGainClass: gainClass(esppGain, 'gain-pos-alt'),
      esppGainPctDisplay: signed(esppNowCost ? (esppGain / esppNowCost * 100) : 0, function (n) { return n.toFixed(1) + '%'; }),
      esppPaidDisplay: fmtMoney(esppNowCost),
      unvestedTotalDisplay: fmtMoney(unvestedTotal),
      unvestedUnitsDisplay: unvestedUnits.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' units',
    },
    totals: {
      rsuValueUsd: rsuNowVal, esppValueUsd: esppNowVal, cashUsd: stockCash,
      sellableNowUsd: sellableNow, symbolSuffix: stockSymbolSuffix,
    },
  };
}

/* ----------------------------------------------------- provident fund --- */

/* Owed to the dashboard: the balance, as an EGP number rather than a display
   string. A missing Provident Fund row counts as 0, not as a gap. */
function providentFundModel(s) {
  return {
    view: {
      pfBalanceDisplay: s.providentFund ? fmtEGP(s.providentFund.Balance) : '—',
      pfAsOfDisplay: s.providentFund ? s.providentFund['As Of'] : '—',
      pfTagDisplay: (s.providentFund && s.providentFund.Tag) || TAG_SAVING_OTHER,
    },
    totals: { balanceEgp: parseFloat(s.providentFund && s.providentFund.Balance) || 0 },
  };
}

/* ---------------------------------------------------------- dashboard --- */

/* Runs last: it reports what the other domains computed. `shared` carries the
   ledgers, the rates map, and the `totals` of the gold, certificates, stocks
   and provident-fund builders — see the note at the top of this file. */
function dashboardModel(s, shared) {
  var ledgers = shared.ledgers;
  var usdRate = shared.ratesMap.USD || 0;
  var eurRate = shared.ratesMap.EUR || 0;

  /* --- account groups, by owner within each tag --- */
  function buildOwnerGroups(names) {
    var groupMap = {};
    names.forEach(function (name) {
      var owner = (s.accountOwners[name] || '').trim() || 'Unassigned';
      var bal = lastBalance(ledgers[name]);
      (groupMap[owner] = groupMap[owner] || []).push({ name: name, balanceDisplay: fmtMoney(bal), bal: bal });
    });
    return Object.keys(groupMap).sort().map(function (owner) {
      var rows = groupMap[owner];
      var ownerAccounts = rows.map(function (r) { return r.name; });
      var lastDate = s.transactions.filter(function (t) {
        return ownerAccounts.indexOf(t['From Account']) !== -1 || ownerAccounts.indexOf(t['To Account']) !== -1;
      }).reduce(function (max, t) { return (t.Date && (!max || t.Date > max)) ? t.Date : max; }, '');
      return {
        owner: owner, rows: rows, lastDateDisplay: lastDate || '—',
        subtotalDisplay: fmtMoney(rows.reduce(function (sum, r) { return sum + r.bal; }, 0)),
      };
    });
  }
  var spendingNames = s.accounts.filter(function (n) { return accountTagOf(s, n) === TAG_SPENDING; });
  var schoolNames = s.accounts.filter(function (n) { return accountTagOf(s, n) === TAG_SAVING_SCHOOL; });
  var otherSavingNames = s.accounts.filter(function (n) {
    var t = accountTagOf(s, n);
    return t !== TAG_SPENDING && t !== TAG_SAVING_SCHOOL;
  });
  var spendingGroups = buildOwnerGroups(spendingNames);
  var schoolGroups = buildOwnerGroups(schoolNames);
  var otherSavingGroups = buildOwnerGroups(otherSavingNames);

  /* --- maturity & liquidity watch: certificates first, then what is sellable --- */
  var watchRows = shared.certificates.maturityRows.slice();
  if (shared.stocks.rsuValueUsd > 0 || shared.stocks.cashUsd > 0) {
    watchRows.push({
      product: 'Stocks — Vested RSU' + shared.stocks.symbolSuffix, maturityDate: '—',
      flagText: 'Sellable now', flagClass: 'flag--sellable',
      maturityEgpDisplay: fmtEGP((shared.stocks.rsuValueUsd + shared.stocks.cashUsd) * usdRate),
    });
  }
  if (shared.stocks.esppValueUsd > 0) {
    watchRows.push({
      product: 'Stocks — ESPP' + shared.stocks.symbolSuffix, maturityDate: '—',
      flagText: 'Sellable now', flagClass: 'flag--sellable',
      maturityEgpDisplay: fmtEGP(shared.stocks.esppValueUsd * usdRate),
    });
  }

  /* --- savings by currency (see functional-reqs.md § Dashboard totals) --- */
  var savingAcctEGP = schoolNames.concat(otherSavingNames).reduce(function (sum, name) {
    return sum + lastBalance(ledgers[name]);
  }, 0);
  var egpNative = shared.certificates.nativeEgp + shared.gold.currentValueEgp
    + shared.providentFund.balanceEgp + savingAcctEGP;
  var usdNative = shared.certificates.nativeUsd + shared.stocks.sellableNowUsd;
  var eurNative = shared.certificates.nativeEur;

  return {
    spendingGroups: spendingGroups,
    otherSavingGroups: otherSavingGroups,
    schoolAccountRows: schoolGroups.reduce(function (acc, g) { return acc.concat(g.rows); }, []),
    hasSpendingAccounts: spendingGroups.length > 0,
    hasSchoolAccounts: schoolGroups.length > 0,
    maturityWatchRows: watchRows,
    hasMaturityWatch: watchRows.length > 0,
    totalSavingsEgpDisplay: fmtEGP(egpNative + usdNative * usdRate + eurNative * eurRate),
    currencyCards: [
      {
        code: 'EGP', cls: 'cc--egp', nativeDisplay: fmtEGP(egpNative), equivDisplay: fmtEGP(egpNative),
        items: [
          { label: 'Certificates', amt: fmtEGP(shared.certificates.nativeEgp) },
          { label: 'Gold', amt: fmtEGP(shared.gold.currentValueEgp) },
          { label: 'Provident Fund', amt: fmtEGP(shared.providentFund.balanceEgp) },
          { label: 'Saving cash', amt: fmtEGP(savingAcctEGP) },
        ],
      },
      {
        code: 'USD', cls: 'cc--usd', nativeDisplay: fmtMoney(usdNative), equivDisplay: fmtEGP(usdNative * usdRate),
        items: [
          { label: 'Stocks (sellable now)', amt: fmtMoney(shared.stocks.sellableNowUsd) },
          { label: 'Certificates', amt: fmtMoney(shared.certificates.nativeUsd) },
        ],
      },
      {
        code: 'EUR', cls: 'cc--eur', nativeDisplay: fmtEUR(eurNative), equivDisplay: fmtEGP(eurNative * eurRate),
        items: [{ label: 'Certificates', amt: fmtEUR(shared.certificates.nativeEur) }],
      },
    ],
  };
}

/* --------------------------------------------------------------- plan --- */

/* The Plan tab: the plan items bucketed into their three steps. */
function planModel(s) {
  return {
    planStepGroups: ['1', '2', '3'].map(function (step) {
      var items = s.planItems.map(function (p, i) { return { p: p, i: i }; })
        .filter(function (x) { return x.p.Step === step; })
        .map(function (x) {
          var p = x.p;
          return {
            index: x.i, item: p.Item, notes: p.Notes || '', status: p.Status,
            statusClass: p.Status === 'Done' ? 'pill--done' : p.Status === 'In progress' ? 'pill--progress' : 'pill--todo',
            versionDisplay: p.Version || '—',
            versionClass: p.Version ? 'pill--ver' : 'pill--ver-empty',
          };
        });
      return { label: PLAN_STEP_LABELS[step], items: items, empty: items.length === 0 };
    }),
  };
}

/* ---------------------------------------------------------- the model --- */

export function buildViewModel() {
  var s = state;
  var v = {};

  /* Built once and handed on, rather than re-derived inside each builder. */
  var ledgers = buildLedgers(s);
  var ratesMap = buildRatesMap(s);

  /* `shell` decides which screen is up, so the ledger builder needs it first. */
  var shell = shellModel(s);

  /* The four whose `totals` the dashboard reports on — all built before it runs. */
  var gold = goldModel(s);
  var certificates = certificatesModel(s, ratesMap);
  var stocks = stocksModel(s);
  var providentFund = providentFundModel(s);

  assign(v, shell);
  assign(v, navModel(s));
  assign(v, listsModel(s));
  assign(v, transactionsModel(s));
  assign(v, ledgerModel(s, ledgers, shell.isLedger, shell.ledgerAccountName));
  assign(v, gold.view);
  assign(v, ratesModel(s));
  assign(v, certificates.view);
  assign(v, stocks.view);
  assign(v, providentFund.view);
  assign(v, dashboardModel(s, {
    ledgers: ledgers,
    ratesMap: ratesMap,
    gold: gold.totals,
    certificates: certificates.totals,
    stocks: stocks.totals,
    providentFund: providentFund.totals,
  }));
  assign(v, planModel(s));

  return v;
}
