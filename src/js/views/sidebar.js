import { cls, when, chevron } from './helpers.js';
import { esc } from '../format.js';

export function viewSidebar(v) {
  var head = '<div class="sb-head">'
    + when(v.sidebarOpen, '<div class="sb-title"><span class="sb-title-text">AK47 Finance Tracker</span><span class="sb-badge">v3</span></div>')
    + '<div class="sb-toggle" data-act="toggleSidebar">' + (v.sidebarOpen ? '◂' : '▸') + '</div>'
    + '</div>';
  if (!v.sidebarOpen) return head;

  function navItem(label, act, active) {
    return '<div class="' + cls('nav-item', active ? 'active' : '') + '" data-act="' + act + '">' + esc(label) + '</div>';
  }
  function accountNav(items) {
    return items.map(function (it) {
      return '<div class="' + cls('nav-item', v.activeSheet === 'account:' + it.name ? 'active' : '')
        + '" data-act="selectAccount" data-i="' + it.index + '">' + esc(it.name) + '</div>';
    }).join('');
  }

  return head
    + '<div class="nav-group">'
    + navItem('Dashboard', 'goDashboard', v.activeSheet === 'dashboard')
    + navItem('Transactions', 'goTransactions', v.activeSheet === 'transactions')
    + '</div>'

    + '<div class="nav-section" data-act="toggleSavingNav">' + chevron(v.savingNavOpen, 'chev-saving') + 'Saving</div>'
    + when(v.savingNavOpen, '<div class="nav-group">'
      + navItem('Gold', 'goGold', v.activeSheet === 'gold')
      + navItem('Certificates', 'goCerts', v.activeSheet === 'certs')
      + navItem('Stocks', 'goStocks', v.activeSheet === 'stocks')
      + navItem('Provident Fund', 'goProvidentFund', v.activeSheet === 'pf')
      + accountNav(v.savingAccountNavItems)
      + '</div>')

    + '<div class="nav-section" data-act="toggleSpendingNav">' + chevron(v.spendingNavOpen, 'chev-spending') + 'Spending</div>'
    + when(v.spendingNavOpen, '<div class="nav-group">'
      + accountNav(v.spendingAccountNavItems)
      + when(v.spendingAccountNavItems.length === 0, '<div class="nav-empty">No spending accounts yet</div>')
      + '</div>')

    + '<div class="nav-section" data-act="toggleAccountSettings">' + chevron(v.accountSettingsOpen, 'chev-settings') + 'Settings</div>'
    + when(v.accountSettingsOpen, '<div class="nav-group">'
      + navItem('Accounts', 'goAccounts', v.activeSheet === 'accounts')
      + navItem('Transaction Types', 'goTypes', v.activeSheet === 'types')
      + navItem('Tags', 'goTags', v.activeSheet === 'tags')
      + navItem('Market Prices', 'goPrices', v.activeSheet === 'prices')
      + '</div>')

    + '<div class="nav-spacer"></div>'
    + '<div class="sb-footer-nav">' + navItem('Plan', 'goPlan', v.activeSheet === 'plan') + '</div>'
    + '<div class="sb-conn">'
    + (v.connected
      ? '<div class="sb-status">Connected</div>'
        + '<button class="sb-btn" data-act="refreshFromSheet">Refresh from Sheet</button>'
        + '<a class="sb-btn" href="' + esc(v.spreadsheetUrl) + '" target="_blank">Open Spreadsheet</a>'
        + '<button class="sb-btn" data-act="openSettings">Connection settings</button>'
      : '<button class="sb-btn" data-act="openSettings">Connection settings</button>')
    + '</div>';
}
