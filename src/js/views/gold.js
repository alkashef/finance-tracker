import { statCard, tabBar, when, field, numInput, textInput, dateInput, selectInput, options, submitPair, rowActions } from './helpers.js';
import { esc } from '../format.js';
import { state } from '../state.js';
import { TAG_SAVING_OTHER } from '../constants.js';

export function viewGold(v) {
  var f = state.goldForm;
  var manage = state.goldTab === 'manage';

  var overview = when(!manage, '<div class="stat-grid">'
    + statCard('Current value', esc(v.goldTotalCurrentDisplay), 'c-amber')
    + statCard('Cost basis', esc(v.goldTotalPurchaseDisplay), 'c-blue')
    + statCard('Grams held', esc(v.goldTotalGramsDisplay), 'c-purple')
    + statCard('Gain vs cost', esc(v.goldGainDisplay) + ' (' + esc(v.goldGainPctDisplay) + ')', v.goldGainCardClass)
    + '</div>');

  var manageForms = when(manage,
    '<p class="hint">Holdings, not transactions — a purchase\'s cash outflow is recorded separately on the Transactions page.</p>'
    + '<div class="panel">'
    + '<div class="grid gold-form-a">'
    + field('Quantity', numInput('goldQuantity', f.quantity))
    + field('Type', textInput('goldType', f.type, ' placeholder="Gold 24"'))
    + field('Brand', textInput('goldBrand', f.brand))
    + field('Weight (gm)', numInput('goldWeight', f.weight))
    + field('Where', textInput('goldWhere', f.where))
    + '</div>'
    + '<div class="grid gold-form-b">'
    + field('Purchase Price/gm (EGP)', numInput('goldPurchasePrice', f.purchasePrice))
    + field('Purchase Date', dateInput('goldPurchaseDate', f.purchaseDate))
    + field('Tag', selectInput('goldTag', options(v.tagOptions, f.tag || TAG_SAVING_OTHER)))
    + submitPair('submitGoldForm', 'cancelGoldForm', f.mode === 'edit' ? 'Save changes' : 'Add lot', f.mode === 'edit')
    + '</div>'
    + '</div>'
    + '<div class="form-grid gold-fetch-form">'
    + field('GoldAPI.io key', textInput('goldApiKey', state.goldApiKey, ' type="password" placeholder="paste your free key"'))
    + '<button class="btn-ghost btn-ghost--tight" data-act="fetchGoldPrice">Fetch latest 24k price</button>'
    + '</div>'
    + '<p class="panel-note mb-14">Looks up today\'s international 24k gold spot price in EGP/gram via '
    + '<a href="https://www.goldapi.io/" target="_blank" rel="noopener">GoldAPI.io</a> (free key) and fills the '
    + 'fields below — review, then click Update.'
    + when(state.goldApiKeyFromEnv, ' Prefilled from your local <code>config/.env</code>.')
    + '</p>'
    + '<div class="form-grid gold-price-form">'
    + field('Current Price/gm (EGP) — updates all lots', numInput('goldPriceCurrent', state.goldPriceForm.currentPrice))
    + field('As Of', dateInput('goldPriceAsOf', state.goldPriceForm.asOf))
    + '<button class="btn-p btn-p--tight btn-p--gold" data-act="applyGoldPriceUpdate">Update price for all lots</button>'
    + '</div>');

  return '<h2 class="page-title page-title--mid">Gold</h2>'
    + tabBar('gold', manage)
    + overview + manageForms
    + '<table class="table"><thead><tr>'
    + '<th class="th">Qty</th><th class="th">Type</th><th class="th">Brand</th>'
    + '<th class="th right">Weight (gm)</th><th class="th">Where</th><th class="th">Tag</th>'
    + '<th class="th">Purchased</th><th class="th right">Cost</th><th class="th right">Value now</th>'
    + '<th class="th right">Gain</th>'
    + when(manage, '<th class="th"></th>')
    + '</tr></thead>'
    + v.goldRows.map(function (r) {
      return '<tr class="row">'
        + '<td class="td">' + esc(r.quantity) + '</td>'
        + '<td class="td">' + esc(r.type) + '</td>'
        + '<td class="td muted">' + esc(r.brand) + '</td>'
        + '<td class="td num">' + esc(r.weightDisplay) + '</td>'
        + '<td class="td muted">' + esc(r.where) + '</td>'
        + '<td class="td sm">' + esc(r.tagDisplay) + '</td>'
        + '<td class="td">' + esc(r.purchaseDate) + '</td>'
        + '<td class="td num">' + esc(r.costDisplay) + '</td>'
        + '<td class="td num">' + esc(r.valueDisplay) + '</td>'
        + '<td class="td num ' + r.gainClass + '">' + esc(r.gainDisplay) + '</td>'
        + when(manage, rowActions('editGold', 'deleteGold', r.index, 'td'))
        + '</tr>';
    }).join('')
    + when(v.goldEmpty, '<tr><td class="empty-cell" colspan="11">No gold holdings yet</td></tr>')
    + '</table>';
}
