import { field, selectInput, options, dateInput, numInput, textInput, submitPair, tabBar, when, rowActions } from './helpers.js';
import { esc } from '../format.js';
import { state } from '../state.js';
import { toFieldRequired } from '../model.js';

export function viewTransactions(v) {
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
    + tabBar('tx', manage)
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
