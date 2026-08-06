import { statCard, when } from './helpers.js';
import { esc, fmtMoney, fmtEGP } from '../format.js';
import { state } from '../state.js';

/* A stat-card's value area for one leg of the check: an em dash before the
   first check this session, "Check failed" plus the error message on
   failure, or the formatted figure plus its as-of date on success. */
function cardValue(item, formatOk) {
  if (!item) return '—';
  if (item.error) return '<span class="gain-neg">Check failed</span><div class="panel-note">' + esc(item.error) + '</div>';
  return esc(formatOk(item)) + '<div class="panel-note">as of ' + esc(item.asOf) + '</div>';
}

export function viewPrices(v) {
  var pc = state.priceCheck;
  var stockSymbol = (state.stockMeta && state.stockMeta.Symbol) || '';
  var ratesByCurrency = {};
  (pc.rates || []).forEach(function (r) { ratesByCurrency[r.currency] = r; });

  var currencyCards = state.rates.map(function (r) {
    return statCard('Currency — ' + r.Currency,
      cardValue(ratesByCurrency[r.Currency], function (item) {
        return item.rate.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' EGP';
      }), 'c-blue');
  }).join('');

  return '<h2 class="page-title page-title--mid">Market Prices</h2>'
    + '<p class="hint mb-16">Live gold, stock and currency-rate lookups for today — a quick reference and gut-check, not saved anywhere.</p>'
    + '<button class="btn-p btn-p--tight mb-16" data-act="checkTodaysPrices">' + (pc.loading ? 'Checking…' : 'Check today’s prices') + '</button>'
    + '<div class="stat-grid">'
    + statCard('Gold — 24k, EGP/gram', cardValue(pc.gold, function (item) { return fmtEGP(item.price); }), 'c-amber')
    + statCard('Stock' + (stockSymbol ? ' — ' + stockSymbol : ''), cardValue(pc.stock, function (item) { return fmtMoney(item.price); }), 'c-teal')
    + '</div>'
    + when(state.rates.length > 0, '<div class="stat-grid">' + currencyCards + '</div>')
    + when(state.rates.length === 0, '<p class="hint">No currencies set yet — add one on the Certificates screen’s Currency Rates panel.</p>');
}
