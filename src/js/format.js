/* Formatting helpers — pure functions, no dependency on state or the DOM. */

/* Cells the Sheet has typed as Date come back as serial numbers. */
export function sheetsFmtDate(v) {
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400000)).toISOString().slice(0, 10);
  return v;
}

export function fmtMoney(n) {
  var v = Number(n) || 0;
  var formatted = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '-$' : '$') + formatted;
}

export function fmtEGP(n) {
  var v = Number(n) || 0;
  var formatted = Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return (v < 0 ? '-EGP ' : 'EGP ') + formatted;
}

export function fmtEUR(n) {
  var v = Number(n) || 0;
  var formatted = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? '-€' : '€') + formatted;
}

export function signed(value, formatter) {
  return (value >= 0 ? '+' : '') + formatter(value);
}

export function formatAmountDisplay(raw) {
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

export function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, function (c) { return ESCAPES[c]; });
}
