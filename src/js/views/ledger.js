import { statCard, dataTable } from './helpers.js';
import { esc } from '../format.js';

export function viewLedger(v) {
  return '<div class="page-head page-head--tight">'
    + '<h2 class="page-title page-title--flush">' + esc(v.ledgerAccountName) + '</h2>'
    + '<button class="btn-export" data-act="exportLedgerCsv">Export CSV</button></div>'
    + '<p class="ledger-note">Auto-generated from Transactions — add or edit entries on the Transactions page.</p>'
    + '<div class="stat-grid">'
    + statCard('Current balance', esc(v.ledgerCurrentBalanceDisplay), 'c-purple')
    + statCard('As of', esc(v.ledgerLastDateDisplay), 'c-cyan')
    + statCard('Owner', esc(v.ledgerOwnerDisplay), 'c-fuchsia')
    + '</div>'
    + dataTable({
      columns: [
        { label: 'Date' }, { label: 'Description' }, { label: 'Type' },
        { label: 'Amount', cls: 'right' }, { label: 'Balance', cls: 'right' },
      ],
      rows: v.ledgerRows,
      cells: function (r) {
        return '<td class="td">' + esc(r.date) + '</td>'
          + '<td class="td">' + esc(r.description) + '</td>'
          + '<td class="td bold ' + r.typeClass + '">' + esc(r.type) + '</td>'
          + '<td class="td num">' + esc(r.amountDisplay) + '</td>'
          + '<td class="td num bold">' + esc(r.balanceDisplay) + '</td>';
      },
    });
}
