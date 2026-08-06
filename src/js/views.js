/* Entry point for the view layer: the screen dispatcher and the top-level
   viewMain/viewSidebar app.js's render() calls. The screens themselves live one
   level down, in views/*.js — one file per screen (views/lists.js groups the
   three trivial settings-list screens), split out because a single file holding
   every screen plus the shared markup helpers ran well past the ~500-line mark
   this milestone treats as the split trigger. */

import { when } from './views/helpers.js';
import { esc } from './format.js';
import { state } from './state.js';
export { viewSidebar } from './views/sidebar.js';
import { viewSettings } from './views/settings.js';
import { viewDashboard } from './views/dashboard.js';
import { viewAccounts, viewTypes, viewTags } from './views/lists.js';
import { viewPlan } from './views/plan.js';
import { viewTransactions } from './views/transactions.js';
import { viewGold } from './views/gold.js';
import { viewCerts } from './views/certs.js';
import { viewStocks } from './views/stocks.js';
import { viewProvidentFund } from './views/provident-fund.js';
import { viewLedger } from './views/ledger.js';

function viewScreen(v) {
  switch (state.activeSheet) {
    case 'dashboard': return viewDashboard(v);
    case 'accounts': return viewAccounts(v);
    case 'types': return viewTypes(v);
    case 'tags': return viewTags(v);
    case 'plan': return viewPlan(v);
    case 'transactions': return viewTransactions(v);
    case 'gold': return viewGold(v);
    case 'certs': return viewCerts(v);
    case 'stocks': return viewStocks(v);
    case 'pf': return viewProvidentFund(v);
    default: return v.isLedger ? viewLedger(v) : '';
  }
}

export function viewMain(v) {
  return when(v.errorMessage, '<div class="error-banner">' + esc(v.errorMessage) + '</div>')
    + when(v.showSettings, viewSettings(v))
    + when(v.showAppBody, viewScreen(v))
    + when(v.loading, '<div class="toast">Syncing…</div>');
}
