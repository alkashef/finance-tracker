/* OAuth and every Sheets API call, plus the shared write/persist wrapper every
   save and delete uses. */

import { sheetsFmtDate } from './format.js';
import { state, set } from './state.js';

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

export function writeSheet(sheetName, headers, rows) {
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

export function ensureSheets(names) {
  return (names || []).reduce(function (chain, n) {
    return chain.then(function () { return ensureSheetExists(n); });
  }, Promise.resolve());
}

export function deleteSheet(title) {
  return Promise.resolve(sheetIdMap ? null : getSheetMeta()).then(function () {
    var id = sheetIdMap[title];
    if (id === undefined) return null;
    return sheetsFetch(':batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ requests: [{ deleteSheet: { sheetId: id } }] }),
    }).then(function () { delete sheetIdMap[title]; });
  });
}

export function renameSheet(oldTitle, newTitle) {
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

export function getAll() {
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
        return {
          Source: r[0], Label: r[1], Quantity: r[2], 'Cost Basis (USD)': r[3],
          'Acquired Date': sheetsFmtDate(r[4]), Tag: r[5] || '',
        };
      }),
      stockVesting: get(11).filter(function (r) { return r[0]; }).map(function (r) {
        return { 'Vest Date': sheetsFmtDate(r[0]), Grant: r[1], Units: r[2] };
      }),
    };
  });
}

/* Shared "write this sheet, then update state" wrapper for every save/delete. */
export function persist(sheet, headers, rows, patch, errPrefix, after) {
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
