import { statCard, tabBar, when, field, textInput, numInput, dateInput, selectInput, options, submitPair, chevron, rowActions } from './helpers.js';
import { esc } from '../format.js';
import { state } from '../state.js';
import { TAG_SAVING_OTHER } from '../constants.js';

export function viewCerts(v) {
  var f = state.certForm;
  var manage = state.certsTab === 'manage';

  var overview = when(!manage, '<div class="stat-grid mb-20">'
    + statCard('Current EGP value', esc(v.certTotalCurrentDisplay), 'c-blue')
    + statCard('At maturity (EGP)', esc(v.certTotalMaturityDisplay), 'c-purple')
    + statCard('Gain vs principal', esc(v.certGainDisplay) + ' (' + esc(v.certGainPctDisplay) + ')', v.certGainCardClass)
    + '</div>');

  var manageForms = when(manage,
    '<p class="hint">Holdings, not transactions. Amount at Maturity uses a flat rate applied once (matches your bank statement); EGP figures use the currency rate set below.</p>'
    + '<div class="rate-panel">'
    + '<div class="rate-panel-title">Currency rates (to EGP) — shared across all certificates</div>'
    + '<div class="rate-chips">'
    + v.rateRows.map(function (r) {
      return '<div class="rate-chip"><strong>' + esc(r.currency) + '</strong> = ' + esc(r.rateDisplay)
        + ' EGP <span class="rate-asof">(as of ' + esc(r.asOf) + ')</span></div>';
    }).join('')
    + '</div>'
    + '<div class="rate-form">'
    + field('Currency', textInput('rateCurrency', state.rateForm.currency, ' placeholder="USD"'))
    + field('Rate to EGP', numInput('rateValue', state.rateForm.rate))
    + field('As Of', dateInput('rateAsOf', state.rateForm.asOf))
    + '<button class="btn-ghost btn-ghost--tight" data-act="fetchRate">Fetch latest</button>'
    + '<button class="btn-p btn-p--tight btn-p--blue" data-act="applyRateUpdate">Set rate</button>'
    + '</div>'
    + '<p class="panel-note">Fetch looks up the currency above against EGP via '
    + '<a href="https://www.exchangerate-api.com/docs/free" target="_blank" rel="noopener">open.er-api.com</a> '
    + '(no key needed) and fills Rate and As Of — review, then click Set rate.</p>'
    + '</div>'
    + '<div class="panel">'
    + '<div class="grid cert-form-a">'
    + field('Certificate Number', textInput('certNumber', f.number))
    + field('Product Name', textInput('certProduct', f.product))
    + field('Open Date', dateInput('certOpenDate', f.openDate))
    + field('Amount', numInput('certAmount', f.amount))
    + '</div>'
    + '<div class="grid cert-form-b">'
    + field('Currency', textInput('certCurrency', f.currency, ' placeholder="EGP"'))
    + field('Interest Frequency', textInput('certFrequency', f.frequency, ' placeholder="1 Year"'))
    + field('Interest Rate (%)', numInput('certRate', f.rate, ' placeholder="7"'))
    + field('Tag', selectInput('certTag', options(v.tagOptions, f.tag || TAG_SAVING_OTHER)))
    + submitPair('submitCertForm', 'cancelCertForm', f.mode === 'edit' ? 'Save changes' : 'Add certificate', f.mode === 'edit')
    + '</div>'
    + '</div>'
    + '<div class="mb-14"><label class="lbl sm">Maturity Date</label>'
    + '<input class="input-sm auto" type="date" data-f="certMaturityDate" value="' + esc(f.maturityDate) + '"></div>');

  var groups = v.certGroups.map(function (g) {
    return '<div class="grp">'
      + '<div class="grp-head" data-act="toggleCertGroup" data-k="' + esc(g.currency) + '">'
      + chevron(g.isOpen) + esc(g.currency) + '</div>'
      + when(g.isOpen, '<table class="table"><thead><tr>'
        + '<th class="th">Product</th><th class="th">Number</th><th class="th">Tag</th>'
        + '<th class="th right">Amount</th><th class="th">Rate</th><th class="th">Maturity</th>'
        + '<th class="th right">EGP now</th><th class="th right">EGP at maturity</th>'
        + when(manage, '<th class="th"></th>')
        + '</tr></thead>'
        + g.rows.map(function (r) {
          return '<tr class="row">'
            + '<td class="td">' + esc(r.product) + '</td>'
            + '<td class="td sm">' + esc(r.number) + '</td>'
            + '<td class="td sm">' + esc(r.tagDisplay) + '</td>'
            + '<td class="td num">' + esc(r.amountDisplay) + '</td>'
            + '<td class="td">' + esc(r.rateDisplay) + '</td>'
            + '<td class="td sm"><div>' + esc(r.maturityDate) + '</div>'
            + '<div class="flag ' + r.flagClass + '">' + esc(r.flagText) + '</div></td>'
            + '<td class="td num">' + esc(r.egpNowDisplay) + '</td>'
            + '<td class="td num">' + esc(r.egpMaturityDisplay) + '</td>'
            + when(manage, rowActions('editCert', 'deleteCert', r.index, 'td'))
            + '</tr>';
        }).join('')
        + '</table>')
      + '</div>';
  }).join('');

  return '<h2 class="page-title page-title--mid">Certificates</h2>'
    + tabBar('certs', manage)
    + overview + manageForms + groups
    + when(v.certEmpty, '<div class="empty-cell">No certificates yet</div>');
}
