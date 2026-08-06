/* Small markup builders shared by every screen view: a Overview/Manage tab bar,
   labelled stat cards, a uniform header/row/actions table shape, and the
   grid-form field primitives (label + input). */

import { esc } from '../format.js';

export function cls() {
  var out = [];
  for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
  return out.join(' ');
}

export function when(cond, html) {
  return cond ? html : '';
}

export function options(list, selected) {
  return list.map(function (o) {
    return '<option value="' + esc(o) + '"' + (String(o) === String(selected) ? ' selected' : '') + '>' + esc(o) + '</option>';
  }).join('');
}

export function optionPairs(pairs, selected) {
  return pairs.map(function (p) {
    return '<option value="' + esc(p[0]) + '"' + (String(p[0]) === String(selected) ? ' selected' : '') + '>' + esc(p[1]) + '</option>';
  }).join('');
}

/* Grid-form field: small label above a small input. */
export function field(label, inputHtml) {
  return '<div><label class="lbl sm">' + esc(label) + '</label>' + inputHtml + '</div>';
}

export function textInput(name, value, extra) {
  return '<input class="input-sm" data-f="' + name + '" value="' + esc(value) + '"' + (extra || '') + '>';
}

export function numInput(name, value, extra) {
  return '<input class="input-sm" type="text" inputmode="decimal" data-f="' + name + '" value="' + esc(value) + '"' + (extra || '') + '>';
}

export function dateInput(name, value, extra) {
  return '<input class="input-sm" type="date" data-f="' + name + '" value="' + esc(value) + '"' + (extra || '') + '>';
}

export function selectInput(name, optsHtml, extra, extraClass) {
  return '<select class="' + cls('input-sm', extraClass) + '" data-f="' + name + '"' + (extra || '') + '>' + optsHtml + '</select>';
}

export function rowActions(editAct, deleteAct, index, tdClass) {
  return '<td class="' + tdClass + ' act">'
    + '<button class="btn-edit" data-act="' + editAct + '" data-i="' + index + '">Edit</button>'
    + '<button class="btn-del" data-act="' + deleteAct + '" data-i="' + index + '">Delete</button>'
    + '</td>';
}

export function submitPair(submitAct, cancelAct, label, editing, rowClass) {
  return '<div class="' + (rowClass || 'btn-row') + '">'
    + '<button class="btn-p btn-p--tight" data-act="' + submitAct + '">' + esc(label) + '</button>'
    + when(editing, '<button class="btn-ghost btn-ghost--tight" data-act="' + cancelAct + '">Cancel</button>')
    + '</div>';
}

export function chevron(open, extraClass) {
  return '<span class="' + cls('chev', extraClass, open ? 'open' : '') + '">▸</span>';
}

/* The Overview/Manage tab bar repeated at the top of five screens. */
export function tabBar(prefix, manage, teal) {
  return '<div class="' + cls('tabs', teal ? 'tabs--teal' : '') + '">'
    + '<div class="' + cls('tab', !manage ? 'active' : '') + '" data-act="' + prefix + 'TabOverview">Overview</div>'
    + '<div class="' + cls('tab', manage ? 'active' : '') + '" data-act="' + prefix + 'TabManage">Manage</div>'
    + '</div>';
}

/* A labelled figure with a colour accent. `valueHtml` is pre-built (and
   already escaped by the caller) so a card can mix static text with a
   formatted number, as the gain cards do. */
export function statCard(label, valueHtml, colourClass, valueClass) {
  return '<div class="' + cls('stat', colourClass) + '"><div class="stat-label">' + esc(label) + '</div>'
    + '<div class="' + cls('stat-value', valueClass) + '">' + valueHtml + '</div></div>';
}

export function statCardSm(label, valueHtml, colourClass, valueClass) {
  return '<div class="' + cls('stat-sm', colourClass) + '"><div class="stat-label">' + esc(label) + '</div>'
    + '<div class="' + cls('stat-value-sm', valueClass) + '">' + valueHtml + '</div></div>';
}

/* The header/row/actions shape shared by the plain list tables: an optional
   <thead> (omit `columns` for the header-less ones), one <tr> per row via
   `cells(row)`, and an optional trailing actions column via `rowActions`.
   The dashboard currency cards and the certificate group tables don't fit
   this shape closely enough to be worth forcing through it, and neither do
   the tables with a conditional Manage-mode actions column or a sortable
   header — those all stay written out. */
export function dataTable(opts) {
  var head = opts.columns ? '<thead><tr>' + opts.columns.map(function (c) {
    return '<th class="' + cls('th', c.cls) + '">' + c.label + '</th>';
  }).join('') + '</tr></thead>' : '';
  var body = opts.rows.map(function (row) {
    return '<tr class="row">' + opts.cells(row)
      + (opts.rowActions ? rowActions(opts.rowActions.editAct, opts.rowActions.deleteAct, row.index, opts.rowActions.tdClass) : '')
      + '</tr>';
  }).join('');
  return '<table class="' + cls('table', opts.tableClass) + '">' + head + body + '</table>';
}
