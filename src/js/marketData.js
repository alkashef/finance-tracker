/* Live market-price lookups: GoldAPI.io for the Egypt gold price, Alpha
   Vantage for a stock's latest close, open.er-api.com for a currency's rate
   to EGP. This app has no backend — everything runs from the browser — so
   these are called directly with `fetch()`; a provider that doesn't answer
   with CORS headers simply won't work here, which is a fact about the
   provider, not a bug in this file. The two keys this needs (GoldAPI.io,
   Alpha Vantage) are pasted into inputs on the Gold/Stocks Manage screens and
   live only in localStorage (see src/app.js's restoreConfig()) — never in the
   repo, same rule as the OAuth Client ID and Spreadsheet ID.

   Each lookup splits into a pure `parse*` function (response JSON in, `{price,
   asOf}`/`{rate, asOf}` out, throws a plain Error on anything unexpected) and
   a thin `fetch*` wrapper around it — the parser is what test/unit.html
   exercises directly with literal fixture JSON; the wrapper is what actions.js
   calls. Errors are read from the JSON body, not `res.ok`/`res.status` —
   sheets.js's sheetsFetch() does the same, since a REST error still arrives as
   a JSON body worth reading. */

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/* GoldAPI.io's `timestamp` is Unix seconds; a currency provider's
   `time_last_update_utc` is a full date string. Both land on a plain ISO
   date, falling back to today when the source field is missing or bad. */
export function isoDateFromUnixSeconds(ts) {
  var n = parseFloat(ts);
  return n ? new Date(n * 1000).toISOString().slice(0, 10) : '';
}

export function isoDateFromDateString(s) {
  if (!s) return '';
  var d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/* ---------------------------------------------------------------- gold --- */

export function parseGoldApiPrice(json) {
  if (json && json.error) throw new Error(String(json.error));
  var price = parseFloat(json && json.price_gram_24k);
  if (!price) throw new Error('GoldAPI.io response had no 24k gram price.');
  return { price: price, asOf: isoDateFromUnixSeconds(json.timestamp) || todayIso() };
}

export function fetchGoldPriceEgp24k(apiKey) {
  return fetch('https://www.goldapi.io/api/XAU/EGP', { headers: { 'x-access-token': apiKey } })
    .then(function (res) { return res.json(); })
    .then(parseGoldApiPrice);
}

/* -------------------------------------------------------------- stocks --- */

export function parseAlphaVantageQuote(json, symbol) {
  if (json && json['Error Message']) throw new Error(String(json['Error Message']));
  if (json && (json.Note || json.Information)) throw new Error(String(json.Note || json.Information));
  var quote = (json && json['Global Quote']) || {};
  var price = parseFloat(quote['05. price']);
  if (!price) throw new Error('Alpha Vantage returned no price for ' + symbol + '.');
  return { price: price, asOf: quote['07. latest trading day'] || todayIso() };
}

export function fetchStockQuote(symbol, apiKey) {
  var url = 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol='
    + encodeURIComponent(symbol) + '&apikey=' + encodeURIComponent(apiKey);
  return fetch(url).then(function (res) { return res.json(); })
    .then(function (json) { return parseAlphaVantageQuote(json, symbol); });
}

/* ------------------------------------------------------- currency rates --- */

export function parseFxRate(json, currency) {
  if (!json || json.result !== 'success') {
    throw new Error((json && json['error-type']) || ('Exchange-rate lookup failed for ' + currency + '.'));
  }
  var rate = json.rates && parseFloat(json.rates.EGP);
  if (!rate) throw new Error('No EGP rate in the response for ' + currency + '.');
  return { rate: rate, asOf: isoDateFromDateString(json.time_last_update_utc) || todayIso() };
}

export function fetchFxRateToEgp(currency) {
  return fetch('https://open.er-api.com/v6/latest/' + encodeURIComponent(currency))
    .then(function (res) { return res.json(); })
    .then(function (json) { return parseFxRate(json, currency); });
}
