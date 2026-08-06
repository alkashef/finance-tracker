/* The three plain settings-list screens: Accounts, Transaction Types, Tags.
   Grouped together because they share the same trivial table shape — the same
   grouping listsModel() in model.js already makes for their row data. */

import { when, options, dataTable } from './helpers.js';
import { esc } from '../format.js';
import { TAG_SPENDING } from '../constants.js';
import { state } from '../state.js';

export function viewAccounts(v) {
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
    + dataTable({
      rows: v.accountRows,
      cells: function (r) {
        return '<td class="td-lg">' + esc(r.name) + '</td>'
          + '<td class="td-lg muted">' + esc(r.owner) + '</td>'
          + '<td class="td-lg sm">' + esc(r.tagDisplay) + '</td>';
      },
      rowActions: { editAct: 'editAccount', deleteAct: 'deleteAccount', tdClass: 'td-lg' },
    });
}

export function viewTypes(v) {
  return '<h2 class="page-title">Transaction Types</h2>'
    + '<div class="form-panel">'
    + '<div class="field"><label class="lbl">Transaction Type</label>'
    + '<input class="input input--form" data-f="typeName" value="' + esc(state.typeForm.name) + '"></div>'
    + '<button class="btn-p" data-act="submitTypeForm">' + (state.typeForm.mode === 'edit' ? 'Save changes' : 'Add type') + '</button>'
    + when(state.typeForm.mode === 'edit', '<button class="btn-ghost" data-act="cancelTypeForm">Cancel</button>')
    + '</div>'
    + dataTable({
      rows: v.typeRows,
      cells: function (r) { return '<td class="td-lg">' + esc(r.name) + '</td>'; },
      rowActions: { editAct: 'editType', deleteAct: 'deleteType', tdClass: 'td-lg' },
    });
}

export function viewTags(v) {
  return '<h2 class="page-title page-title--tight">Tags</h2>'
    + '<p class="hint">Tags available for Accounts, Gold, and Certificates. Use "Saving &gt; " prefix for savings sub-tags.</p>'
    + '<div class="form-panel">'
    + '<div class="field"><label class="lbl">Tag</label>'
    + '<input class="input input--form" data-f="tagName" value="' + esc(state.tagForm.name) + '" placeholder="Saving > Travel"></div>'
    + '<button class="btn-p" data-act="submitTagForm">' + (state.tagForm.mode === 'edit' ? 'Save changes' : 'Add tag') + '</button>'
    + when(state.tagForm.mode === 'edit', '<button class="btn-ghost" data-act="cancelTagForm">Cancel</button>')
    + '</div>'
    + dataTable({
      rows: v.tagRows,
      cells: function (r) { return '<td class="td-lg">' + esc(r.name) + '</td>'; },
      rowActions: { editAct: 'editTag', deleteAct: 'deleteTag', tdClass: 'td-lg' },
    });
}
