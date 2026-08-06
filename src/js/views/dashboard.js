import { chevron, when, statCardSm, dataTable } from './helpers.js';
import { esc } from '../format.js';
import { state } from '../state.js';

export function viewDashboard(v) {
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
        + statCardSm('As of', esc(g.lastDateDisplay), 'c-fuchsia')
        + statCardSm('Total balance', esc(g.subtotalDisplay), 'c-purple')
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

  var school = '<div class="group-grid">'
    + v.schoolAccountRows.map(function (r) {
      return '<div class="school-card"><div class="stat-label">' + esc(r.name) + '</div><div class="school-value">' + esc(r.balanceDisplay) + '</div></div>';
    }).join('')
    + '</div>'
    + when(!v.hasSchoolAccounts, '<div class="empty-note">No accounts tagged "Saving &gt; School" yet.</div>');

  var other = '<div class="group-grid">'
    + when(v.hasCerts, '<div class="wide-card"><div class="group-title">Certificates</div><div class="stat-row">'
      + statCardSm('Current EGP value', esc(v.certTotalCurrentDisplay), 'c-blue')
      + statCardSm('At maturity', esc(v.certTotalMaturityDisplay), 'c-purple')
      + statCardSm('Gain vs principal', esc(v.certGainDisplay) + ' (' + esc(v.certGainPctDisplay) + ')', v.certGainCardClass)
      + '</div></div>')
    + '</div>'
    + '<div class="group-grid">'
    + when(v.hasGold, '<div class="wide-card"><div class="group-title">Gold</div><div class="stat-row">'
      + statCardSm('Current value', esc(v.goldTotalCurrentDisplay), 'c-amber')
      + statCardSm('Grams held', esc(v.goldTotalGramsDisplay), 'c-purple')
      + statCardSm('Gain vs cost', esc(v.goldGainDisplay), v.goldGainCardClass)
      + '</div></div>')
    + '</div>'
    + '<div class="group-grid">'
    + when(v.hasStocks, '<div class="wide-card"><div class="group-title">Stocks' + esc(v.stockSymbolSuffix) + '</div><div class="stat-row">'
      + statCardSm('Sellable now', esc(v.sellableNowDisplay), 'c-teal')
      + statCardSm('🔒 Vesting later', esc(v.unvestedTotalDisplay), 'c-slate')
      + statCardSm('Gain if sold now', esc(v.stockNowGainDisplay) + ' (' + esc(v.stockNowGainPctDisplay) + ')', 'c-green', v.stockNowGainClass)
      + '</div></div>')
    + '</div>'
    + '<div class="group-grid">' + ownerGroupCards(v.otherSavingGroups) + '</div>';

  var saving = '<div class="sec-saving" data-act="toggleDashSaving">' + chevron(state.dashSavingOpen) + 'Saving</div>'
    + when(state.dashSavingOpen, school + other);

  var recent = '<div class="sec-recent" data-act="toggleRecentTx">' + chevron(state.recentTxOpen) + 'Recent transactions</div>'
    + when(state.recentTxOpen, dataTable({
      columns: [
        { label: 'Date' }, { label: 'Description' }, { label: 'From → To' }, { label: 'Amount', cls: 'right' },
      ],
      rows: v.recentTransactions,
      cells: function (t) {
        return '<td class="td">' + esc(t.date) + '</td>'
          + '<td class="td">' + esc(t.description) + '</td>'
          + '<td class="td link">' + esc(t.fromTo) + '</td>'
          + '<td class="td num">' + esc(t.amountDisplay) + '</td>';
      },
    }));

  return '<h2 class="page-title">Dashboard</h2>' + maturity + currency + spending + saving + recent;
}
