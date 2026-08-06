import { tabBar, statCard, when, field, numInput, dateInput, selectInput, options } from './helpers.js';
import { esc } from '../format.js';
import { state } from '../state.js';
import { TAG_SAVING_OTHER } from '../constants.js';

export function viewProvidentFund(v) {
  var manage = state.pfTab === 'manage';
  return '<h2 class="page-title page-title--mid">Provident Fund</h2>'
    + tabBar('pf', manage)
    + '<div class="stat-grid">'
    + statCard('Balance', esc(v.pfBalanceDisplay), 'c-purple')
    + statCard('As of', esc(v.pfAsOfDisplay), 'c-cyan')
    + statCard('Tag', esc(v.pfTagDisplay), 'c-fuchsia')
    + '</div>'
    + when(manage, '<div class="form-grid pf-form">'
      + field('New balance (EGP)', numInput('pfBalance', state.pfForm.balance))
      + field('As Of', dateInput('pfAsOf', state.pfForm.asOf))
      + field('Tag', selectInput('pfTag', options(v.tagOptions, state.pfForm.tag || TAG_SAVING_OTHER)))
      + '<button class="btn-p btn-p--tight" data-act="submitPfForm">Update balance</button>'
      + '</div>');
}
