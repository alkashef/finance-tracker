/* Shared stub environment for the test harnesses. Installs a fake Google Identity
   Services client and a fake Sheets API `fetch` so app.js runs against invented data
   and never touches the network or a real Google account.

   installHarness(data, opts):
     data           one of the arrays from fixtures.js (POPULATED / EMPTY), in the
                     order app.js requests ranges in values:batchGet.
     opts.localEnv  raw config/.env text to serve, or null (the default: no file,
                     which is the only case the hosted site ever sees).

   Exposes:
     window.__errors  every window.onerror / unhandledrejection, as strings.
     window.__writes  one entry per Sheets write, as { sheet, range, headers, rows } —
                       headers/rows come from the request body, not guessed from the
                       URL, so a value written under the wrong header is caught. */
function installHarness(data, opts) {
  opts = opts || {};

  window.__errors = [];
  window.onerror = function (m, s, l, c) { window.__errors.push('ERROR: ' + m + ' @' + l + ':' + c); };
  window.addEventListener('unhandledrejection', function (e) {
    window.__errors.push('REJECT: ' + ((e.reason && e.reason.message) || e.reason));
  });
  window.confirm = function () { return true; };
  localStorage.removeItem('financeTracker.config');
  localStorage.removeItem('financeTracker.marketDataKeys');

  window.google = { accounts: { oauth2: { initTokenClient: function (cfg) {
    return { requestAccessToken: function () { cfg.callback({ access_token: 'stub', expires_in: 3600 }); } };
  } } } };

  var localEnv = opts.localEnv === undefined ? null : opts.localEnv;

  window.__writes = [];
  window.fetch = function (url, options) {
    url = String(url);
    options = options || {};
    var body = {};
    if (url.indexOf('config/.env') !== -1) {
      return Promise.resolve(localEnv === null
        ? { ok: false, status: 404, text: function () { return Promise.resolve(''); } }
        : { ok: true, status: 200, text: function () { return Promise.resolve(localEnv); } });
    }
    if (url.indexOf('values:batchGet') !== -1) {
      body = { valueRanges: data.map(function (v) { return { values: v }; }) };
    } else if (url.indexOf('fields=sheets.properties') !== -1) {
      body = { sheets: [{ properties: { sheetId: 0, title: 'Accounts' } }] };
    } else if (url.indexOf(':batchUpdate') !== -1) {
      body = { replies: [{ addSheet: { properties: { sheetId: Math.floor(Math.random() * 1e6) } } }] };
    } else if (url.indexOf('valueInputOption=RAW') !== -1) {
      var m = /\/values\/([^!]+)!/.exec(url);
      var sheetName = m ? decodeURIComponent(m[1]) : url;
      var payload = {};
      try { payload = JSON.parse(options.body || '{}'); } catch (e) { /* malformed write — leave payload empty */ }
      var values = payload.values || [];
      window.__writes.push({
        sheet: sheetName,
        range: payload.range || '',
        headers: values[0] || [],
        rows: values.slice(1),
      });
    }
    return Promise.resolve({ json: function () { return Promise.resolve(body); } });
  };
}
