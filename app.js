/* AK47 Finance Tracker — the whole app.
 *
 * Plain browser JS, no build step and no framework. One `state` object is the
 * single source of truth; every handler mutates it and calls render(), which
 * rebuilds the sidebar and the active screen from template literals.
 *
 * Sections, in order:
 *   1. Constants & seed data      6. View helpers
 *   2. Formatting helpers         7. Screen views
 *   3. State                      8. Render (focus/scroll preservation)
 *   4. Auth & Sheets API          9. Actions & field handlers
 *   5. View model                10. Boot
 */

(function () {
  'use strict';

  /* ------------------------------------------------ 1. constants & seeds --- */

  var TX_HEADERS = ['Date', 'Amount', 'Description', 'Transaction Type', 'From Account', 'To Account'];
  var LEDGER_HEADERS = ['Date', 'Description', 'Transaction Type', 'Amount', 'Balance'];
  var PLAN_HEADERS = ['Step', 'Item', 'Status', 'Notes', 'Version'];
  var PLAN_STEP_LABELS = { '1': 'Step 1 — Consolidate', '2': 'Step 2 — Analyze', '3': 'Step 3 — Automate' };
  var TAG_PLAN_ITEM_TEXT = 'Tag every account, gold lot & certificate as Spending, Saving > School, or Saving > Other';
  var DEFAULT_PLAN_ITEMS = [
    { Step: '1', Item: 'Credit card accounts tracked as negative balances', Status: 'Done', Notes: '', Version: 'v1' },
    { Step: '1', Item: 'Obligations: school fees & recurring expenses', Status: 'Not started', Notes: '', Version: '' },
    { Step: '1', Item: 'Certificates (USD and EGP)', Status: 'Done', Notes: '', Version: 'v3' },
    { Step: '1', Item: 'Gold holdings (grams)', Status: 'Done', Notes: '', Version: 'v2' },
    { Step: '1', Item: TAG_PLAN_ITEM_TEXT, Status: 'Done', Notes: 'Dashboard now groups by Spending vs Saving (School / Other) instead of owner-only', Version: 'v4' },
    { Step: '2', Item: 'Currency/inflation-adjusted net worth (EGP vs USD/gold)', Status: 'Not started', Notes: '', Version: '' },
    { Step: '2', Item: 'Zakah calculation (nisab + hawl)', Status: 'Not started', Notes: '', Version: '' },
    { Step: '3', Item: 'Automate data entry (bank statements, SMS, invoices)', Status: 'Not started', Notes: '', Version: '' },
  ];

  var DEFAULT_SPREADSHEET_ID = '1KDFdh2yZHEH6WnKfQsDZ2qxHuGm49tDJLs2nNAZ3EOI';

  var GOLD_HEADERS = ['Quantity', 'Type', 'Brand', 'Weight (gm)', 'Where', 'Purchase Price per Gram (EGP)', 'Purchase Date', 'Current Price per Gram (EGP)', 'As Of', 'Tag'];
  var DEFAULT_GOLD_ITEMS = [
    { Quantity: 2, Type: 'Gold 24', Brand: 'BTC', 'Weight (gm)': 5, Where: "Wafy's Bank", 'Purchase Price per Gram (EGP)': 3538.00, 'Purchase Date': '2024-03-21', 'Current Price per Gram (EGP)': 6528.00, 'As Of': '2026-07-29', Tag: 'Saving > Other' },
    { Quantity: 3, Type: 'Gold 24', Brand: 'Master Gold Egypt', 'Weight (gm)': 10, Where: "Wafy's Bank", 'Purchase Price per Gram (EGP)': 3589.08, 'Purchase Date': '2024-03-31', 'Current Price per Gram (EGP)': 6528.00, 'As Of': '2026-07-29', Tag: 'Saving > Other' },
    { Quantity: 1, Type: 'Gold 24', Brand: 'Master Gold Egypt', 'Weight (gm)': 20, Where: "Wafy's Bank", 'Purchase Price per Gram (EGP)': 3585.08, 'Purchase Date': '2024-03-31', 'Current Price per Gram (EGP)': 6528.00, 'As Of': '2026-07-29', Tag: 'Saving > Other' },
    { Quantity: 1, Type: 'Gold 24', Brand: 'BTC', 'Weight (gm)': 31.1, Where: "Wafy's Bank", 'Purchase Price per Gram (EGP)': 5682.96, 'Purchase Date': '2025-09-13', 'Current Price per Gram (EGP)': 6528.00, 'As Of': '2026-07-29', Tag: 'Saving > Other' },
    { Quantity: 1, Type: 'Gold 24', Brand: 'BTC', 'Weight (gm)': 10, Where: "Wafy's Bank", 'Purchase Price per Gram (EGP)': 5687.00, 'Purchase Date': '2025-09-13', 'Current Price per Gram (EGP)': 6528.00, 'As Of': '2026-07-29', Tag: 'Saving > Other' },
  ];

  var CERT_HEADERS = ['Certificate Number', 'Product Name', 'Open Date', 'Amount', 'Currency', 'Interest Frequency', 'Maturity Date', 'Interest Rate', 'Tag'];
  var DEFAULT_CERT_ITEMS = [
    { 'Certificate Number': '114 722 032 623 750 0039', 'Product Name': 'الشهادة البلاتينية - سنه - عائد سنوي', 'Open Date': '2024-02-13', Amount: 350000, Currency: 'EGP', 'Interest Frequency': '1 Year', 'Maturity Date': '2025-02-14', 'Interest Rate': 0.27, Tag: 'Saving > Other' },
    { 'Certificate Number': '114 722 032 623 750 0061', 'Product Name': 'الشهادة البلاتينية - سنه - عائد سنوي', 'Open Date': '2024-02-13', Amount: 100000, Currency: 'EGP', 'Interest Frequency': '1 Year', 'Maturity Date': '2025-02-14', 'Interest Rate': 0.27, Tag: 'Saving > Other' },
    { 'Certificate Number': '114 722 032 623 750 0050', 'Product Name': 'الشهادة البلاتينية - سنه - عائد سنوي', 'Open Date': '2024-02-13', Amount: 100000, Currency: 'EGP', 'Interest Frequency': '1 Year', 'Maturity Date': '2025-02-14', 'Interest Rate': 0.27, Tag: 'Saving > Other' },
    { 'Certificate Number': '114 722 032 623 750 0048', 'Product Name': 'الشهادة البلاتينية - سنه - عائد سنوي', 'Open Date': '2024-02-13', Amount: 150000, Currency: 'EGP', 'Interest Frequency': '1 Year', 'Maturity Date': '2025-02-14', 'Interest Rate': 0.27, Tag: 'Saving > Other' },
    { 'Certificate Number': '165 704 032 623 750 0018', 'Product Name': 'Al Ahly Plus - USD - 3 Years - Quaterly Return', 'Open Date': '2023-11-06', Amount: 1000, Currency: 'USD', 'Interest Frequency': '3 Month', 'Maturity Date': '2026-11-07', 'Interest Rate': 0.07, Tag: 'Saving > Other' },
    { 'Certificate Number': '100 704 032 623 750 0013', 'Product Name': 'Al Ahly Plus - USD - 3 Years - Quaterly Return', 'Open Date': '2023-11-07', Amount: 20000, Currency: 'USD', 'Interest Frequency': '3 Month', 'Maturity Date': '2026-11-08', 'Interest Rate': 0.07, Tag: 'Saving > Other' },
    { 'Certificate Number': '100 709 032 623 750 0013', 'Product Name': 'New Golden Certificate - 3 Years - Quaterly return - USD/EUR', 'Open Date': '2023-11-07', Amount: 2000, Currency: 'EUR', 'Interest Frequency': '3 Month', 'Maturity Date': '2026-11-08', 'Interest Rate': 0.075, Tag: 'Saving > Other' },
    { 'Certificate Number': '114 704 032 623 750 0019', 'Product Name': 'Al Ahly Plus - USD - 3 Years - Quaterly Return', 'Open Date': '2023-12-28', Amount: 10000, Currency: 'USD', 'Interest Frequency': '3 Month', 'Maturity Date': '2026-12-31', 'Interest Rate': 0.07, Tag: 'Saving > Other' },
  ];

  var RATE_HEADERS = ['Currency', 'Rate to EGP', 'As Of'];
  var DEFAULT_RATES = [
    { Currency: 'EGP', 'Rate to EGP': 1, 'As Of': '2024-04-08' },
    { Currency: 'USD', 'Rate to EGP': 47.5, 'As Of': '2024-04-08' },
    { Currency: 'EUR', 'Rate to EGP': 51.4, 'As Of': '2024-04-08' },
  ];

  var STOCK_META_HEADERS = ['Symbol', 'Current Price (USD)', 'Cash (USD)', 'As Of'];
  var DEFAULT_STOCK_META = { Symbol: 'TDC', 'Current Price (USD)': 30.99, 'Cash (USD)': 54.91, 'As Of': '2026-08-01' };
  var STOCK_HOLDINGS_HEADERS = ['Source', 'Label', 'Quantity', 'Cost Basis (USD)', 'Acquired Date'];
  var DEFAULT_STOCK_HOLDINGS = [
    { Source: 'Vested RSU', Label: 'RSU vest Mar 2026 (grant Mar 2025)', Quantity: 345, 'Cost Basis (USD)': 10474.20, 'Acquired Date': '2026-03-03' },
    { Source: 'Vested RSU', Label: 'RSU vest Feb 2026 (grant Feb 2024)', Quantity: 194, 'Cost Basis (USD)': 6109.06, 'Acquired Date': '2026-02-27' },
  ];
  var STOCK_VESTING_HEADERS = ['Vest Date', 'Grant', 'Units'];
  var DEFAULT_STOCK_VESTING = [
    { 'Vest Date': '2027-02-27', Grant: 'TDRSU24IG', Units: 246 },
    { 'Vest Date': '2027-03-01', Grant: 'TDRSU26IG', Units: 341 },
    { 'Vest Date': '2027-03-03', Grant: 'TDRSU25IG', Units: 345 },
    { 'Vest Date': '2028-03-01', Grant: 'TDRSU26IG', Units: 341 },
    { 'Vest Date': '2028-03-03', Grant: 'TDRSU25IG', Units: 345 },
    { 'Vest Date': '2029-03-01', Grant: 'TDRSU26IG', Units: 341 },
  ];

  var TAG_SPENDING = 'Spending';
  var TAG_SAVING_SCHOOL = 'Saving > School';
  var TAG_SAVING_OTHER = 'Saving > Other';
  var DEFAULT_TAGS = [TAG_SPENDING, TAG_SAVING_SCHOOL, TAG_SAVING_OTHER];

  var MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var SCENARIO_MIN = 10;
  var SCENARIO_MAX = 80;
  var MATURITY_WATCH_DAYS = 60;

  /* -------------------------------------------------- 2. formatting ----- */

  /* Cells the Sheet has typed as Date come back as serial numbers. */
  function sheetsFmtDate(v) {
    if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
    return v;
  }

  function fmtMoney(n) {
    var v = Number(n) || 0;
    var formatted = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 ? '-$' : '$') + formatted;
  }

  function fmtEGP(n) {
    var v = Number(n) || 0;
    var formatted = Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
    return (v < 0 ? '-EGP ' : 'EGP ') + formatted;
  }

  function fmtEUR(n) {
    var v = Number(n) || 0;
    var formatted = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (v < 0 ? '-€' : '€') + formatted;
  }

  function signed(value, formatter) {
    return (value >= 0 ? '+' : '') + formatter(value);
  }

  function formatAmountDisplay(raw) {
    var stripped = String(raw).replace(/[^0-9.\-]/g, '');
    var sign = stripped.charAt(0) === '-' ? '-' : '';
    var rest = sign ? stripped.slice(1) : stripped;
    var dotIndex = rest.indexOf('.');
    var intPart = dotIndex === -1 ? rest : rest.slice(0, dotIndex);
    var decPart = dotIndex === -1 ? '' : '.' + rest.slice(dotIndex + 1).replace(/\./g, '');
    intPart = intPart.replace(/^0+(?=\d)/, '');
    var withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + withCommas + decPart;
  }

  var ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, function (c) { return ESCAPES[c]; });
  }

  /* ------------------------------------------------------------ 3. state --- */

  var state = {
    clientId: '',
    accessToken: '',
    tokenExpiry: 0,
    spreadsheetId: DEFAULT_SPREADSHEET_ID,
    clientIdInput: '',
    spreadsheetIdInput: DEFAULT_SPREADSHEET_ID,
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
    typeForm: { mode: 'add', index: -1, name: '' },
    tags: [],
    tagForm: { mode: 'add', index: -1, name: '' },
    txForm: { mode: 'add', index: -1, date: '', amount: '', description: '', type: '', from: '', to: '' },
    planItems: [],
    planForm: { mode: 'add', index: -1, step: '1', item: '', status: 'Not started', notes: '', version: '' },
    goldItems: [],
    goldForm: { mode: 'add', index: -1, quantity: '', type: '', brand: '', weight: '', where: '', purchasePrice: '', purchaseDate: '', currentPrice: '', asOf: '', tag: TAG_SAVING_OTHER },
    goldPriceForm: { currentPrice: '', asOf: '' },
    certItems: [],
    certForm: { mode: 'add', index: -1, number: '', product: '', openDate: '', amount: '', currency: '', frequency: '', maturityDate: '', rate: '', tag: TAG_SAVING_OTHER },
    rates: [],
    rateForm: { currency: '', rate: '', asOf: '' },
    providentFund: null,
    pfForm: { balance: '', asOf: '', tag: TAG_SAVING_OTHER },
    stockMeta: null,
    stockHoldings: [],
    stockVesting: [],
    stockTab: 'overview',
    stockScenarioPrice: null,
    holdingForm: { mode: 'add', index: -1, source: 'Vested RSU', label: '', quantity: '', cost: '', acquired: '' },
    vestingForm: { mode: 'add', index: -1, date: '', grant: '', units: '' },
    stockPriceForm: { symbol: '', currentPrice: '', cash: '', asOf: '' },
    dashCurrencyOpen: true,
    aboutTab: 'about',
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

  function set(patch) {
    Object.keys(patch).forEach(function (k) { state[k] = patch[k]; });
    render();
  }

  function setForm(formName, key, value) {
    state[formName][key] = value;
    render();
  }

  function toggle(key) {
    state[key] = !state[key];
    render();
  }

  /* ------------------------------------------------ 4. auth & Sheets API --- */

  var tokenClient = null;
  var sheetIdMap = null;

  function waitForGis() {
    if (window.google && window.google.accounts && window.google.accounts.oauth2) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var tries = 0;
      var t = setInterval(function () {
        if (window.google && window.google.accounts && window.google.accounts.oauth2) { clearInterval(t); resolve(); }
        else if (++tries > 100) { clearInterval(t); reject(new Error('Google sign-in library failed to load.')); }
      }, 50);
    });
  }

  function ensureToken() {
    if (state.accessToken && Date.now() < state.tokenExpiry - 30000) return Promise.resolve(state.accessToken);
    return waitForGis().then(function () {
      return new Promise(function (resolve, reject) {
        if (!tokenClient) {
          tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: state.clientId,
            scope: 'https://www.googleapis.com/auth/spreadsheets',
            callback: function (resp) {
              if (resp.error) { reject(new Error('Google sign-in error: ' + resp.error)); return; }
              state.accessToken = resp.access_token;
              state.tokenExpiry = Date.now() + (resp.expires_in * 1000);
              resolve(resp.access_token);
            },
          });
        }
        tokenClient.requestAccessToken({ prompt: state.accessToken ? '' : 'consent' });
      });
    });
  }

  function sheetsFetch(path, opts) {
    opts = opts || {};
    return ensureToken().then(function (token) {
      var headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
      Object.keys(opts.headers || {}).forEach(function (k) { headers[k] = opts.headers[k]; });
      return fetch('https://sheets.googleapis.com/v4/spreadsheets/' + state.spreadsheetId + path, {
        method: opts.method, body: opts.body, headers: headers,
      });
    }).then(function (res) {
      return res.json();
    }).then(function (json) {
      if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
      return json;
    });
  }

  function getSheetMeta() {
    return sheetsFetch('?fields=sheets.properties(sheetId,title)').then(function (json) {
      var map = {};
      (json.sheets || []).forEach(function (sh) { map[sh.properties.title] = sh.properties.sheetId; });
      sheetIdMap = map;
      return map;
    });
  }

  function ensureSheetExists(name) {
    return Promise.resolve(sheetIdMap ? null : getSheetMeta()).then(function () {
      if (sheetIdMap[name] !== undefined) return null;
      return sheetsFetch(':batchUpdate', {
        method: 'POST',
        body: JSON.stringify({ requests: [{ addSheet: { properties: { title: name } } }] }),
      }).then(function (json) {
        sheetIdMap[name] = json.replies[0].addSheet.properties.sheetId;
      });
    });
  }

  function writeSheet(sheetName, headers, rows) {
    return ensureSheetExists(sheetName).then(function () {
      var data = [headers].concat((rows || []).map(function (r) {
        return headers.map(function (h) { return (r[h] !== undefined && r[h] !== null) ? r[h] : ''; });
      }));
      var enc = encodeURIComponent(sheetName);
      return sheetsFetch('/values/' + enc + '!A1:ZZ20000:clear', { method: 'POST', body: JSON.stringify({}) })
        .then(function () {
          return sheetsFetch('/values/' + enc + '!A1?valueInputOption=RAW', {
            method: 'PUT',
            body: JSON.stringify({ range: sheetName + '!A1', majorDimension: 'ROWS', values: data }),
          });
        });
    });
  }

  function ensureSheets(names) {
    return (names || []).reduce(function (chain, n) {
      return chain.then(function () { return ensureSheetExists(n); });
    }, Promise.resolve());
  }

  function deleteSheet(title) {
    return Promise.resolve(sheetIdMap ? null : getSheetMeta()).then(function () {
      var id = sheetIdMap[title];
      if (id === undefined) return null;
      return sheetsFetch(':batchUpdate', {
        method: 'POST',
        body: JSON.stringify({ requests: [{ deleteSheet: { sheetId: id } }] }),
      }).then(function () { delete sheetIdMap[title]; });
    });
  }

  function renameSheet(oldTitle, newTitle) {
    return Promise.resolve(sheetIdMap ? null : getSheetMeta()).then(function () {
      var id = sheetIdMap[oldTitle];
      if (id === undefined) return false;
      return sheetsFetch(':batchUpdate', {
        method: 'POST',
        body: JSON.stringify({ requests: [{ updateSheetProperties: { properties: { sheetId: id, title: newTitle }, fields: 'title' } }] }),
      }).then(function () {
        sheetIdMap[newTitle] = id;
        delete sheetIdMap[oldTitle];
        return true;
      });
    });
  }

  var ALL_RANGES = [
    'Accounts!A2:C', 'Transaction Types!A2:A', 'Tags!A2:A', 'Transactions!A2:F', 'Plan!A2:E',
    'Gold!A2:J', 'Certificates!A2:I', 'Currency Rates!A2:C', 'Provident Fund!A2:C',
    'Stock Meta!A2:D', 'Stock Holdings!A2:E', 'Stock Vesting!A2:C',
  ];

  var EMPTY_DATA = {
    accounts: [], types: [], tags: [], transactions: [], plan: [], gold: [], certificates: [],
    rates: [], providentFund: null, stockMeta: null, stockHoldings: [], stockVesting: [],
  };

  function getAll() {
    var q = ALL_RANGES.map(function (r) { return 'ranges=' + encodeURIComponent(r); }).join('&');
    return sheetsFetch('/values:batchGet?' + q + '&valueRenderOption=UNFORMATTED_VALUE').catch(function (e) {
      var msg = String(e.message);
      if (msg.indexOf('Unable to parse range') !== -1 || msg.indexOf('not found') !== -1) {
        return getSheetMeta().then(function () { return null; });
      }
      throw e;
    }).then(function (json) {
      if (!json) return EMPTY_DATA;
      var vr = json.valueRanges || [];
      var get = function (i) { return (vr[i] && vr[i].values) || []; };
      var pfRows = get(8).filter(function (r) { return r[0] !== '' && r[0] != null; });
      var smRows = get(9).filter(function (r) { return r[0] !== '' && r[0] != null; });
      return {
        accounts: get(0).filter(function (r) { return r[0]; }).map(function (r) {
          return { name: r[0], owner: r[1] || '', tag: r[2] || '' };
        }),
        types: get(1).map(function (r) { return r[0]; }).filter(Boolean),
        tags: get(2).map(function (r) { return r[0]; }).filter(Boolean),
        transactions: get(3).filter(function (r) { return r[0]; }).map(function (r) {
          return { Date: sheetsFmtDate(r[0]), Amount: r[1], Description: r[2], 'Transaction Type': r[3], 'From Account': r[4], 'To Account': r[5] };
        }),
        plan: get(4).filter(function (r) { return r[0]; }).map(function (r) {
          return { Step: String(r[0]), Item: r[1], Status: r[2], Notes: r[3] || '', Version: r[4] || '' };
        }),
        gold: get(5).filter(function (r) { return r[0]; }).map(function (r) {
          return {
            Quantity: r[0], Type: r[1], Brand: r[2], 'Weight (gm)': r[3], Where: r[4],
            'Purchase Price per Gram (EGP)': r[5], 'Purchase Date': sheetsFmtDate(r[6]),
            'Current Price per Gram (EGP)': r[7], 'As Of': sheetsFmtDate(r[8]), Tag: r[9] || '',
          };
        }),
        certificates: get(6).filter(function (r) { return r[0]; }).map(function (r) {
          return {
            'Certificate Number': r[0], 'Product Name': r[1], 'Open Date': sheetsFmtDate(r[2]), Amount: r[3],
            Currency: r[4], 'Interest Frequency': r[5], 'Maturity Date': sheetsFmtDate(r[6]), 'Interest Rate': r[7], Tag: r[8] || '',
          };
        }),
        rates: get(7).filter(function (r) { return r[0]; }).map(function (r) {
          return { Currency: r[0], 'Rate to EGP': r[1], 'As Of': sheetsFmtDate(r[2]) };
        }),
        providentFund: pfRows.length ? { Balance: pfRows[0][0], 'As Of': sheetsFmtDate(pfRows[0][1]), Tag: pfRows[0][2] || '' } : null,
        stockMeta: smRows.length ? { Symbol: smRows[0][0], 'Current Price (USD)': smRows[0][1], 'Cash (USD)': smRows[0][2], 'As Of': sheetsFmtDate(smRows[0][3]) } : null,
        stockHoldings: get(10).filter(function (r) { return r[0]; }).map(function (r) {
          return { Source: r[0], Label: r[1], Quantity: r[2], 'Cost Basis (USD)': r[3], 'Acquired Date': sheetsFmtDate(r[4]) };
        }),
        stockVesting: get(11).filter(function (r) { return r[0]; }).map(function (r) {
          return { 'Vest Date': sheetsFmtDate(r[0]), Grant: r[1], Units: r[2] };
        }),
      };
    });
  }

  /* ------------------------------------------------------ ledgers & load --- */

  function computeLedger(accountName, transactions) {
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

  function recomputeAndWriteAllLedgers() {
    return state.accounts.reduce(function (chain, name) {
      return chain.then(function () {
        return writeSheet(name, LEDGER_HEADERS, computeLedger(name, state.transactions));
      });
    }, Promise.resolve());
  }

  function loadAll() {
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

      var chain = Promise.resolve();

      if (!state.stockMeta) {
        set({ stockMeta: DEFAULT_STOCK_META });
        chain = chain.then(function () {
          return writeSheet('Stock Meta', STOCK_META_HEADERS, [DEFAULT_STOCK_META]).catch(function () {});
        });
      }
      if (!state.stockHoldings.length) {
        set({ stockHoldings: DEFAULT_STOCK_HOLDINGS });
        chain = chain.then(function () {
          return writeSheet('Stock Holdings', STOCK_HOLDINGS_HEADERS, DEFAULT_STOCK_HOLDINGS).catch(function () {});
        });
      }
      if (!state.stockVesting.length) {
        set({ stockVesting: DEFAULT_STOCK_VESTING });
        chain = chain.then(function () {
          return writeSheet('Stock Vesting', STOCK_VESTING_HEADERS, DEFAULT_STOCK_VESTING).catch(function () {});
        });
      }

      chain = chain.then(function () {
        return accounts.length ? ensureSheets(accounts) : null;
      }).then(function () {
        return ensureSheets(['Plan', 'Gold', 'Certificates', 'Currency Rates', 'Tags', 'Provident Fund', 'Stock Meta', 'Stock Holdings', 'Stock Vesting']);
      });

      if (!state.tags.length) {
        chain = chain.then(function () {
          return writeSheet('Tags', ['Tag'], DEFAULT_TAGS.map(function (t) { return { Tag: t }; }));
        }).then(function () { set({ tags: DEFAULT_TAGS }); });
      }
      if (!state.providentFund) {
        var seededPf = { Balance: 1890665, 'As Of': '2026-01-01', Tag: TAG_SAVING_OTHER };
        chain = chain.then(function () {
          return writeSheet('Provident Fund', ['Balance', 'As Of', 'Tag'], [seededPf]);
        }).then(function () { set({ providentFund: seededPf }); });
      }
      if (!state.planItems.length) {
        chain = chain.then(function () {
          return writeSheet('Plan', PLAN_HEADERS, DEFAULT_PLAN_ITEMS);
        }).then(function () { set({ planItems: DEFAULT_PLAN_ITEMS }); });
      } else if (!state.planItems.some(function (p) { return p.Item === TAG_PLAN_ITEM_TEXT; })) {
        var patched = state.planItems.concat([{
          Step: '1', Item: TAG_PLAN_ITEM_TEXT, Status: 'Done',
          Notes: 'Dashboard now groups by Spending vs Saving (School / Other) instead of owner-only', Version: 'v4',
        }]);
        chain = chain.then(function () {
          return writeSheet('Plan', PLAN_HEADERS, patched);
        }).then(function () { set({ planItems: patched }); });
      }
      if (!state.goldItems.length) {
        chain = chain.then(function () {
          return writeSheet('Gold', GOLD_HEADERS, DEFAULT_GOLD_ITEMS);
        }).then(function () { set({ goldItems: DEFAULT_GOLD_ITEMS }); });
      }
      if (!state.certItems.length) {
        chain = chain.then(function () {
          return writeSheet('Certificates', CERT_HEADERS, DEFAULT_CERT_ITEMS);
        }).then(function () { set({ certItems: DEFAULT_CERT_ITEMS }); });
      }
      if (!state.rates.length) {
        chain = chain.then(function () {
          return writeSheet('Currency Rates', RATE_HEADERS, DEFAULT_RATES);
        }).then(function () { set({ rates: DEFAULT_RATES }); });
      }

      return chain.then(recomputeAndWriteAllLedgers).then(function () { set({ loading: false }); });
    }).catch(function (e) {
      set({ loading: false, connecting: false, error: 'Sync error: ' + e.message });
    });
  }

  /* Shared "write this sheet, then update state" wrapper for every save/delete. */
  function persist(sheet, headers, rows, patch, errPrefix, after) {
    set({ loading: true, error: '' });
    return writeSheet(sheet, headers, rows).then(function () {
      patch.loading = after ? true : false;
      set(patch);
      if (!after) return null;
      return after().then(function () { set({ loading: false }); });
    }).catch(function (e) {
      set({ loading: false, error: errPrefix + ': ' + e.message });
    });
  }

  /* -------------------------------------------------------- 5. view model --- */

  function accountTagOf(name) {
    return (state.accountTags[name] && state.accountTags[name].trim()) || TAG_SPENDING;
  }

  function toFieldRequired(type) {
    var t = (type || '').trim().toLowerCase();
    return t !== 'starting balance' && t !== 'plug';
  }

  function lastBalance(rows) {
    return rows.length ? rows[rows.length - 1].Balance : 0;
  }

  function buildViewModel() {
    var s = state;
    var v = {};

    v.sidebarOpen = s.sidebarOpen;
    v.activeSheet = s.activeSheet;
    v.connected = s.connected;
    v.loading = s.loading;
    v.errorMessage = s.error;
    v.showSettings = s.showSettings;
    v.showAppBody = s.connected && !s.showSettings;
    v.hasSavedConfig = !!s.clientId;
    v.clientIdInput = s.clientIdInput;
    v.spreadsheetIdInput = s.spreadsheetIdInput;
    v.connectLabel = s.connecting ? 'Connecting…' : 'Save & Connect to Google';
    v.spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/' + s.spreadsheetId + '/edit';

    v.isLedger = s.activeSheet.indexOf('account:') === 0;
    v.ledgerAccountName = v.isLedger ? s.activeSheet.slice('account:'.length) : '';

    /* --- sidebar account lists --- */
    var navItems = s.accounts.map(function (name, i) { return { name: name, index: i }; });
    v.spendingAccountNavItems = navItems.filter(function (it) { return accountTagOf(it.name) === TAG_SPENDING; });
    v.savingAccountNavItems = navItems.filter(function (it) { return accountTagOf(it.name) !== TAG_SPENDING; });
    v.savingNavOpen = s.savingNavOpen;
    v.spendingNavOpen = s.spendingNavOpen;
    v.accountSettingsOpen = s.accountSettingsOpen;

    /* --- ledgers (shared by dashboard, sidebar totals and the ledger screen) --- */
    var ledgers = {};
    s.accounts.forEach(function (name) { ledgers[name] = computeLedger(name, s.transactions); });

    /* --- tags / types / accounts screens --- */
    v.tagOptions = s.tags.length ? s.tags : DEFAULT_TAGS;
    v.accountRows = s.accounts.map(function (name, i) {
      return { index: i, name: name, owner: s.accountOwners[name] || '', tagDisplay: s.accountTags[name] || TAG_SPENDING };
    });
    v.typeRows = s.types.map(function (name, i) { return { index: i, name: name }; });
    v.tagRows = s.tags.map(function (name, i) { return { index: i, name: name }; });
    v.accounts = s.accounts;
    v.types = s.types;

    /* --- transactions --- */
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
    v.transactionRows = txWithIndex.map(function (t) {
      return {
        index: t._i, date: t.Date, description: t.Description, type: t['Transaction Type'],
        from: t['From Account'], to: t['To Account'], amountDisplay: fmtMoney(t.Amount),
      };
    });
    v.dateSortArrow = s.sortCol === 'Date' ? (s.sortDir === 'asc' ? ' ↑' : ' ↓') : '';
    v.amountSortArrow = s.sortCol === 'Amount' ? (s.sortDir === 'asc' ? ' ↑' : ' ↓') : '';

    v.recentTransactions = s.transactions.map(function (t, i) {
      return { t: t, i: i };
    }).sort(function (a, b) {
      return (b.t.Date || '').localeCompare(a.t.Date || '') || b.i - a.i;
    }).slice(0, 8).map(function (x) {
      return {
        date: x.t.Date, description: x.t.Description,
        fromTo: x.t['From Account'] + ' → ' + x.t['To Account'],
        amountDisplay: fmtMoney(x.t.Amount),
      };
    });

    /* --- ledger screen --- */
    var ledgerRawRows = v.isLedger ? (ledgers[v.ledgerAccountName] || []) : [];
    v.ledgerRows = ledgerRawRows.slice().reverse().map(function (r) {
      return {
        date: r.Date, description: r.Description, type: r['Transaction Type'],
        typeClass: r['Transaction Type'] === 'In' ? 'type-in' : r['Transaction Type'] === 'Out' ? 'type-out' : 'type-none',
        amountDisplay: fmtMoney(r.Amount), balanceDisplay: fmtMoney(r.Balance),
      };
    });
    var ledgerLast = ledgerRawRows.length ? ledgerRawRows[ledgerRawRows.length - 1] : null;
    v.ledgerCurrentBalanceDisplay = fmtMoney(ledgerLast ? ledgerLast.Balance : 0);
    v.ledgerLastDateDisplay = ledgerLast ? ledgerLast.Date : '—';
    v.ledgerOwnerDisplay = s.accountOwners[v.ledgerAccountName] || '—';

    /* --- gold --- */
    var totalGrams = 0, totalCost = 0, totalValue = 0;
    v.goldRows = s.goldItems.map(function (it, i) {
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
        gainDisplay: signed(gain, fmtEGP), gainClass: gain >= 0 ? 'gain-pos' : 'gain-neg',
        tagDisplay: it.Tag || TAG_SAVING_OTHER,
      };
    });
    var goldGain = totalValue - totalCost;
    v.goldEmpty = s.goldItems.length === 0;
    v.hasGold = s.goldItems.length > 0;
    v.goldTotalCurrentDisplay = fmtEGP(totalValue);
    v.goldTotalPurchaseDisplay = fmtEGP(totalCost);
    v.goldTotalGramsDisplay = totalGrams.toLocaleString('en-US', { maximumFractionDigits: 1 }) + ' gm';
    v.goldGainDisplay = signed(goldGain, fmtEGP);
    v.goldGainPctDisplay = signed(totalCost ? (goldGain / totalCost * 100) : 0, function (n) { return n.toFixed(1) + '%'; });
    v.goldGainCardClass = goldGain >= 0 ? 'c-gain' : 'c-loss';

    /* --- currency rates --- */
    var ratesMap = {};
    s.rates.forEach(function (r) { ratesMap[r.Currency] = parseFloat(r['Rate to EGP']) || 0; });
    v.rateRows = s.rates.map(function (r) {
      return {
        currency: r.Currency,
        rateDisplay: (parseFloat(r['Rate to EGP']) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }),
        asOf: r['As Of'],
      };
    });

    /* --- certificates --- */
    var today = new Date(new Date().toISOString().slice(0, 10));
    var certTotalNow = 0, certTotalMaturity = 0, certPrincipalEgp = 0;
    var maturityRows = [];
    var certRows = s.certItems.map(function (c, i) {
      var amount = parseFloat(c.Amount) || 0;
      var rate = parseFloat(c['Interest Rate']) || 0;
      var rateToEgp = ratesMap[c.Currency] === undefined ? 0 : ratesMap[c.Currency];
      var egpNow = amount * rateToEgp;
      var egpMaturity = amount * (1 + rate) * rateToEgp;
      certTotalNow += egpNow; certTotalMaturity += egpMaturity; certPrincipalEgp += egpNow;
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
    v.certGroups = Object.keys(certGroupMap).sort().map(function (currency) {
      return { currency: currency, rows: certGroupMap[currency], isOpen: s.certGroupOpen[currency] !== false };
    });
    var certGain = certTotalMaturity - certPrincipalEgp;
    v.certEmpty = s.certItems.length === 0;
    v.hasCerts = s.certItems.length > 0;
    v.certTotalCurrentDisplay = fmtEGP(certTotalNow);
    v.certTotalMaturityDisplay = fmtEGP(certTotalMaturity);
    v.certGainDisplay = signed(certGain, fmtEGP);
    v.certGainPctDisplay = signed(certPrincipalEgp ? (certGain / certPrincipalEgp * 100) : 0, function (n) { return n.toFixed(1) + '%'; });
    v.certGainCardClass = certGain >= 0 ? 'c-gain' : 'c-loss';

    /* --- dashboard account groups --- */
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
    var spendingNames = s.accounts.filter(function (n) { return accountTagOf(n) === TAG_SPENDING; });
    var schoolNames = s.accounts.filter(function (n) { return accountTagOf(n) === TAG_SAVING_SCHOOL; });
    var otherSavingNames = s.accounts.filter(function (n) {
      var t = accountTagOf(n);
      return t !== TAG_SPENDING && t !== TAG_SAVING_SCHOOL;
    });
    v.spendingGroups = buildOwnerGroups(spendingNames);
    var schoolGroups = buildOwnerGroups(schoolNames);
    v.otherSavingGroups = buildOwnerGroups(otherSavingNames);
    v.schoolAccountRows = schoolGroups.reduce(function (acc, g) { return acc.concat(g.rows); }, []);
    v.hasSpendingAccounts = v.spendingGroups.length > 0;
    v.hasSchoolAccounts = schoolGroups.length > 0;

    /* --- stocks --- */
    var stockMeta = s.stockMeta || {};
    var stockPrice = parseFloat(stockMeta['Current Price (USD)']) || 0;
    var stockCash = parseFloat(stockMeta['Cash (USD)']) || 0;
    var stockSymbol = stockMeta.Symbol || 'TDC';
    var rsuNowQty = 0, rsuNowVal = 0, rsuNowCost = 0, esppNowQty = 0, esppNowVal = 0, esppNowCost = 0;
    v.holdingRows = s.stockHoldings.map(function (h, i) {
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
        gainDisplay: signed(gain, fmtMoney), gainClass: gain >= 0 ? 'gain-pos' : 'gain-neg',
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
    v.vestingRows = s.stockVesting.map(function (vest, i) {
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
    v.vestingByYear = Object.keys(yearMap).sort().map(function (yr) {
      var g = yearMap[yr];
      var ms = g.months.slice().sort(function (a, b) { return a - b; });
      var monthLabel = ms.length ? (ms.length > 1 ? MONTHS[ms[0]] + '–' + MONTHS[ms[ms.length - 1]] : MONTHS[ms[0]]) : '';
      return { label: (monthLabel ? monthLabel + ' ' : '') + yr, valueDisplay: fmtMoney(g.val) };
    });

    var scenario = (s.stockScenarioPrice !== null && !isNaN(s.stockScenarioPrice)) ? s.stockScenarioPrice : stockPrice;
    v.scenarioFillPct = Math.min(100, Math.max(0, ((scenario - SCENARIO_MIN) / (SCENARIO_MAX - SCENARIO_MIN)) * 100));
    v.scenarioSellableDisplay = fmtMoney(heldQty * scenario + stockCash);
    v.scenarioUnvestedDisplay = fmtMoney(unvestedUnits * scenario);
    v.stockScenarioValue = scenario;
    v.stockScenarioPriceDisplay = scenario.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    v.scenarioSliderMin = SCENARIO_MIN;
    v.scenarioSliderMax = SCENARIO_MAX;
    /* Kept for the slider's targeted (non-rerender) update while dragging. */
    v.scenarioInputs = { heldQty: heldQty, stockCash: stockCash, unvestedUnits: unvestedUnits };

    v.hasStocks = s.stockHoldings.length > 0 || s.stockVesting.length > 0;
    v.hasEspp = esppNowQty > 0;
    v.stockSymbol = stockSymbol;
    v.stockPriceDisplay = stockPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    v.stockAsOfDisplay = stockMeta['As Of'] || '—';
    v.stockCashDisplay = fmtMoney(stockCash);
    v.sellableNowDisplay = fmtMoney(sellableNow);
    v.heldSharesDisplay = heldQty.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' shares';
    v.rsuNowValueDisplay = fmtMoney(rsuNowVal);
    v.rsuNowQtyDisplay = rsuNowQty.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' sh';
    v.esppNowValueDisplay = fmtMoney(esppNowVal);
    v.esppNowQtyDisplay = esppNowQty.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' sh';
    v.stockNowGainDisplay = signed(totalNowGain, fmtMoney);
    v.stockNowGainClass = totalNowGain >= 0 ? 'gain-pos' : 'gain-neg';
    v.stockNowGainPctDisplay = signed(totalNowCost ? (totalNowGain / totalNowCost * 100) : 0, function (n) { return n.toFixed(2) + '%'; });
    v.esppGainDisplay = signed(esppGain, fmtMoney);
    v.esppGainClass = esppGain >= 0 ? 'gain-pos-alt' : 'gain-neg';
    v.esppGainPctDisplay = signed(esppNowCost ? (esppGain / esppNowCost * 100) : 0, function (n) { return n.toFixed(1) + '%'; });
    v.esppPaidDisplay = fmtMoney(esppNowCost);
    v.unvestedTotalDisplay = fmtMoney(unvestedTotal);
    v.unvestedUnitsDisplay = unvestedUnits.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' units';

    /* --- provident fund --- */
    v.pfBalanceDisplay = s.providentFund ? fmtEGP(s.providentFund.Balance) : '—';
    v.pfAsOfDisplay = s.providentFund ? s.providentFund['As Of'] : '—';
    v.pfTagDisplay = (s.providentFund && s.providentFund.Tag) || TAG_SAVING_OTHER;

    /* --- dashboard: maturity watch & savings by currency --- */
    var usdRate = ratesMap.USD || 0;
    var eurRate = ratesMap.EUR || 0;
    var watchRows = maturityRows.slice();
    if (rsuNowVal > 0 || stockCash > 0) {
      watchRows.push({
        product: 'Stocks — Vested RSU (' + stockSymbol + ')', maturityDate: '—',
        flagText: 'Sellable now', flagClass: 'flag--sellable',
        maturityEgpDisplay: fmtEGP((rsuNowVal + stockCash) * usdRate),
      });
    }
    if (esppNowVal > 0) {
      watchRows.push({
        product: 'Stocks — ESPP (' + stockSymbol + ')', maturityDate: '—',
        flagText: 'Sellable now', flagClass: 'flag--sellable',
        maturityEgpDisplay: fmtEGP(esppNowVal * usdRate),
      });
    }
    v.maturityWatchRows = watchRows;
    v.hasMaturityWatch = watchRows.length > 0;

    var certEGP = 0, certUSD = 0, certEUR = 0;
    s.certItems.forEach(function (c) {
      var amt = parseFloat(c.Amount) || 0;
      if (c.Currency === 'USD') certUSD += amt;
      else if (c.Currency === 'EUR') certEUR += amt;
      else certEGP += amt;
    });
    var pfEGP = parseFloat(s.providentFund && s.providentFund.Balance) || 0;
    var savingAcctEGP = schoolNames.concat(otherSavingNames).reduce(function (sum, name) {
      return sum + lastBalance(ledgers[name]);
    }, 0);
    var egpNative = certEGP + totalValue + pfEGP + savingAcctEGP;
    var usdNative = certUSD + sellableNow;
    var eurNative = certEUR;
    v.totalSavingsEgpDisplay = fmtEGP(egpNative + usdNative * usdRate + eurNative * eurRate);
    v.currencyCards = [
      {
        code: 'EGP', cls: 'cc--egp', nativeDisplay: fmtEGP(egpNative), equivDisplay: fmtEGP(egpNative),
        items: [
          { label: 'Certificates', amt: fmtEGP(certEGP) },
          { label: 'Gold', amt: fmtEGP(totalValue) },
          { label: 'Provident Fund', amt: fmtEGP(pfEGP) },
          { label: 'Saving cash', amt: fmtEGP(savingAcctEGP) },
        ],
      },
      {
        code: 'USD', cls: 'cc--usd', nativeDisplay: fmtMoney(usdNative), equivDisplay: fmtEGP(usdNative * usdRate),
        items: [
          { label: 'Stocks (sellable now)', amt: fmtMoney(sellableNow) },
          { label: 'Certificates', amt: fmtMoney(certUSD) },
        ],
      },
      {
        code: 'EUR', cls: 'cc--eur', nativeDisplay: fmtEUR(eurNative), equivDisplay: fmtEGP(eurNative * eurRate),
        items: [{ label: 'Certificates', amt: fmtEUR(certEUR) }],
      },
    ];

    /* --- plan (About › Plan tab) --- */
    v.planStepGroups = ['1', '2', '3'].map(function (step) {
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
    });

    return v;
  }

  /* ------------------------------------------------------ 6. view helpers --- */

  function cls() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }

  function when(cond, html) {
    return cond ? html : '';
  }

  function options(list, selected) {
    return list.map(function (o) {
      return '<option value="' + esc(o) + '"' + (String(o) === String(selected) ? ' selected' : '') + '>' + esc(o) + '</option>';
    }).join('');
  }

  function optionPairs(pairs, selected) {
    return pairs.map(function (p) {
      return '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(selected) ? ' selected' : '') + '>' + esc(p[1]) + '</option>';
    }).join('');
  }

  /* Grid-form field: small label above a small input. */
  function field(label, inputHtml) {
    return '<div><label class="lbl sm">' + esc(label) + '</label>' + inputHtml + '</div>';
  }

  function textInput(name, value, extra) {
    return '<input class="input-sm" data-f="' + name + '" value="' + esc(value) + '"' + (extra || '') + '>';
  }

  function numInput(name, value, extra) {
    return '<input class="input-sm" type="text" inputmode="decimal" data-f="' + name + '" value="' + esc(value) + '"' + (extra || '') + '>';
  }

  function dateInput(name, value, extra) {
    return '<input class="input-sm" type="date" data-f="' + name + '" value="' + esc(value) + '"' + (extra || '') + '>';
  }

  function selectInput(name, optsHtml, extra, extraClass) {
    return '<select class="' + cls('input-sm', extraClass) + '" data-f="' + name + '"' + (extra || '') + '>' + optsHtml + '</select>';
  }

  function rowActions(editAct, deleteAct, index, tdClass) {
    return '<td class="' + tdClass + ' act">'
      + '<button class="btn-edit" data-act="' + editAct + '" data-i="' + index + '">Edit</button>'
      + '<button class="btn-del" data-act="' + deleteAct + '" data-i="' + index + '">Delete</button>'
      + '</td>';
  }

  function submitPair(submitAct, cancelAct, label, editing, rowClass) {
    return '<div class="' + (rowClass || 'btn-row') + '">'
      + '<button class="btn-p btn-p--tight" data-act="' + submitAct + '">' + esc(label) + '</button>'
      + when(editing, '<button class="btn-ghost btn-ghost--tight" data-act="' + cancelAct + '">Cancel</button>')
      + '</div>';
  }

  function chevron(open, extraClass) {
    return '<span class="' + cls('chev', extraClass, open ? 'open' : '') + '">▸</span>';
  }

  /* ------------------------------------------------------ 7. screen views --- */

  function viewSidebar(v) {
    var head = '<div class="sb-head">'
      + when(v.sidebarOpen, '<div class="sb-title"><span class="sb-title-text">AK47 Finance Tracker</span><span class="sb-badge">v3</span></div>')
      + '<div class="sb-toggle" data-act="toggleSidebar">' + (v.sidebarOpen ? '◂' : '▸') + '</div>'
      + '</div>';
    if (!v.sidebarOpen) return head;

    function navItem(label, act, active) {
      return '<div class="' + cls('nav-item', active ? 'active' : '') + '" data-act="' + act + '">' + esc(label) + '</div>';
    }
    function accountNav(items) {
      return items.map(function (it) {
        return '<div class="' + cls('nav-item', v.activeSheet === 'account:' + it.name ? 'active' : '')
          + '" data-act="selectAccount" data-i="' + it.index + '">' + esc(it.name) + '</div>';
      }).join('');
    }

    return head
      + '<div class="nav-group">'
      + navItem('Dashboard', 'goDashboard', v.activeSheet === 'dashboard')
      + navItem('Transactions', 'goTransactions', v.activeSheet === 'transactions')
      + '</div>'

      + '<div class="nav-section" data-act="toggleSavingNav">' + chevron(v.savingNavOpen, 'chev-saving') + 'Saving</div>'
      + when(v.savingNavOpen, '<div class="nav-group">'
        + navItem('Gold', 'goGold', v.activeSheet === 'gold')
        + navItem('Certificates', 'goCerts', v.activeSheet === 'certs')
        + navItem('Stocks', 'goStocks', v.activeSheet === 'stocks')
        + navItem('Provident Fund', 'goProvidentFund', v.activeSheet === 'pf')
        + accountNav(v.savingAccountNavItems)
        + '</div>')

      + '<div class="nav-section" data-act="toggleSpendingNav">' + chevron(v.spendingNavOpen, 'chev-spending') + 'Spending</div>'
      + when(v.spendingNavOpen, '<div class="nav-group">'
        + accountNav(v.spendingAccountNavItems)
        + when(v.spendingAccountNavItems.length === 0, '<div class="nav-empty">No spending accounts yet</div>')
        + '</div>')

      + '<div class="nav-section" data-act="toggleAccountSettings">' + chevron(v.accountSettingsOpen, 'chev-settings') + 'Settings</div>'
      + when(v.accountSettingsOpen, '<div class="nav-group">'
        + navItem('Accounts', 'goAccounts', v.activeSheet === 'accounts')
        + navItem('Transaction Types', 'goTypes', v.activeSheet === 'types')
        + navItem('Tags', 'goTags', v.activeSheet === 'tags')
        + '</div>')

      + '<div class="nav-spacer"></div>'
      + '<div class="sb-about">' + navItem('About', 'goAbout', v.activeSheet === 'about') + '</div>'
      + '<div class="sb-conn">'
      + (v.connected
        ? '<div class="sb-status">Connected</div>'
          + '<button class="sb-btn" data-act="refreshFromSheet">Refresh from Sheet</button>'
          + '<a class="sb-btn" href="' + esc(v.spreadsheetUrl) + '" target="_blank">Open Spreadsheet</a>'
          + '<button class="sb-btn" data-act="openSettings">Connection settings</button>'
        : '<button class="sb-btn" data-act="openSettings">Connection settings</button>')
      + '</div>';
  }

  function viewSettings(v) {
    return '<div class="settings">'
      + '<h2 class="page-title page-title--tight">Connect to Google Sheets</h2>'
      + '<p class="settings-p">This page talks to Google Sheets directly with your Google sign-in — no deployed script to maintain. One-time setup in <a href="https://console.cloud.google.com/apis/credentials" target="_blank">Google Cloud Console</a>:</p>'
      + '<ol class="settings-ol">'
      + '<li>Create a project (or pick one), then enable the <strong>Google Sheets API</strong>.</li>'
      + '<li>Credentials → Create Credentials → <strong>OAuth client ID</strong>, type <strong>Web application</strong>.</li>'
      + '<li>Under <strong>Authorized JavaScript origins</strong>, add this page\'s origin (the URL up to the domain, no path).</li>'
      + '<li>Copy the generated <strong>Client ID</strong> and paste it below, along with your spreadsheet\'s ID (from its URL).</li>'
      + '</ol>'
      + '<label class="lbl">Google OAuth Client ID</label>'
      + '<input class="input mb-14" data-f="clientId" value="' + esc(v.clientIdInput) + '" placeholder="xxxxxxxxxxxx.apps.googleusercontent.com">'
      + '<label class="lbl">Spreadsheet ID</label>'
      + '<input class="input mb-18" data-f="spreadsheetId" value="' + esc(v.spreadsheetIdInput) + '">'
      + '<div class="settings-actions">'
      + '<button class="btn-connect" data-act="saveAndConnect">' + esc(v.connectLabel) + '</button>'
      + when(v.hasSavedConfig, '<button class="btn-connect-ghost" data-act="closeSettings">Cancel</button>')
      + '</div>'
      + '</div>';
  }

  function viewDashboard(v) {
    var maturity = when(v.hasMaturityWatch,
      '<div class="sec-maturity" data-act="toggleDashMaturity">' + chevron(state.dashMaturityOpen) + '⚠ Maturity &amp; Liquidity Watch</div>'
      + when(state.dashMaturityOpen, '<div class="maturity-panel"><table class="table">'
        + v.maturityWatchRows.map(function (r) {
          return '<tr class="mw-row">'
            + '<td class="td">' + esc(r.product) + '</td>'
            + '<td class="td sm">' + esc(r.maturityDate) + '</td>'
            + '<td class="td mw-flag ' + r.flagClass + '">' + esc(r.flagText) + '</td>'
            + '<td class="td num">' + esc(r.maturityEgpDisplay) + '</td>'
            + '</tr>';
        }).join('')
        + '</table></div>'));

    var currency = '<div class="sec-currency" data-act="toggleDashCurrency">' + chevron(state.dashCurrencyOpen) + 'Savings by currency</div>'
      + when(state.dashCurrencyOpen,
        '<div class="savings-banner">'
        + '<div>'
        + '<div class="savings-banner-label">Total savings · EGP equivalent</div>'
        + '<div class="savings-banner-sub">Owned assets only — unvested stock is not counted</div>'
        + '</div>'
        + '<div class="savings-banner-value">' + esc(v.totalSavingsEgpDisplay) + '</div>'
        + '</div>'
        + '<div class="cc-grid">'
        + v.currencyCards.map(function (cc) {
          return '<div class="cc ' + cc.cls + '">'
            + '<div class="cc-head"><span class="cc-code">' + esc(cc.code) + '</span><span class="cc-equiv">≈ ' + esc(cc.equivDisplay) + '</span></div>'
            + '<div class="cc-native">' + esc(cc.nativeDisplay) + '</div>'
            + '<table class="table">'
            + cc.items.map(function (it) {
              return '<tr class="cc-row"><td class="cc-td">' + esc(it.label) + '</td><td class="cc-td num">' + esc(it.amt) + '</td></tr>';
            }).join('')
            + '</table></div>';
        }).join('')
        + '</div>');

    function ownerGroupCards(groups) {
      return groups.map(function (g) {
        return '<div class="group-card">'
          + '<div class="group-title">' + esc(g.owner) + '</div>'
          + '<div class="group-stats">'
          + '<div class="stat-sm c-fuchsia"><div class="stat-label">As of</div><div class="stat-value-sm">' + esc(g.lastDateDisplay) + '</div></div>'
          + '<div class="stat-sm c-purple"><div class="stat-label">Total balance</div><div class="stat-value-sm">' + esc(g.subtotalDisplay) + '</div></div>'
          + '</div>'
          + '<table class="table">'
          + g.rows.map(function (r) {
            return '<tr class="row"><td class="td-lg">' + esc(r.name) + '</td><td class="td-lg num">' + esc(r.balanceDisplay) + '</td></tr>';
          }).join('')
          + '</table></div>';
      }).join('');
    }

    var spending = '<div class="sec-spending" data-act="toggleDashSpending">' + chevron(state.dashSpendingOpen) + 'Spending</div>'
      + when(state.dashSpendingOpen,
        '<div class="group-grid">' + ownerGroupCards(v.spendingGroups) + '</div>'
        + when(!v.hasSpendingAccounts, '<div class="empty-note">No spending accounts yet — tag an account "Spending" in Accounts.</div>'));

    var school = '<div class="sec-sub" data-act="toggleDashSchool">' + chevron(state.dashSchoolOpen) + 'School</div>'
      + when(state.dashSchoolOpen,
        '<div class="group-grid">'
        + v.schoolAccountRows.map(function (r) {
          return '<div class="school-card"><div class="stat-label">' + esc(r.name) + '</div><div class="school-value">' + esc(r.balanceDisplay) + '</div></div>';
        }).join('')
        + '</div>'
        + when(!v.hasSchoolAccounts, '<div class="empty-note">No accounts tagged "Saving &gt; School" yet.</div>'));

    var other = '<div class="sec-sub sec-sub--spaced" data-act="toggleDashOther">' + chevron(state.dashOtherOpen) + 'Other (Stocks, Gold, Certificates &amp; parked cash)</div>'
      + when(state.dashOtherOpen,
        '<div class="group-grid">'
        + when(v.hasCerts, '<div class="wide-card"><div class="group-title">Certificates</div><div class="stat-row">'
          + '<div class="stat-sm c-blue"><div class="stat-label">Current EGP value</div><div class="stat-value-sm">' + esc(v.certTotalCurrentDisplay) + '</div></div>'
          + '<div class="stat-sm c-purple"><div class="stat-label">At maturity</div><div class="stat-value-sm">' + esc(v.certTotalMaturityDisplay) + '</div></div>'
          + '<div class="stat-sm ' + v.certGainCardClass + '"><div class="stat-label">Gain vs principal</div><div class="stat-value-sm">' + esc(v.certGainDisplay) + ' (' + esc(v.certGainPctDisplay) + ')</div></div>'
          + '</div></div>')
        + '</div>'
        + '<div class="group-grid">'
        + when(v.hasGold, '<div class="wide-card"><div class="group-title">Gold</div><div class="stat-row">'
          + '<div class="stat-sm c-amber"><div class="stat-label">Current value</div><div class="stat-value-sm">' + esc(v.goldTotalCurrentDisplay) + '</div></div>'
          + '<div class="stat-sm c-purple"><div class="stat-label">Grams held</div><div class="stat-value-sm">' + esc(v.goldTotalGramsDisplay) + '</div></div>'
          + '<div class="stat-sm ' + v.goldGainCardClass + '"><div class="stat-label">Gain vs cost</div><div class="stat-value-sm">' + esc(v.goldGainDisplay) + '</div></div>'
          + '</div></div>')
        + '</div>'
        + '<div class="group-grid">'
        + when(v.hasStocks, '<div class="wide-card"><div class="group-title">Stocks (' + esc(v.stockSymbol) + ')</div><div class="stat-row">'
          + '<div class="stat-sm c-teal"><div class="stat-label">Sellable now</div><div class="stat-value-sm">' + esc(v.sellableNowDisplay) + '</div></div>'
          + '<div class="stat-sm c-slate"><div class="stat-label">🔒 Vesting later</div><div class="stat-value-sm">' + esc(v.unvestedTotalDisplay) + '</div></div>'
          + '<div class="stat-sm c-green"><div class="stat-label">Gain if sold now</div><div class="stat-value-sm ' + v.stockNowGainClass + '">' + esc(v.stockNowGainDisplay) + ' (' + esc(v.stockNowGainPctDisplay) + ')</div></div>'
          + '</div></div>')
        + '</div>'
        + '<div class="group-grid">' + ownerGroupCards(v.otherSavingGroups) + '</div>');

    var saving = '<div class="sec-saving" data-act="toggleDashSaving">' + chevron(state.dashSavingOpen) + 'Saving</div>'
      + when(state.dashSavingOpen, school + other);

    var recent = '<div class="sec-recent" data-act="toggleRecentTx">' + chevron(state.recentTxOpen) + 'Recent transactions</div>'
      + when(state.recentTxOpen, '<table class="table"><thead><tr>'
        + '<th class="th">Date</th><th class="th">Description</th><th class="th">From → To</th><th class="th right">Amount</th>'
        + '</tr></thead>'
        + v.recentTransactions.map(function (t) {
          return '<tr class="row">'
            + '<td class="td">' + esc(t.date) + '</td>'
            + '<td class="td">' + esc(t.description) + '</td>'
            + '<td class="td link">' + esc(t.fromTo) + '</td>'
            + '<td class="td num">' + esc(t.amountDisplay) + '</td>'
            + '</tr>';
        }).join('')
        + '</table>');

    return '<h2 class="page-title">Dashboard</h2>' + maturity + currency + spending + saving + recent;
  }

  function viewAccounts(v) {
    return '<h2 class="page-title">Accounts</h2>'
      + '<div class="form-panel">'
      + '<div class="field"><label class="lbl">Account Name</label>'
      + '<input class="input input--form" data-f="acctName" value="' + esc(state.acctForm.name) + '"></div>'
      + '<div class="field"><label class="lbl">Owner</label>'
      + '<input class="input input--form" data-f="acctOwner" value="' + esc(state.acctForm.owner) + '"></div>'
      + '<div class="field"><label class="lbl">Tag</label>'
      + '<select class="input input--form" data-f="acctTag">' + options(v.tagOptions, state.acctForm.tag || TAG_SPENDING) + '</select></div>'
      + '<button class="btn-p" data-act="submitAccountForm">' + (state.acctForm.mode === 'edit' ? 'Save changes' : 'Add account') + '</button>'
      + when(state.acctForm.mode === 'edit', '<button class="btn-ghost" data-act="cancelAccountForm">Cancel</button>')
      + '</div>'
      + '<table class="table">'
      + v.accountRows.map(function (r) {
        return '<tr class="row">'
          + '<td class="td-lg">' + esc(r.name) + '</td>'
          + '<td class="td-lg muted">' + esc(r.owner) + '</td>'
          + '<td class="td-lg sm">' + esc(r.tagDisplay) + '</td>'
          + rowActions('editAccount', 'deleteAccount', r.index, 'td-lg')
          + '</tr>';
      }).join('')
      + '</table>';
  }

  function viewTypes(v) {
    return '<h2 class="page-title">Transaction Types</h2>'
      + '<div class="form-panel">'
      + '<div class="field"><label class="lbl">Transaction Type</label>'
      + '<input class="input input--form" data-f="typeName" value="' + esc(state.typeForm.name) + '"></div>'
      + '<button class="btn-p" data-act="submitTypeForm">' + (state.typeForm.mode === 'edit' ? 'Save changes' : 'Add type') + '</button>'
      + when(state.typeForm.mode === 'edit', '<button class="btn-ghost" data-act="cancelTypeForm">Cancel</button>')
      + '</div>'
      + '<table class="table">'
      + v.typeRows.map(function (r) {
        return '<tr class="row"><td class="td-lg">' + esc(r.name) + '</td>'
          + rowActions('editType', 'deleteType', r.index, 'td-lg') + '</tr>';
      }).join('')
      + '</table>';
  }

  function viewTags(v) {
    return '<h2 class="page-title page-title--tight">Tags</h2>'
      + '<p class="hint">Tags available for Accounts, Gold, and Certificates. Use "Saving &gt; " prefix for savings sub-tags.</p>'
      + '<div class="form-panel">'
      + '<div class="field"><label class="lbl">Tag</label>'
      + '<input class="input input--form" data-f="tagName" value="' + esc(state.tagForm.name) + '" placeholder="Saving > Travel"></div>'
      + '<button class="btn-p" data-act="submitTagForm">' + (state.tagForm.mode === 'edit' ? 'Save changes' : 'Add tag') + '</button>'
      + when(state.tagForm.mode === 'edit', '<button class="btn-ghost" data-act="cancelTagForm">Cancel</button>')
      + '</div>'
      + '<table class="table">'
      + v.tagRows.map(function (r) {
        return '<tr class="row"><td class="td-lg">' + esc(r.name) + '</td>'
          + rowActions('editTag', 'deleteTag', r.index, 'td-lg') + '</tr>';
      }).join('')
      + '</table>';
  }

  function viewAboutContent() {
    return '<p class="about-intro">Every rule this tracker uses to organize and calculate your money, in one place.</p>'
      + '<div class="about-list">'

      + '<div><div class="about-h">How everything is organized</div>'
      + '<p class="about-p">Every account, gold lot, and certificate carries exactly one tag:</p>'
      + '<ul class="about-ul">'
      + '<li><strong>Spending</strong> — day-to-day accounts you spend from.</li>'
      + '<li><strong>Saving &gt; School</strong> — cash set aside for school.</li>'
      + '<li><strong>Saving &gt; Other</strong> — everything else parked, not spent: Gold, Certificates, and any other savings cash.</li>'
      + '</ul>'
      + '<p class="about-note">Untagged items default to Spending (accounts) or Saving &gt; Other (gold/certificates) so nothing old goes missing.</p></div>'

      + '<div><div class="about-h">Accounts &amp; Ledgers</div>'
      + '<ul class="about-ul">'
      + '<li>Each account\'s ledger (its running list of in/out amounts) is generated automatically from Transactions — you never edit a ledger directly.</li>'
      + '<li>Balance = the running sum of every signed transaction touching that account, oldest to newest.</li>'
      + '<li>Accounts are grouped by Owner on the Dashboard; accounts with no owner set show under "Unassigned".</li>'
      + '</ul></div>'

      + '<div><div class="about-h">How a transaction affects balances</div>'
      + '<ul class="about-ul">'
      + '<li>From + To set: the amount leaves the From account (–) and lands in the To account (+).</li>'
      + '<li>From only, no To: the amount is applied as-is to that account. Used for "Starting Balance" and "Plug" transaction types, the only two types that don\'t require a To Account.</li>'
      + '</ul></div>'

      + '<div><div class="about-h">Gold</div>'
      + '<ul class="about-ul">'
      + '<li>Each lot\'s grams = Quantity × Weight (gm).</li>'
      + '<li>Cost = grams × purchase price per gram. Current value = grams × current price per gram.</li>'
      + '<li>Gain = current value − cost.</li>'
      + '<li>"Update price for all lots" overwrites the current price/gm and as-of date on every lot at once — gold is priced as one market, not per-lot.</li>'
      + '</ul></div>'

      + '<div><div class="about-h">Certificates</div>'
      + '<ul class="about-ul">'
      + '<li>Amount at maturity = Amount × (1 + Interest Rate) — a flat rate applied once, matching how the bank statement shows it (not compounded per period).</li>'
      + '<li>EGP figures use each certificate\'s Currency converted through the shared Currency Rates table below.</li>'
      + '<li>Gain vs principal compares EGP-now to EGP-at-maturity across all certificates combined.</li>'
      + '<li><strong>Maturity Watch</strong> flags any certificate maturing within 60 days, or already matured, on the Dashboard.</li>'
      + '</ul></div>'

      + '<div><div class="about-h">Currency rates</div>'
      + '<ul class="about-ul">'
      + '<li>One rate per currency (to EGP), shared across every certificate in that currency.</li>'
      + '<li>Setting a new rate immediately recalculates every EGP figure that depends on it — old rates are overwritten, not kept as history.</li>'
      + '</ul></div>'

      + '<div><div class="about-h">Sync with Google Sheets</div>'
      + '<ul class="about-ul">'
      + '<li>This app runs entirely in your browser and talks to the Google Sheets API directly, with your connected Sheet as the only storage — no server, no deployment.</li>'
      + '<li>Sign-in uses Google\'s own OAuth popup (not an embedded frame), so it works reliably straight from GitHub Pages. Every add/edit/delete writes straight to the Sheet through that authorized session.</li>'
      + '<li>"Refresh from Sheet" re-pulls everything, useful if the Sheet was edited by hand.</li>'
      + '<li>Transactions and CSV exports (Transactions page, and any ledger page) are available any time.</li>'
      + '</ul></div>'

      + '</div>';
  }

  function viewPlanTab(v) {
    var f = state.planForm;
    return '<p class="hint">The roadmap: get everything into one place, then analyze, then automate.</p>'
      + '<div class="form-grid plan-form">'
      + field('Step', selectInput('planStep', optionPairs([['1', '1 — Consolidate'], ['2', '2 — Analyze'], ['3', '3 — Automate']], f.step)))
      + field('Item', textInput('planItem', f.item))
      + field('Status', selectInput('planStatus', options(['Not started', 'In progress', 'Done'], f.status)))
      + field('Notes', textInput('planNotes', f.notes))
      + field('Version', textInput('planVersion', f.version, ' placeholder="v1"'))
      + submitPair('submitPlanForm', 'cancelPlanForm', f.mode === 'edit' ? 'Save changes' : 'Add item', f.mode === 'edit')
      + '</div>'
      + v.planStepGroups.map(function (g) {
        return '<div class="plan-group">'
          + '<div class="plan-group-title">' + esc(g.label) + '</div>'
          + '<table class="table">'
          + g.items.map(function (r) {
            return '<tr class="row">'
              + '<td class="td-lg">' + esc(r.item) + '</td>'
              + '<td class="td-lg sm">' + esc(r.notes) + '</td>'
              + '<td class="td-lg act"><span class="pill ' + r.versionClass + '">' + esc(r.versionDisplay) + '</span></td>'
              + '<td class="td-lg act"><span class="pill ' + r.statusClass + '">' + esc(r.status) + '</span></td>'
              + rowActions('editPlan', 'deletePlan', r.index, 'td-lg')
              + '</tr>';
          }).join('')
          + when(g.empty, '<tr><td class="empty-cell" colspan="5">Nothing here yet</td></tr>')
          + '</table></div>';
      }).join('');
  }

  function viewAbout(v) {
    var isPlan = state.aboutTab === 'plan';
    return '<h2 class="page-title page-title--mid">About</h2>'
      + '<div class="tabs">'
      + '<div class="' + cls('tab', !isPlan ? 'active' : '') + '" data-act="aboutTabAbout">About</div>'
      + '<div class="' + cls('tab', isPlan ? 'active' : '') + '" data-act="aboutTabPlan">Plan</div>'
      + '</div>'
      + (isPlan ? viewPlanTab(v) : viewAboutContent());
  }

  function viewTransactions(v) {
    var f = state.txForm;
    var manage = state.txTab === 'manage';
    var toRequired = toFieldRequired(f.type);

    var form = when(manage, '<div class="form-grid tx-form">'
      + field('Type', selectInput('txType', '<option value="">—</option>' + options(v.types, f.type)))
      + field('Date', dateInput('txDate', f.date))
      + field('Amount', numInput('txAmount', f.amount, ' placeholder="-0.00"'))
      + field('Description', textInput('txDescription', f.description))
      + field('From Account', selectInput('txFrom', '<option value="">—</option>' + options(v.accounts, f.from)))
      + '<div class="' + (toRequired ? '' : 'disabled-field') + '"><label class="lbl sm">To Account</label>'
      + selectInput('txTo', '<option value="">—</option>' + options(v.accounts, f.to), toRequired ? '' : ' disabled')
      + '</div>'
      + submitPair('submitTxForm', 'cancelTxForm', f.mode === 'edit' ? 'Save changes' : 'Add transaction', f.mode === 'edit')
      + '</div>');

    return '<div class="page-head"><h2 class="page-title page-title--flush">Transactions</h2>'
      + '<button class="btn-export" data-act="exportTransactionsCsv">Export CSV</button></div>'
      + '<div class="tabs">'
      + '<div class="' + cls('tab', !manage ? 'active' : '') + '" data-act="txTabOverview">Overview</div>'
      + '<div class="' + cls('tab', manage ? 'active' : '') + '" data-act="txTabManage">Manage</div>'
      + '</div>'
      + form
      + '<input class="search-input" data-f="search" value="' + esc(state.search) + '" placeholder="Search transactions…">'
      + '<table class="table"><thead><tr>'
      + '<th class="th sortable" data-act="sortByDate">Date' + esc(v.dateSortArrow) + '</th>'
      + '<th class="th">Description</th><th class="th">Type</th><th class="th">From</th><th class="th">To</th>'
      + '<th class="th right sortable" data-act="sortByAmount">Amount' + esc(v.amountSortArrow) + '</th>'
      + when(manage, '<th class="th"></th>')
      + '</tr></thead>'
      + v.transactionRows.map(function (r) {
        return '<tr class="row">'
          + '<td class="td">' + esc(r.date) + '</td>'
          + '<td class="td">' + esc(r.description) + '</td>'
          + '<td class="td muted">' + esc(r.type) + '</td>'
          + '<td class="td">' + esc(r.from) + '</td>'
          + '<td class="td">' + esc(r.to) + '</td>'
          + '<td class="td num">' + esc(r.amountDisplay) + '</td>'
          + when(manage, rowActions('editTx', 'deleteTx', r.index, 'td'))
          + '</tr>';
      }).join('')
      + '</table>';
  }

  function viewGold(v) {
    var f = state.goldForm;
    var manage = state.goldTab === 'manage';

    var overview = when(!manage, '<div class="stat-grid">'
      + '<div class="stat c-amber"><div class="stat-label">Current value</div><div class="stat-value">' + esc(v.goldTotalCurrentDisplay) + '</div></div>'
      + '<div class="stat c-blue"><div class="stat-label">Cost basis</div><div class="stat-value">' + esc(v.goldTotalPurchaseDisplay) + '</div></div>'
      + '<div class="stat c-purple"><div class="stat-label">Grams held</div><div class="stat-value">' + esc(v.goldTotalGramsDisplay) + '</div></div>'
      + '<div class="stat ' + v.goldGainCardClass + '"><div class="stat-label">Gain vs cost</div>'
      + '<div class="stat-value">' + esc(v.goldGainDisplay) + ' (' + esc(v.goldGainPctDisplay) + ')</div></div>'
      + '</div>');

    var manageForms = when(manage,
      '<p class="hint">Holdings, not transactions — a purchase\'s cash outflow is recorded separately on the Transactions page.</p>'
      + '<div class="panel">'
      + '<div class="grid gold-form-a">'
      + field('Quantity', numInput('goldQuantity', f.quantity))
      + field('Type', textInput('goldType', f.type, ' placeholder="Gold 24"'))
      + field('Brand', textInput('goldBrand', f.brand))
      + field('Weight (gm)', numInput('goldWeight', f.weight))
      + field('Where', textInput('goldWhere', f.where))
      + '</div>'
      + '<div class="grid gold-form-b">'
      + field('Purchase Price/gm (EGP)', numInput('goldPurchasePrice', f.purchasePrice))
      + field('Purchase Date', dateInput('goldPurchaseDate', f.purchaseDate))
      + field('Tag', selectInput('goldTag', options(v.tagOptions, f.tag || TAG_SAVING_OTHER)))
      + submitPair('submitGoldForm', 'cancelGoldForm', f.mode === 'edit' ? 'Save changes' : 'Add lot', f.mode === 'edit')
      + '</div>'
      + '</div>'
      + '<div class="form-grid gold-price-form">'
      + field('Current Price/gm (EGP) — updates all lots', numInput('goldPriceCurrent', state.goldPriceForm.currentPrice))
      + field('As Of', dateInput('goldPriceAsOf', state.goldPriceForm.asOf))
      + '<button class="btn-p btn-p--tight btn-p--gold" data-act="applyGoldPriceUpdate">Update price for all lots</button>'
      + '</div>');

    return '<h2 class="page-title page-title--mid">Gold</h2>'
      + '<div class="tabs">'
      + '<div class="' + cls('tab', !manage ? 'active' : '') + '" data-act="goldTabOverview">Overview</div>'
      + '<div class="' + cls('tab', manage ? 'active' : '') + '" data-act="goldTabManage">Manage</div>'
      + '</div>'
      + overview + manageForms
      + '<table class="table"><thead><tr>'
      + '<th class="th">Qty</th><th class="th">Type</th><th class="th">Brand</th>'
      + '<th class="th right">Weight (gm)</th><th class="th">Where</th><th class="th">Tag</th>'
      + '<th class="th">Purchased</th><th class="th right">Cost</th><th class="th right">Value now</th>'
      + '<th class="th right">Gain</th>'
      + when(manage, '<th class="th"></th>')
      + '</tr></thead>'
      + v.goldRows.map(function (r) {
        return '<tr class="row">'
          + '<td class="td">' + esc(r.quantity) + '</td>'
          + '<td class="td">' + esc(r.type) + '</td>'
          + '<td class="td muted">' + esc(r.brand) + '</td>'
          + '<td class="td num">' + esc(r.weightDisplay) + '</td>'
          + '<td class="td muted">' + esc(r.where) + '</td>'
          + '<td class="td sm">' + esc(r.tagDisplay) + '</td>'
          + '<td class="td">' + esc(r.purchaseDate) + '</td>'
          + '<td class="td num">' + esc(r.costDisplay) + '</td>'
          + '<td class="td num">' + esc(r.valueDisplay) + '</td>'
          + '<td class="td num ' + r.gainClass + '">' + esc(r.gainDisplay) + '</td>'
          + when(manage, rowActions('editGold', 'deleteGold', r.index, 'td'))
          + '</tr>';
      }).join('')
      + when(v.goldEmpty, '<tr><td class="empty-cell" colspan="11">No gold holdings yet</td></tr>')
      + '</table>';
  }

  function viewCerts(v) {
    var f = state.certForm;
    var manage = state.certsTab === 'manage';

    var overview = when(!manage, '<div class="stat-grid mb-20">'
      + '<div class="stat c-blue"><div class="stat-label">Current EGP value</div><div class="stat-value">' + esc(v.certTotalCurrentDisplay) + '</div></div>'
      + '<div class="stat c-purple"><div class="stat-label">At maturity (EGP)</div><div class="stat-value">' + esc(v.certTotalMaturityDisplay) + '</div></div>'
      + '<div class="stat ' + v.certGainCardClass + '"><div class="stat-label">Gain vs principal</div>'
      + '<div class="stat-value">' + esc(v.certGainDisplay) + ' (' + esc(v.certGainPctDisplay) + ')</div></div>'
      + '</div>');

    var manageForms = when(manage,
      '<p class="hint">Holdings, not transactions. Amount at Maturity uses a flat rate applied once (matches your bank statement); EGP figures use the currency rate set below.</p>'
      + '<div class="rate-panel">'
      + '<div class="rate-panel-title">Currency rates (to EGP) — shared across all certificates</div>'
      + '<div class="rate-chips">'
      + v.rateRows.map(function (r) {
        return '<div class="rate-chip"><strong>' + esc(r.currency) + '</strong> = ' + esc(r.rateDisplay)
          + ' EGP <span class="rate-asof">(as of ' + esc(r.asOf) + ')</span></div>';
      }).join('')
      + '</div>'
      + '<div class="rate-form">'
      + field('Currency', textInput('rateCurrency', state.rateForm.currency, ' placeholder="USD"'))
      + field('Rate to EGP', numInput('rateValue', state.rateForm.rate))
      + field('As Of', dateInput('rateAsOf', state.rateForm.asOf))
      + '<button class="btn-p btn-p--tight btn-p--blue" data-act="applyRateUpdate">Set rate</button>'
      + '</div>'
      + '</div>'
      + '<div class="panel">'
      + '<div class="grid cert-form-a">'
      + field('Certificate Number', textInput('certNumber', f.number))
      + field('Product Name', textInput('certProduct', f.product))
      + field('Open Date', dateInput('certOpenDate', f.openDate))
      + field('Amount', numInput('certAmount', f.amount))
      + '</div>'
      + '<div class="grid cert-form-b">'
      + field('Currency', textInput('certCurrency', f.currency, ' placeholder="EGP"'))
      + field('Interest Frequency', textInput('certFrequency', f.frequency, ' placeholder="1 Year"'))
      + field('Interest Rate (%)', numInput('certRate', f.rate, ' placeholder="7"'))
      + field('Tag', selectInput('certTag', options(v.tagOptions, f.tag || TAG_SAVING_OTHER)))
      + submitPair('submitCertForm', 'cancelCertForm', f.mode === 'edit' ? 'Save changes' : 'Add certificate', f.mode === 'edit')
      + '</div>'
      + '</div>'
      + '<div class="mb-14"><label class="lbl sm">Maturity Date</label>'
      + '<input class="input-sm auto" type="date" data-f="certMaturityDate" value="' + esc(f.maturityDate) + '"></div>');

    var groups = v.certGroups.map(function (g) {
      return '<div class="grp">'
        + '<div class="grp-head" data-act="toggleCertGroup" data-k="' + esc(g.currency) + '">'
        + chevron(g.isOpen) + esc(g.currency) + '</div>'
        + when(g.isOpen, '<table class="table"><thead><tr>'
          + '<th class="th">Product</th><th class="th">Number</th><th class="th">Tag</th>'
          + '<th class="th right">Amount</th><th class="th">Rate</th><th class="th">Maturity</th>'
          + '<th class="th right">EGP now</th><th class="th right">EGP at maturity</th>'
          + when(manage, '<th class="th"></th>')
          + '</tr></thead>'
          + g.rows.map(function (r) {
            return '<tr class="row">'
              + '<td class="td">' + esc(r.product) + '</td>'
              + '<td class="td sm">' + esc(r.number) + '</td>'
              + '<td class="td sm">' + esc(r.tagDisplay) + '</td>'
              + '<td class="td num">' + esc(r.amountDisplay) + '</td>'
              + '<td class="td">' + esc(r.rateDisplay) + '</td>'
              + '<td class="td sm"><div>' + esc(r.maturityDate) + '</div>'
              + '<div class="flag ' + r.flagClass + '">' + esc(r.flagText) + '</div></td>'
              + '<td class="td num">' + esc(r.egpNowDisplay) + '</td>'
              + '<td class="td num">' + esc(r.egpMaturityDisplay) + '</td>'
              + when(manage, rowActions('editCert', 'deleteCert', r.index, 'td'))
              + '</tr>';
          }).join('')
          + '</table>')
        + '</div>';
    }).join('');

    return '<h2 class="page-title page-title--mid">Certificates</h2>'
      + '<div class="tabs">'
      + '<div class="' + cls('tab', !manage ? 'active' : '') + '" data-act="certsTabOverview">Overview</div>'
      + '<div class="' + cls('tab', manage ? 'active' : '') + '" data-act="certsTabManage">Manage</div>'
      + '</div>'
      + overview + manageForms + groups
      + when(v.certEmpty, '<div class="empty-cell">No certificates yet</div>');
  }

  function viewStocks(v) {
    var manage = state.stockTab === 'manage';

    var overview = when(!manage,
      '<div class="stock-meta">' + esc(v.stockSymbol) + ' · <strong>$' + esc(v.stockPriceDisplay) + '</strong> / share · as of ' + esc(v.stockAsOfDisplay) + '</div>'
      + '<div class="stock-cards">'
      + '<div class="stock-card stock-card--now">'
      + '<div class="stock-card-head"><span class="stock-dot"></span><span class="stock-card-title">Mine now · can sell today</span></div>'
      + '<div class="stock-card-value">' + esc(v.sellableNowDisplay) + '</div>'
      + '<div class="stock-card-sub">' + esc(v.heldSharesDisplay) + ' · gain <span class="' + v.stockNowGainClass + '">'
      + esc(v.stockNowGainDisplay) + ' (' + esc(v.stockNowGainPctDisplay) + ')</span></div>'
      + '<div class="stock-lines">'
      + '<div class="stock-line"><span class="stock-line-label">Vested RSU · ' + esc(v.rsuNowQtyDisplay) + '</span><span class="stock-line-value">' + esc(v.rsuNowValueDisplay) + '</span></div>'
      + '<div class="stock-line"><span class="stock-line-label">ESPP · ' + esc(v.esppNowQtyDisplay) + '</span><span class="stock-line-value">' + esc(v.esppNowValueDisplay) + '</span></div>'
      + '<div class="stock-line"><span class="stock-line-label">+ Cash</span><span class="stock-line-value">' + esc(v.stockCashDisplay) + '</span></div>'
      + '</div></div>'
      + '<div class="stock-card stock-card--later">'
      + '<div class="stock-card-head"><span class="stock-lock">🔒</span><span class="stock-card-title">Coming later · if I stay</span></div>'
      + '<div class="stock-card-value">' + esc(v.unvestedTotalDisplay) + '</div>'
      + '<div class="stock-card-sub">' + esc(v.unvestedUnitsDisplay) + ' unvested</div>'
      + '<div class="stock-lines">'
      + v.vestingByYear.map(function (vy) {
        return '<div class="stock-line"><span class="stock-line-label">Vests ' + esc(vy.label) + '</span>'
          + '<span class="stock-line-value">' + esc(vy.valueDisplay) + '</span></div>';
      }).join('')
      + '</div></div>'
      + '</div>'
      + (v.hasEspp
        ? '<div class="espp-note"><div class="espp-note-title">ESPP discount earned — if you sold today</div>'
          + '<div class="espp-note-row">'
          + '<span class="espp-gain ' + v.esppGainClass + '">' + esc(v.esppGainDisplay) + '</span>'
          + '<span class="espp-pct ' + v.esppGainClass + '">' + esc(v.esppGainPctDisplay) + '</span>'
          + '<span class="espp-detail">' + esc(v.esppNowValueDisplay) + ' value − ' + esc(v.esppPaidDisplay) + ' paid</span>'
          + '</div></div>'
        : '<div class="espp-empty"><div class="espp-empty-text">You currently hold <strong>no ESPP shares</strong> — past ESPP purchases were sold. Everything sellable today is vested RSU. Add an ESPP lot in <strong>Manage</strong> if you still hold some.</div></div>')
      + '<div class="whatif">'
      + '<div class="whatif-head"><span class="whatif-title">What if TDC trades at…</span>'
      + '<span class="whatif-price" id="scenario-price">$' + esc(v.stockScenarioPriceDisplay) + '</span></div>'
      + '<div class="slider-wrap">'
      + '<div class="slider-track"></div>'
      + '<div class="slider-fill" id="scenario-fill" style="width:' + v.scenarioFillPct + '%"></div>'
      + '<input class="slider-input" type="range" min="' + v.scenarioSliderMin + '" max="' + v.scenarioSliderMax + '" step="1"'
      + ' data-f="stockScenario" value="' + esc(v.stockScenarioValue) + '">'
      + '</div>'
      + '<div class="slider-scale"><span>$' + v.scenarioSliderMin + '</span><span>$' + v.scenarioSliderMax + '</span></div>'
      + '<div class="whatif-cards">'
      + '<div class="whatif-card"><div class="whatif-label">Sellable today would be</div>'
      + '<div class="whatif-value teal" id="scenario-sellable">' + esc(v.scenarioSellableDisplay) + '</div></div>'
      + '<div class="whatif-card"><div class="whatif-label">Unvested would be</div>'
      + '<div class="whatif-value slate" id="scenario-unvested">' + esc(v.scenarioUnvestedDisplay) + '</div></div>'
      + '</div></div>');

    var hf = state.holdingForm;
    var vf = state.vestingForm;
    var pf = state.stockPriceForm;

    var manageBody = when(manage,
      '<div class="panel-solid">'
      + '<div class="panel-title">Stock price &amp; cash</div>'
      + '<div class="stock-price-form">'
      + field('Symbol', textInput('stockSymbol', pf.symbol, ' placeholder="' + esc(v.stockSymbol) + '"'))
      + field('Current Price (USD)', numInput('stockPrice', pf.currentPrice, ' placeholder="' + esc(v.stockPriceDisplay) + '"'))
      + field('Cash (USD)', numInput('stockCash', pf.cash, ' placeholder="' + esc(v.stockCashDisplay) + '"'))
      + field('As Of', dateInput('stockAsOf', pf.asOf))
      + '<button class="btn-p btn-p--tight btn-p--teal" data-act="applyStockPriceUpdate">Update price</button>'
      + '</div>'
      + '<div class="panel-note">Updating the price recomputes every holding value, vesting value and the what-if slider at once.</div>'
      + '</div>'

      + '<div class="subhead">Holdings you can sell now</div>'
      + '<p class="subhint">Vested RSU and ESPP shares sitting in your brokerage. Value = Quantity × current price; gain = value − cost basis.</p>'
      + '<div class="form-grid holding-form">'
      + field('Source', selectInput('holdingSource', options(['Vested RSU', 'ESPP'], hf.source), '', 'white'))
      + field('Label', textInput('holdingLabel', hf.label, ' placeholder="RSU vest Mar 2026"'))
      + field('Quantity', numInput('holdingQuantity', hf.quantity))
      + field('Cost Basis (USD)', numInput('holdingCost', hf.cost))
      + field('Acquired', dateInput('holdingAcquired', hf.acquired))
      + submitPair('submitHoldingForm', 'cancelHoldingForm', hf.mode === 'edit' ? 'Save changes' : 'Add lot', hf.mode === 'edit', 'btn-row btn-row--sm')
      + '</div>'
      + '<table class="table mb-32"><thead><tr>'
      + '<th class="th wide">Source</th><th class="th wide">Label</th><th class="th wide right">Quantity</th>'
      + '<th class="th wide right">Cost basis</th><th class="th wide right">Value now</th>'
      + '<th class="th wide right">Gain</th><th class="th wide right"></th>'
      + '</tr></thead>'
      + v.holdingRows.map(function (r) {
        return '<tr class="row">'
          + '<td class="td-x"><span class="pill-source ' + r.sourceClass + '">' + esc(r.source) + '</span></td>'
          + '<td class="td-x">' + esc(r.label) + '</td>'
          + '<td class="td-x num">' + esc(r.quantityDisplay) + '</td>'
          + '<td class="td-x num">' + esc(r.costDisplay) + '</td>'
          + '<td class="td-x num">' + esc(r.valueDisplay) + '</td>'
          + '<td class="td-x num bold ' + r.gainClass + '">' + esc(r.gainDisplay) + '</td>'
          + rowActions('editHolding', 'deleteHolding', r.index, 'td-x')
          + '</tr>';
      }).join('')
      + '</table>'

      + '<div class="subhead">Vesting schedule (not yours yet)</div>'
      + '<p class="subhint">Unvested RSU units that vest on future dates. Value = Units × current price.</p>'
      + '<div class="form-grid vesting-form">'
      + field('Vest Date', dateInput('vestingDate', vf.date))
      + field('Grant', textInput('vestingGrant', vf.grant, ' placeholder="TDRSU26IG"'))
      + field('Units', numInput('vestingUnits', vf.units))
      + submitPair('submitVestingForm', 'cancelVestingForm', vf.mode === 'edit' ? 'Save changes' : 'Add vesting', vf.mode === 'edit', 'btn-row btn-row--sm')
      + '</div>'
      + '<table class="table"><thead><tr>'
      + '<th class="th wide">Vest date</th><th class="th wide">Grant</th><th class="th wide right">Units</th>'
      + '<th class="th wide right">Value</th><th class="th wide right"></th>'
      + '</tr></thead>'
      + v.vestingRows.map(function (r) {
        return '<tr class="row">'
          + '<td class="td-x">' + esc(r.date) + '</td>'
          + '<td class="td-x">' + esc(r.grant) + '</td>'
          + '<td class="td-x num">' + esc(r.unitsDisplay) + '</td>'
          + '<td class="td-x num">' + esc(r.valueDisplay) + '</td>'
          + rowActions('editVesting', 'deleteVesting', r.index, 'td-x')
          + '</tr>';
      }).join('')
      + '</table>');

    return '<h2 class="page-title page-title--sub">Stocks</h2>'
      + '<p class="hint mb-16">Teradata (TDC) — RSU grants &amp; ESPP. All values in USD, shown apart from your EGP totals.</p>'
      + '<div class="tabs tabs--teal">'
      + '<div class="' + cls('tab', !manage ? 'active' : '') + '" data-act="stockTabOverview">Overview</div>'
      + '<div class="' + cls('tab', manage ? 'active' : '') + '" data-act="stockTabManage">Manage</div>'
      + '</div>'
      + overview + manageBody;
  }

  function viewProvidentFund(v) {
    var manage = state.pfTab === 'manage';
    return '<h2 class="page-title page-title--mid">Provident Fund</h2>'
      + '<div class="tabs">'
      + '<div class="' + cls('tab', !manage ? 'active' : '') + '" data-act="pfTabOverview">Overview</div>'
      + '<div class="' + cls('tab', manage ? 'active' : '') + '" data-act="pfTabManage">Manage</div>'
      + '</div>'
      + '<div class="stat-grid">'
      + '<div class="stat c-purple"><div class="stat-label">Balance</div><div class="stat-value">' + esc(v.pfBalanceDisplay) + '</div></div>'
      + '<div class="stat c-cyan"><div class="stat-label">As of</div><div class="stat-value">' + esc(v.pfAsOfDisplay) + '</div></div>'
      + '<div class="stat c-fuchsia"><div class="stat-label">Tag</div><div class="stat-value">' + esc(v.pfTagDisplay) + '</div></div>'
      + '</div>'
      + when(manage, '<div class="form-grid pf-form">'
        + field('New balance (EGP)', numInput('pfBalance', state.pfForm.balance))
        + field('As Of', dateInput('pfAsOf', state.pfForm.asOf))
        + field('Tag', selectInput('pfTag', options(v.tagOptions, state.pfForm.tag || TAG_SAVING_OTHER)))
        + '<button class="btn-p btn-p--tight" data-act="submitPfForm">Update balance</button>'
        + '</div>');
  }

  function viewLedger(v) {
    return '<div class="page-head page-head--tight">'
      + '<h2 class="page-title page-title--flush">' + esc(v.ledgerAccountName) + '</h2>'
      + '<button class="btn-export" data-act="exportLedgerCsv">Export CSV</button></div>'
      + '<p class="ledger-note">Auto-generated from Transactions — add or edit entries on the Transactions page.</p>'
      + '<div class="stat-grid">'
      + '<div class="stat c-purple"><div class="stat-label">Current balance</div><div class="stat-value">' + esc(v.ledgerCurrentBalanceDisplay) + '</div></div>'
      + '<div class="stat c-cyan"><div class="stat-label">As of</div><div class="stat-value">' + esc(v.ledgerLastDateDisplay) + '</div></div>'
      + '<div class="stat c-fuchsia"><div class="stat-label">Owner</div><div class="stat-value">' + esc(v.ledgerOwnerDisplay) + '</div></div>'
      + '</div>'
      + '<table class="table"><thead><tr>'
      + '<th class="th">Date</th><th class="th">Description</th><th class="th">Type</th>'
      + '<th class="th right">Amount</th><th class="th right">Balance</th>'
      + '</tr></thead>'
      + v.ledgerRows.map(function (r) {
        return '<tr class="row">'
          + '<td class="td">' + esc(r.date) + '</td>'
          + '<td class="td">' + esc(r.description) + '</td>'
          + '<td class="td bold ' + r.typeClass + '">' + esc(r.type) + '</td>'
          + '<td class="td num">' + esc(r.amountDisplay) + '</td>'
          + '<td class="td num bold">' + esc(r.balanceDisplay) + '</td>'
          + '</tr>';
      }).join('')
      + '</table>';
  }

  function viewScreen(v) {
    switch (state.activeSheet) {
      case 'dashboard': return viewDashboard(v);
      case 'accounts': return viewAccounts(v);
      case 'types': return viewTypes(v);
      case 'tags': return viewTags(v);
      case 'about': return viewAbout(v);
      case 'transactions': return viewTransactions(v);
      case 'gold': return viewGold(v);
      case 'certs': return viewCerts(v);
      case 'stocks': return viewStocks(v);
      case 'pf': return viewProvidentFund(v);
      default: return v.isLedger ? viewLedger(v) : '';
    }
  }

  function viewMain(v) {
    return when(v.errorMessage, '<div class="error-banner">' + esc(v.errorMessage) + '</div>')
      + when(v.showSettings, viewSettings(v))
      + when(v.showAppBody, viewScreen(v))
      + when(v.loading, '<div class="toast">Syncing…</div>');
  }

  /* -------------------------------------------------------------- 8. render --- */

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

  /* --------------------------------------------- 9. actions & field input --- */

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

  var actions = {
    /* --- connection --- */
    saveAndConnect: function () {
      var clientId = state.clientIdInput.trim();
      var spreadsheetId = state.spreadsheetIdInput.trim() || DEFAULT_SPREADSHEET_ID;
      if (!clientId) { set({ error: 'Paste your Google OAuth Client ID first.' }); return; }
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
    goAbout: function () { goto('about'); },
    selectAccount: function (d) { goto('account:' + state.accounts[+d.i]); },
    aboutTabAbout: function () { set({ aboutTab: 'about' }); },
    aboutTabPlan: function () { set({ aboutTab: 'plan' }); },
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

    /* --- transaction types --- */
    editType: function (d) {
      var index = +d.i;
      set({ typeForm: { mode: 'edit', index: index, name: state.types[index] } });
    },
    cancelTypeForm: function () { set({ typeForm: { mode: 'add', index: -1, name: '' } }); },
    submitTypeForm: function () {
      var f = state.typeForm;
      var name = f.name.trim();
      if (!name) return;
      var types = state.types.slice();
      if (f.mode === 'edit') types[f.index] = name;
      else {
        if (types.indexOf(name) !== -1) { set({ error: 'Type already exists.' }); return; }
        types.push(name);
      }
      persist('Transaction Types', ['Transaction Type'], types.map(function (t) { return { 'Transaction Type': t }; }),
        { types: types, typeForm: { mode: 'add', index: -1, name: '' } }, 'Save error');
    },
    deleteType: function (d) {
      var types = removeAt(state.types, +d.i);
      persist('Transaction Types', ['Transaction Type'], types.map(function (t) { return { 'Transaction Type': t }; }),
        { types: types }, 'Delete error');
    },

    /* --- tags --- */
    editTag: function (d) {
      var index = +d.i;
      set({ tagForm: { mode: 'edit', index: index, name: state.tags[index] } });
    },
    cancelTagForm: function () { set({ tagForm: { mode: 'add', index: -1, name: '' } }); },
    submitTagForm: function () {
      var f = state.tagForm;
      var name = f.name.trim();
      if (!name) return;
      var tags = state.tags.slice();
      if (f.mode === 'edit') tags[f.index] = name;
      else {
        if (tags.indexOf(name) !== -1) { set({ error: 'Tag already exists.' }); return; }
        tags.push(name);
      }
      persist('Tags', ['Tag'], tags.map(function (t) { return { Tag: t }; }),
        { tags: tags, tagForm: { mode: 'add', index: -1, name: '' } }, 'Save error');
    },
    deleteTag: function (d) {
      var index = +d.i;
      var name = state.tags[index];
      if (!confirm('Delete tag "' + name + '"? Items using it keep the old label until re-tagged.')) return;
      var tags = removeAt(state.tags, index);
      persist('Tags', ['Tag'], tags.map(function (t) { return { Tag: t }; }), { tags: tags }, 'Delete error');
    },

    /* --- transactions --- */
    sortByDate: function () {
      set({ sortCol: 'Date', sortDir: state.sortCol === 'Date' && state.sortDir === 'asc' ? 'desc' : 'asc' });
    },
    sortByAmount: function () {
      set({ sortCol: 'Amount', sortDir: state.sortCol === 'Amount' && state.sortDir === 'asc' ? 'desc' : 'asc' });
    },
    editTx: function (d) {
      var index = +d.i;
      var t = state.transactions[index];
      set({
        txForm: {
          mode: 'edit', index: index, date: t.Date, amount: formatAmountDisplay(t.Amount),
          description: t.Description, type: t['Transaction Type'], from: t['From Account'], to: t['To Account'],
        },
      });
    },
    cancelTxForm: function () {
      set({ txForm: { mode: 'add', index: -1, date: '', amount: '', description: '', type: '', from: '', to: '' } });
    },
    submitTxForm: function () {
      var f = state.txForm;
      var toRequired = toFieldRequired(f.type);
      var rawAmount = f.amount.replace(/,/g, '');
      var amountValid = rawAmount !== '' && rawAmount !== '-' && !isNaN(parseFloat(rawAmount));
      if (!f.date || !amountValid || !f.from || (toRequired && !f.to)) {
        set({ error: toRequired ? 'Date, Amount, From and To Account are required.' : 'Date, Amount and From Account are required.' });
        return;
      }
      var record = {
        Date: f.date, Amount: rawAmount, Description: f.description, 'Transaction Type': f.type,
        'From Account': f.from, 'To Account': toRequired ? f.to : '',
      };
      var transactions = state.transactions.slice();
      if (f.mode === 'edit') transactions[f.index] = record; else transactions.push(record);
      persist('Transactions', TX_HEADERS, transactions, {
        transactions: transactions,
        txForm: { mode: 'add', index: -1, date: '', amount: '', description: '', type: '', from: '', to: '' },
      }, 'Save error', recomputeAndWriteAllLedgers);
    },
    deleteTx: function (d) {
      var transactions = removeAt(state.transactions, +d.i);
      persist('Transactions', TX_HEADERS, transactions, { transactions: transactions }, 'Delete error', recomputeAndWriteAllLedgers);
    },
    exportTransactionsCsv: function () {
      downloadCsv('transactions.csv', TX_HEADERS, state.transactions);
    },
    exportLedgerCsv: function () {
      var name = state.activeSheet.replace('account:', '');
      downloadCsv(name.replace(/\s+/g, '_') + '_ledger.csv', LEDGER_HEADERS, computeLedger(name, state.transactions));
    },

    /* --- plan --- */
    editPlan: function (d) {
      var index = +d.i;
      var p = state.planItems[index];
      set({ planForm: { mode: 'edit', index: index, step: p.Step, item: p.Item, status: p.Status, notes: p.Notes || '', version: p.Version || '' } });
    },
    cancelPlanForm: function () {
      set({ planForm: { mode: 'add', index: -1, step: '1', item: '', status: 'Not started', notes: '', version: '' } });
    },
    submitPlanForm: function () {
      var f = state.planForm;
      var item = f.item.trim();
      if (!item) return;
      var record = { Step: f.step, Item: item, Status: f.status, Notes: f.notes.trim(), Version: f.version.trim() };
      var planItems = state.planItems.slice();
      if (f.mode === 'edit') planItems[f.index] = record; else planItems.push(record);
      persist('Plan', PLAN_HEADERS, planItems, {
        planItems: planItems,
        planForm: { mode: 'add', index: -1, step: '1', item: '', status: 'Not started', notes: '', version: '' },
      }, 'Save error');
    },
    deletePlan: function (d) {
      var planItems = removeAt(state.planItems, +d.i);
      persist('Plan', PLAN_HEADERS, planItems, { planItems: planItems }, 'Delete error');
    },

    /* --- gold --- */
    editGold: function (d) {
      var index = +d.i;
      var it = state.goldItems[index];
      set({
        goldForm: {
          mode: 'edit', index: index, quantity: String(it.Quantity), type: it.Type, brand: it.Brand || '',
          weight: String(it['Weight (gm)']), where: it.Where || '',
          purchasePrice: String(it['Purchase Price per Gram (EGP)']), purchaseDate: it['Purchase Date'],
          currentPrice: String(it['Current Price per Gram (EGP)']), asOf: it['As Of'], tag: it.Tag || TAG_SAVING_OTHER,
        },
      });
    },
    cancelGoldForm: function () {
      set({ goldForm: { mode: 'add', index: -1, quantity: '', type: '', brand: '', weight: '', where: '', purchasePrice: '', purchaseDate: '', currentPrice: '', asOf: '', tag: TAG_SAVING_OTHER } });
    },
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
      var record = {
        Quantity: qty, Type: f.type.trim(), Brand: f.brand.trim(), 'Weight (gm)': weight, Where: f.where.trim(),
        'Purchase Price per Gram (EGP)': price, 'Purchase Date': f.purchaseDate,
        'Current Price per Gram (EGP)': currentPrice, 'As Of': asOf, Tag: f.tag || TAG_SAVING_OTHER,
      };
      var goldItems = state.goldItems.slice();
      if (f.mode === 'edit') goldItems[f.index] = record; else goldItems.push(record);
      persist('Gold', GOLD_HEADERS, goldItems, {
        goldItems: goldItems,
        goldForm: { mode: 'add', index: -1, quantity: '', type: '', brand: '', weight: '', where: '', purchasePrice: '', purchaseDate: '', currentPrice: '', asOf: '', tag: TAG_SAVING_OTHER },
      }, 'Save error');
    },
    deleteGold: function (d) {
      var goldItems = removeAt(state.goldItems, +d.i);
      persist('Gold', GOLD_HEADERS, goldItems, { goldItems: goldItems }, 'Delete error');
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

    /* --- certificates & rates --- */
    editCert: function (d) {
      var index = +d.i;
      var c = state.certItems[index];
      set({
        certForm: {
          mode: 'edit', index: index, number: c['Certificate Number'], product: c['Product Name'],
          openDate: c['Open Date'], amount: String(c.Amount), currency: c.Currency,
          frequency: c['Interest Frequency'], maturityDate: c['Maturity Date'],
          rate: String((parseFloat(c['Interest Rate']) || 0) * 100), tag: c.Tag || TAG_SAVING_OTHER,
        },
      });
    },
    cancelCertForm: function () {
      set({ certForm: { mode: 'add', index: -1, number: '', product: '', openDate: '', amount: '', currency: '', frequency: '', maturityDate: '', rate: '', tag: TAG_SAVING_OTHER } });
    },
    submitCertForm: function () {
      var f = state.certForm;
      var amount = parseFloat(f.amount);
      var ratePct = parseFloat(f.rate);
      if (!amount || !f.currency.trim() || !f.openDate || !f.maturityDate || isNaN(ratePct)) {
        set({ error: 'Amount, Currency, Open Date, Maturity Date and Interest Rate are required.' });
        return;
      }
      var record = {
        'Certificate Number': f.number.trim(), 'Product Name': f.product.trim(), 'Open Date': f.openDate,
        Amount: amount, Currency: f.currency.trim().toUpperCase(), 'Interest Frequency': f.frequency.trim(),
        'Maturity Date': f.maturityDate, 'Interest Rate': ratePct / 100, Tag: f.tag || TAG_SAVING_OTHER,
      };
      var certItems = state.certItems.slice();
      if (f.mode === 'edit') certItems[f.index] = record; else certItems.push(record);
      persist('Certificates', CERT_HEADERS, certItems, {
        certItems: certItems,
        certForm: { mode: 'add', index: -1, number: '', product: '', openDate: '', amount: '', currency: '', frequency: '', maturityDate: '', rate: '', tag: TAG_SAVING_OTHER },
      }, 'Save error');
    },
    deleteCert: function (d) {
      var certItems = removeAt(state.certItems, +d.i);
      persist('Certificates', CERT_HEADERS, certItems, { certItems: certItems }, 'Delete error');
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

    /* --- stocks --- */
    editHolding: function (d) {
      var index = +d.i;
      var h = state.stockHoldings[index];
      set({
        holdingForm: {
          mode: 'edit', index: index, source: h.Source || 'Vested RSU', label: h.Label || '',
          quantity: String(h.Quantity), cost: String(h['Cost Basis (USD)']), acquired: h['Acquired Date'] || '',
        },
      });
    },
    cancelHoldingForm: function () {
      set({ holdingForm: { mode: 'add', index: -1, source: 'Vested RSU', label: '', quantity: '', cost: '', acquired: '' } });
    },
    submitHoldingForm: function () {
      var f = state.holdingForm;
      var qty = parseFloat(f.quantity);
      var cost = parseFloat(f.cost);
      if (!qty || isNaN(cost)) { set({ error: 'Quantity and Cost Basis are required.' }); return; }
      var record = { Source: f.source, Label: f.label.trim(), Quantity: qty, 'Cost Basis (USD)': cost, 'Acquired Date': f.acquired };
      var stockHoldings = state.stockHoldings.slice();
      if (f.mode === 'edit') stockHoldings[f.index] = record; else stockHoldings.push(record);
      persist('Stock Holdings', STOCK_HOLDINGS_HEADERS, stockHoldings, {
        stockHoldings: stockHoldings,
        holdingForm: { mode: 'add', index: -1, source: 'Vested RSU', label: '', quantity: '', cost: '', acquired: '' },
      }, 'Save error');
    },
    deleteHolding: function (d) {
      var stockHoldings = removeAt(state.stockHoldings, +d.i);
      persist('Stock Holdings', STOCK_HOLDINGS_HEADERS, stockHoldings, { stockHoldings: stockHoldings }, 'Delete error');
    },
    editVesting: function (d) {
      var index = +d.i;
      var vest = state.stockVesting[index];
      set({ vestingForm: { mode: 'edit', index: index, date: vest['Vest Date'] || '', grant: vest.Grant || '', units: String(vest.Units) } });
    },
    cancelVestingForm: function () {
      set({ vestingForm: { mode: 'add', index: -1, date: '', grant: '', units: '' } });
    },
    submitVestingForm: function () {
      var f = state.vestingForm;
      var units = parseFloat(f.units);
      if (!f.date || !units) { set({ error: 'Vest Date and Units are required.' }); return; }
      var record = { 'Vest Date': f.date, Grant: f.grant.trim(), Units: units };
      var stockVesting = state.stockVesting.slice();
      if (f.mode === 'edit') stockVesting[f.index] = record; else stockVesting.push(record);
      persist('Stock Vesting', STOCK_VESTING_HEADERS, stockVesting, {
        stockVesting: stockVesting,
        vestingForm: { mode: 'add', index: -1, date: '', grant: '', units: '' },
      }, 'Save error');
    },
    deleteVesting: function (d) {
      var stockVesting = removeAt(state.stockVesting, +d.i);
      persist('Stock Vesting', STOCK_VESTING_HEADERS, stockVesting, { stockVesting: stockVesting }, 'Delete error');
    },
    applyStockPriceUpdate: function () {
      var f = state.stockPriceForm;
      var prev = state.stockMeta || DEFAULT_STOCK_META;
      var price = f.currentPrice !== '' ? parseFloat(f.currentPrice) : parseFloat(prev['Current Price (USD)']);
      var cash = f.cash !== '' ? parseFloat(f.cash) : parseFloat(prev['Cash (USD)']);
      if (isNaN(price)) { set({ error: 'Enter a current price first.' }); return; }
      var stockMeta = {
        Symbol: f.symbol.trim() || prev.Symbol,
        'Current Price (USD)': price,
        'Cash (USD)': isNaN(cash) ? 0 : cash,
        'As Of': f.asOf || prev['As Of'],
      };
      persist('Stock Meta', STOCK_META_HEADERS, [stockMeta], {
        stockMeta: stockMeta, stockScenarioPrice: price,
        stockPriceForm: { symbol: '', currentPrice: '', cash: '', asOf: '' },
      }, 'Save error');
    },
  };

  /* Input handlers, keyed by the control's data-f attribute. */
  var fields = {
    clientId: function (v) { set({ clientIdInput: v }); },
    spreadsheetId: function (v) { set({ spreadsheetIdInput: v }); },
    search: function (v) { set({ search: v }); },

    acctName: function (v) { setForm('acctForm', 'name', v); },
    acctOwner: function (v) { setForm('acctForm', 'owner', v); },
    acctTag: function (v) { setForm('acctForm', 'tag', v); },
    typeName: function (v) { setForm('typeForm', 'name', v); },
    tagName: function (v) { setForm('tagForm', 'name', v); },

    txType: function (v) { setForm('txForm', 'type', v); },
    txDate: function (v) { setForm('txForm', 'date', v); },
    txAmount: function (v) {
      if (v === '' || /^-?[\d,]*\.?\d*$/.test(v)) state.txForm.amount = formatAmountDisplay(v);
      render();
    },
    txDescription: function (v) { setForm('txForm', 'description', v); },
    txFrom: function (v) { setForm('txForm', 'from', v); },
    txTo: function (v) { setForm('txForm', 'to', v); },

    planStep: function (v) { setForm('planForm', 'step', v); },
    planItem: function (v) { setForm('planForm', 'item', v); },
    planStatus: function (v) { setForm('planForm', 'status', v); },
    planNotes: function (v) { setForm('planForm', 'notes', v); },
    planVersion: function (v) { setForm('planForm', 'version', v); },

    goldQuantity: function (v) { setForm('goldForm', 'quantity', v); },
    goldType: function (v) { setForm('goldForm', 'type', v); },
    goldBrand: function (v) { setForm('goldForm', 'brand', v); },
    goldWeight: function (v) { setForm('goldForm', 'weight', v); },
    goldWhere: function (v) { setForm('goldForm', 'where', v); },
    goldPurchasePrice: function (v) { setForm('goldForm', 'purchasePrice', v); },
    goldPurchaseDate: function (v) { setForm('goldForm', 'purchaseDate', v); },
    goldTag: function (v) { setForm('goldForm', 'tag', v); },
    goldPriceCurrent: function (v) { setForm('goldPriceForm', 'currentPrice', v); },
    goldPriceAsOf: function (v) { setForm('goldPriceForm', 'asOf', v); },

    certNumber: function (v) { setForm('certForm', 'number', v); },
    certProduct: function (v) { setForm('certForm', 'product', v); },
    certOpenDate: function (v) { setForm('certForm', 'openDate', v); },
    certAmount: function (v) { setForm('certForm', 'amount', v); },
    certCurrency: function (v) { setForm('certForm', 'currency', v.toUpperCase()); },
    certFrequency: function (v) { setForm('certForm', 'frequency', v); },
    certMaturityDate: function (v) { setForm('certForm', 'maturityDate', v); },
    certRate: function (v) { setForm('certForm', 'rate', v); },
    certTag: function (v) { setForm('certForm', 'tag', v); },

    rateCurrency: function (v) { setForm('rateForm', 'currency', v.toUpperCase()); },
    rateValue: function (v) { setForm('rateForm', 'rate', v); },
    rateAsOf: function (v) { setForm('rateForm', 'asOf', v); },

    pfBalance: function (v) {
      if (v === '' || /^[\d,]*\.?\d*$/.test(v)) state.pfForm.balance = v;
      render();
    },
    pfAsOf: function (v) { setForm('pfForm', 'asOf', v); },
    pfTag: function (v) { setForm('pfForm', 'tag', v); },

    holdingSource: function (v) { setForm('holdingForm', 'source', v); },
    holdingLabel: function (v) { setForm('holdingForm', 'label', v); },
    holdingQuantity: function (v) { setForm('holdingForm', 'quantity', v); },
    holdingCost: function (v) { setForm('holdingForm', 'cost', v); },
    holdingAcquired: function (v) { setForm('holdingForm', 'acquired', v); },

    vestingDate: function (v) { setForm('vestingForm', 'date', v); },
    vestingGrant: function (v) { setForm('vestingForm', 'grant', v); },
    vestingUnits: function (v) { setForm('vestingForm', 'units', v); },

    stockSymbol: function (v) { setForm('stockPriceForm', 'symbol', v.toUpperCase()); },
    stockPrice: function (v) { setForm('stockPriceForm', 'currentPrice', v); },
    stockCash: function (v) { setForm('stockPriceForm', 'cash', v); },
    stockAsOf: function (v) { setForm('stockPriceForm', 'asOf', v); },

    stockScenario: function (v) {
      state.stockScenarioPrice = parseFloat(v);
      updateScenarioReadouts(state.stockScenarioPrice);
    },
  };

  /* ---------------------------------------------------------------- 10. boot --- */

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

  function restoreConfig() {
    try {
      var saved = JSON.parse(localStorage.getItem('financeTracker.config') || '{}');
      if (saved.clientId) {
        state.clientId = saved.clientId;
        state.spreadsheetId = saved.spreadsheetId || DEFAULT_SPREADSHEET_ID;
        state.clientIdInput = saved.clientId;
        state.spreadsheetIdInput = saved.spreadsheetId || DEFAULT_SPREADSHEET_ID;
        state.connected = true;
        state.showSettings = false;
      }
    } catch (e) { /* no usable saved config */ }
  }

  function boot() {
    sidebarEl = document.getElementById('sidebar');
    mainEl = document.getElementById('main');
    restoreConfig();
    bindEvents();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
