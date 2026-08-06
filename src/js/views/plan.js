import { field, selectInput, optionPairs, textInput, options, submitPair, when, rowActions } from './helpers.js';
import { esc } from '../format.js';
import { state } from '../state.js';

export function viewPlan(v) {
  var f = state.planForm;
  return '<h2 class="page-title page-title--tight">Plan</h2>'
    + '<p class="hint">The roadmap: get everything into one place, then analyze, then automate.</p>'
    + '<div class="form-grid plan-form">'
    + field('Step', selectInput('planStep', optionPairs([['1', '1 — Consolidate'], ['2', '2 — Analyze'], ['3', '3 — Automate']], f.step)))
    + field('Item', textInput('planItem', f.item))
    + field('Status', selectInput('planStatus', options(['Not started', 'In progress', 'Done'], f.status)))
    + field('Notes', textInput('planNotes', f.notes))
    + field('Version', textInput('planVersion', f.version, ' placeholder="v1"'))
    + submitPair('submitPlanForm', 'cancelPlanForm', f.mode === 'edit' ? 'Save changes' : 'Add item', f.mode === 'edit')
    + '</div>'
    + v.planStepGroups.map(function (g) {
      return '<div class="plan-group">'
        + '<div class="plan-group-title">' + esc(g.label) + '</div>'
        + '<table class="table">'
        + g.items.map(function (r) {
          return '<tr class="row">'
            + '<td class="td-lg">' + esc(r.item) + '</td>'
            + '<td class="td-lg sm">' + esc(r.notes) + '</td>'
            + '<td class="td-lg act"><span class="pill ' + r.versionClass + '">' + esc(r.versionDisplay) + '</span></td>'
            + '<td class="td-lg act"><span class="pill ' + r.statusClass + '">' + esc(r.status) + '</span></td>'
            + rowActions('editPlan', 'deletePlan', r.index, 'td-lg')
            + '</tr>';
        }).join('')
        + when(g.empty, '<tr><td class="empty-cell" colspan="5">Nothing here yet</td></tr>')
        + '</table></div>';
    }).join('');
}
