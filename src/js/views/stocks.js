import { tabBar, when, field, selectInput, options, textInput, numInput, dateInput, submitPair, dataTable } from './helpers.js';
import { esc } from '../format.js';
import { state } from '../state.js';
import { TAG_SAVING_OTHER } from '../constants.js';

export function viewStocks(v) {
  var manage = state.stockTab === 'manage';

  var overview = when(!manage,
    '<div class="stock-meta">' + when(v.stockSymbol, esc(v.stockSymbol) + ' · ')
    + '<strong>$' + esc(v.stockPriceDisplay) + '</strong> / share · as of ' + esc(v.stockAsOfDisplay) + '</div>'
    + '<div class="stock-cards">'
    + '<div class="stock-card stock-card--now">'
    + '<div class="stock-card-head"><span class="stock-dot"></span><span class="stock-card-title">Mine now · can sell today</span></div>'
    + '<div class="stock-card-value">' + esc(v.sellableNowDisplay) + '</div>'
    + '<div class="stock-card-sub">' + esc(v.heldSharesDisplay) + ' · gain <span class="' + v.stockNowGainClass + '">'
    + esc(v.stockNowGainDisplay) + ' (' + esc(v.stockNowGainPctDisplay) + ')</span></div>'
    + '<div class="stock-lines">'
    + '<div class="stock-line"><span class="stock-line-label">Vested RSU · ' + esc(v.rsuNowQtyDisplay) + '</span><span class="stock-line-value">' + esc(v.rsuNowValueDisplay) + '</span></div>'
    + '<div class="stock-line"><span class="stock-line-label">ESPP · ' + esc(v.esppNowQtyDisplay) + '</span><span class="stock-line-value">' + esc(v.esppNowValueDisplay) + '</span></div>'
    + '<div class="stock-line"><span class="stock-line-label">+ Cash</span><span class="stock-line-value">' + esc(v.stockCashDisplay) + '</span></div>'
    + '</div></div>'
    + '<div class="stock-card stock-card--later">'
    + '<div class="stock-card-head"><span class="stock-lock">🔒</span><span class="stock-card-title">Coming later · if I stay</span></div>'
    + '<div class="stock-card-value">' + esc(v.unvestedTotalDisplay) + '</div>'
    + '<div class="stock-card-sub">' + esc(v.unvestedUnitsDisplay) + ' unvested</div>'
    + '<div class="stock-lines">'
    + v.vestingByYear.map(function (vy) {
      return '<div class="stock-line"><span class="stock-line-label">Vests ' + esc(vy.label) + '</span>'
        + '<span class="stock-line-value">' + esc(vy.valueDisplay) + '</span></div>';
    }).join('')
    + '</div></div>'
    + '</div>'
    + (v.hasEspp
      ? '<div class="espp-note"><div class="espp-note-title">ESPP discount earned — if you sold today</div>'
        + '<div class="espp-note-row">'
        + '<span class="espp-gain ' + v.esppGainClass + '">' + esc(v.esppGainDisplay) + '</span>'
        + '<span class="espp-pct ' + v.esppGainClass + '">' + esc(v.esppGainPctDisplay) + '</span>'
        + '<span class="espp-detail">' + esc(v.esppNowValueDisplay) + ' value − ' + esc(v.esppPaidDisplay) + ' paid</span>'
        + '</div></div>'
      : '<div class="espp-empty"><div class="espp-empty-text">You currently hold <strong>no ESPP shares</strong> — past ESPP purchases were sold. Everything sellable today is vested RSU. Add an ESPP lot in <strong>Manage</strong> if you still hold some.</div></div>')
    + '<div class="whatif">'
    + '<div class="whatif-head"><span class="whatif-title">What if ' + esc(v.stockSymbol || 'it') + ' trades at…</span>'
    + '<span class="whatif-price" id="scenario-price">$' + esc(v.stockScenarioPriceDisplay) + '</span></div>'
    + '<div class="slider-wrap">'
    + '<div class="slider-track"></div>'
    + '<div class="slider-fill" id="scenario-fill" style="width:' + v.scenarioFillPct + '%"></div>'
    + '<input class="slider-input" type="range" min="' + v.scenarioSliderMin + '" max="' + v.scenarioSliderMax + '" step="1"'
    + ' data-f="stockScenario" value="' + esc(v.stockScenarioValue) + '">'
    + '</div>'
    + '<div class="slider-scale"><span>$' + v.scenarioSliderMin + '</span><span>$' + v.scenarioSliderMax + '</span></div>'
    + '<div class="whatif-cards">'
    + '<div class="whatif-card"><div class="whatif-label">Sellable today would be</div>'
    + '<div class="whatif-value teal" id="scenario-sellable">' + esc(v.scenarioSellableDisplay) + '</div></div>'
    + '<div class="whatif-card"><div class="whatif-label">Unvested would be</div>'
    + '<div class="whatif-value slate" id="scenario-unvested">' + esc(v.scenarioUnvestedDisplay) + '</div></div>'
    + '</div></div>');

  var hf = state.holdingForm;
  var vf = state.vestingForm;
  var pf = state.stockPriceForm;

  var manageBody = when(manage,
    '<div class="panel-solid">'
    + '<div class="panel-title">Stock price &amp; cash</div>'
    + '<div class="stock-fetch-form">'
    + field('Alpha Vantage key', textInput('stockApiKey', state.stockApiKey, ' type="password" placeholder="paste your free key"'))
    + '<button class="btn-ghost btn-ghost--tight" data-act="fetchStockPrice">Fetch latest close</button>'
    + '</div>'
    + '<p class="panel-note mb-14">Looks up the latest daily close for the Symbol below via '
    + '<a href="https://www.alphavantage.co/" target="_blank" rel="noopener">Alpha Vantage</a> (free key) and fills '
    + 'Current Price and As Of — review, then click Update.'
    + when(state.stockApiKeyFromEnv, ' Prefilled from your local <code>config/.env</code>.')
    + '</p>'
    + '<div class="stock-price-form">'
    + field('Symbol', textInput('stockSymbol', pf.symbol, ' placeholder="' + esc(v.stockSymbol) + '"'))
    + field('Current Price (USD)', numInput('stockPrice', pf.currentPrice, ' placeholder="' + esc(v.stockPriceDisplay) + '"'))
    + field('Cash (USD)', numInput('stockCash', pf.cash, ' placeholder="' + esc(v.stockCashDisplay) + '"'))
    + field('As Of', dateInput('stockAsOf', pf.asOf))
    + '<button class="btn-p btn-p--tight btn-p--teal" data-act="applyStockPriceUpdate">Update price</button>'
    + '</div>'
    + '<div class="panel-note">Updating the price recomputes every holding value, vesting value and the what-if slider at once.</div>'
    + '</div>'

    + '<div class="subhead">Holdings you can sell now</div>'
    + '<p class="subhint">Vested RSU and ESPP shares sitting in your brokerage. Value = Quantity × current price; gain = value − cost basis.</p>'
    + '<div class="form-grid holding-form">'
    + field('Source', selectInput('holdingSource', options(['Vested RSU', 'ESPP'], hf.source), '', 'white'))
    + field('Label', textInput('holdingLabel', hf.label, ' placeholder="RSU vest"'))
    + field('Quantity', numInput('holdingQuantity', hf.quantity))
    + field('Cost Basis (USD)', numInput('holdingCost', hf.cost))
    + field('Acquired', dateInput('holdingAcquired', hf.acquired))
    + field('Tag', selectInput('holdingTag', options(v.tagOptions, hf.tag || TAG_SAVING_OTHER)))
    + submitPair('submitHoldingForm', 'cancelHoldingForm', hf.mode === 'edit' ? 'Save changes' : 'Add lot', hf.mode === 'edit', 'btn-row btn-row--sm')
    + '</div>'
    + dataTable({
      tableClass: 'mb-32',
      columns: [
        { label: 'Source', cls: 'wide' }, { label: 'Label', cls: 'wide' }, { label: 'Quantity', cls: 'wide right' },
        { label: 'Cost basis', cls: 'wide right' }, { label: 'Value now', cls: 'wide right' },
        { label: 'Gain', cls: 'wide right' }, { label: 'Tag', cls: 'wide' }, { label: '', cls: 'wide right' },
      ],
      rows: v.holdingRows,
      cells: function (r) {
        return '<td class="td-x"><span class="pill-source ' + r.sourceClass + '">' + esc(r.source) + '</span></td>'
          + '<td class="td-x">' + esc(r.label) + '</td>'
          + '<td class="td-x num">' + esc(r.quantityDisplay) + '</td>'
          + '<td class="td-x num">' + esc(r.costDisplay) + '</td>'
          + '<td class="td-x num">' + esc(r.valueDisplay) + '</td>'
          + '<td class="td-x num bold ' + r.gainClass + '">' + esc(r.gainDisplay) + '</td>'
          + '<td class="td-x">' + esc(r.tagDisplay) + '</td>';
      },
      rowActions: { editAct: 'editHolding', deleteAct: 'deleteHolding', tdClass: 'td-x' },
    })

    + '<div class="subhead">Vesting schedule (not yours yet)</div>'
    + '<p class="subhint">Unvested RSU units that vest on future dates. Value = Units × current price.</p>'
    + '<div class="form-grid vesting-form">'
    + field('Vest Date', dateInput('vestingDate', vf.date))
    + field('Grant', textInput('vestingGrant', vf.grant, ' placeholder="Grant ID"'))
    + field('Units', numInput('vestingUnits', vf.units))
    + submitPair('submitVestingForm', 'cancelVestingForm', vf.mode === 'edit' ? 'Save changes' : 'Add vesting', vf.mode === 'edit', 'btn-row btn-row--sm')
    + '</div>'
    + dataTable({
      columns: [
        { label: 'Vest date', cls: 'wide' }, { label: 'Grant', cls: 'wide' }, { label: 'Units', cls: 'wide right' },
        { label: 'Value', cls: 'wide right' }, { label: '', cls: 'wide right' },
      ],
      rows: v.vestingRows,
      cells: function (r) {
        return '<td class="td-x">' + esc(r.date) + '</td>'
          + '<td class="td-x">' + esc(r.grant) + '</td>'
          + '<td class="td-x num">' + esc(r.unitsDisplay) + '</td>'
          + '<td class="td-x num">' + esc(r.valueDisplay) + '</td>';
      },
      rowActions: { editAct: 'editVesting', deleteAct: 'deleteVesting', tdClass: 'td-x' },
    }));

  return '<h2 class="page-title page-title--sub">Stocks</h2>'
    + '<p class="hint mb-16">RSU grants &amp; ESPP. All values in USD, shown apart from your EGP totals.</p>'
    + tabBar('stock', manage, true)
    + overview + manageBody;
}
