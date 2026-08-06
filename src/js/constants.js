/* Sheet headers, tag constants, and the entity descriptors that drive
   descriptor-driven CRUD (see docs/design.md#rendering-model). */

import { formatAmountDisplay } from './format.js';

export var TX_HEADERS = ['Date', 'Amount', 'Description', 'Transaction Type', 'From Account', 'To Account'];
export var LEDGER_HEADERS = ['Date', 'Description', 'Transaction Type', 'Amount', 'Balance'];
export var PLAN_HEADERS = ['Step', 'Item', 'Status', 'Notes', 'Version'];
export var PLAN_STEP_LABELS = { '1': 'Step 1 — Consolidate', '2': 'Step 2 — Analyze', '3': 'Step 3 — Automate' };
export var GOLD_HEADERS = ['Quantity', 'Type', 'Brand', 'Weight (gm)', 'Where', 'Purchase Price per Gram (EGP)', 'Purchase Date', 'Current Price per Gram (EGP)', 'As Of', 'Tag'];
export var CERT_HEADERS = ['Certificate Number', 'Product Name', 'Open Date', 'Amount', 'Currency', 'Interest Frequency', 'Maturity Date', 'Interest Rate', 'Tag'];
export var RATE_HEADERS = ['Currency', 'Rate to EGP', 'As Of'];
export var STOCK_META_HEADERS = ['Symbol', 'Current Price (USD)', 'Cash (USD)', 'As Of'];
export var STOCK_HOLDINGS_HEADERS = ['Source', 'Label', 'Quantity', 'Cost Basis (USD)', 'Acquired Date'];
export var STOCK_VESTING_HEADERS = ['Vest Date', 'Grant', 'Units'];

/* The three tags the dashboard groups by. Not seed data: the grouping logic and
   the untagged-item defaults key off these exact strings. */

export var TAG_SPENDING = 'Spending';
export var TAG_SAVING_SCHOOL = 'Saving > School';
export var TAG_SAVING_OTHER = 'Saving > Other';
export var TAG_FALLBACK_OPTIONS = [TAG_SPENDING, TAG_SAVING_SCHOOL, TAG_SAVING_OTHER];

export var MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export var SCENARIO_MIN = 10;
export var SCENARIO_MAX = 80;
export var MATURITY_WATCH_DAYS = 60;

/* --- entity descriptors ---
 *
 * One descriptor per repetitive entity: the single place that knows a sheet's
 * name and header order, which state keys hold the list and the form, what an
 * empty form looks like, and how a record and a form convert into each other.
 * actions.js generates edit / cancel / delete from it, generates submit too when
 * `validate` and `toRecord` are present, and generates the one-line `fields`
 * entries from `fields`.
 *
 * Two entities are deliberately absent:
 *   Accounts — its records are Sheet *tabs*. Saving renames one, adding creates
 *     one, deleting removes one, and three parallel maps go out as a single
 *     sheet. A descriptor able to express that costs more than the duplication.
 *   Provident Fund — a single record: no index, no list, no delete and no mode,
 *     so edit/delete have nothing to generalise over.
 * Both stay written out by hand in actions.js.
 *
 * Keys:
 *   act        the name in the markup — edit<act>, cancel<act>Form,
 *              submit<act>Form, delete<act>.
 *   list/form  the state keys holding the rows and the form.
 *   emptyForm  returns a *fresh* blank form; it is the initial value in
 *              state.js, what Cancel restores, and what a successful save
 *              leaves behind.
 *   toForm     record -> form fields (mode and index are added by the handler).
 *   toRecord   form -> the item stored in state[list].
 *   toRow      state item -> the object writeSheet() projects through `headers`.
 *              Omitted where the state item is already that record.
 *   validate   form -> null to save, a message to show, '' to abort silently.
 *   fields     data-f attribute -> the form key it sets.
 *   after      runs after a successful write (transactions invalidate ledgers).
 *              Left unset here for `transactions`: it needs
 *              recomputeAndWriteAllLedgers from model.js, which — to keep the
 *              module graph a DAG (format -> constants -> state -> sheets ->
 *              model -> ...) — constants.js cannot import. actions.js, which
 *              already imports model.js, patches it onto the descriptor before
 *              anything can submit the transactions form.
 *   confirmDelete  item -> the prompt to raise before deleting it.
 */
export var ENTITIES = {
  types: {
    act: 'Type',
    sheet: 'Transaction Types',
    headers: ['Transaction Type'],
    list: 'types', form: 'typeForm',
    emptyForm: function () { return { mode: 'add', index: -1, name: '' }; },
    toForm: function (name) { return { name: name }; },
    toRecord: function (f) { return f.name.trim(); },
    toRow: function (name) { return { 'Transaction Type': name }; },
    validate: function (f, list) {
      var name = f.name.trim();
      if (!name) return '';
      if (f.mode !== 'edit' && list.indexOf(name) !== -1) return 'Type already exists.';
      return null;
    },
    fields: { typeName: 'name' },
  },

  tags: {
    act: 'Tag',
    sheet: 'Tags',
    headers: ['Tag'],
    list: 'tags', form: 'tagForm',
    emptyForm: function () { return { mode: 'add', index: -1, name: '' }; },
    toForm: function (name) { return { name: name }; },
    toRecord: function (f) { return f.name.trim(); },
    toRow: function (name) { return { Tag: name }; },
    validate: function (f, list) {
      var name = f.name.trim();
      if (!name) return '';
      if (f.mode !== 'edit' && list.indexOf(name) !== -1) return 'Tag already exists.';
      return null;
    },
    confirmDelete: function (name) {
      return 'Delete tag "' + name + '"? Items using it keep the old label until re-tagged.';
    },
    fields: { tagName: 'name' },
  },

  transactions: {
    act: 'Tx',
    sheet: 'Transactions',
    headers: TX_HEADERS,
    list: 'transactions', form: 'txForm',
    emptyForm: function () {
      return { mode: 'add', index: -1, date: '', amount: '', description: '', type: '', from: '', to: '' };
    },
    toForm: function (t) {
      return {
        date: t.Date, amount: formatAmountDisplay(t.Amount), description: t.Description,
        type: t['Transaction Type'], from: t['From Account'], to: t['To Account'],
      };
    },
    /* Every balance is derived from this sheet, so a write invalidates all of
       them. See the `after` note above — actions.js wires this in. submitTxForm
       is written out in actions.js: the To-Account rule. */
    fields: { txType: 'type', txDate: 'date', txDescription: 'description', txFrom: 'from', txTo: 'to' },
  },

  plan: {
    act: 'Plan',
    sheet: 'Plan',
    headers: PLAN_HEADERS,
    list: 'planItems', form: 'planForm',
    emptyForm: function () {
      return { mode: 'add', index: -1, step: '1', item: '', status: 'Not started', notes: '', version: '' };
    },
    toForm: function (p) {
      return { step: p.Step, item: p.Item, status: p.Status, notes: p.Notes || '', version: p.Version || '' };
    },
    toRecord: function (f) {
      return { Step: f.step, Item: f.item.trim(), Status: f.status, Notes: f.notes.trim(), Version: f.version.trim() };
    },
    validate: function (f) { return f.item.trim() ? null : ''; },
    fields: { planStep: 'step', planItem: 'item', planStatus: 'status', planNotes: 'notes', planVersion: 'version' },
  },

  gold: {
    act: 'Gold',
    sheet: 'Gold',
    headers: GOLD_HEADERS,
    list: 'goldItems', form: 'goldForm',
    emptyForm: function () {
      return {
        mode: 'add', index: -1, quantity: '', type: '', brand: '', weight: '', where: '',
        purchasePrice: '', purchaseDate: '', currentPrice: '', asOf: '', tag: TAG_SAVING_OTHER,
      };
    },
    toForm: function (it) {
      return {
        quantity: String(it.Quantity), type: it.Type, brand: it.Brand || '',
        weight: String(it['Weight (gm)']), where: it.Where || '',
        purchasePrice: String(it['Purchase Price per Gram (EGP)']), purchaseDate: it['Purchase Date'],
        currentPrice: String(it['Current Price per Gram (EGP)']), asOf: it['As Of'],
        tag: it.Tag || TAG_SAVING_OTHER,
      };
    },
    /* submitGoldForm is written out in actions.js: a lot saved with no current
       price inherits one from the most recently priced lot. */
    fields: {
      goldQuantity: 'quantity', goldType: 'type', goldBrand: 'brand', goldWeight: 'weight',
      goldWhere: 'where', goldPurchasePrice: 'purchasePrice', goldPurchaseDate: 'purchaseDate',
      goldTag: 'tag',
    },
  },

  certs: {
    act: 'Cert',
    sheet: 'Certificates',
    headers: CERT_HEADERS,
    list: 'certItems', form: 'certForm',
    emptyForm: function () {
      return {
        mode: 'add', index: -1, number: '', product: '', openDate: '', amount: '',
        currency: '', frequency: '', maturityDate: '', rate: '', tag: TAG_SAVING_OTHER,
      };
    },
    toForm: function (c) {
      return {
        number: c['Certificate Number'], product: c['Product Name'], openDate: c['Open Date'],
        amount: String(c.Amount), currency: c.Currency, frequency: c['Interest Frequency'],
        maturityDate: c['Maturity Date'], rate: String((parseFloat(c['Interest Rate']) || 0) * 100),
        tag: c.Tag || TAG_SAVING_OTHER,
      };
    },
    /* submitCertForm is written out in actions.js: the form takes a percentage,
       the sheet stores a fraction. */
    fields: {
      certNumber: 'number', certProduct: 'product', certOpenDate: 'openDate', certAmount: 'amount',
      certFrequency: 'frequency', certMaturityDate: 'maturityDate', certRate: 'rate', certTag: 'tag',
    },
  },

  holdings: {
    act: 'Holding',
    sheet: 'Stock Holdings',
    headers: STOCK_HOLDINGS_HEADERS,
    list: 'stockHoldings', form: 'holdingForm',
    emptyForm: function () {
      return { mode: 'add', index: -1, source: 'Vested RSU', label: '', quantity: '', cost: '', acquired: '' };
    },
    toForm: function (h) {
      return {
        source: h.Source || 'Vested RSU', label: h.Label || '', quantity: String(h.Quantity),
        cost: String(h['Cost Basis (USD)']), acquired: h['Acquired Date'] || '',
      };
    },
    toRecord: function (f) {
      return {
        Source: f.source, Label: f.label.trim(), Quantity: parseFloat(f.quantity),
        'Cost Basis (USD)': parseFloat(f.cost), 'Acquired Date': f.acquired,
      };
    },
    validate: function (f) {
      return (!parseFloat(f.quantity) || isNaN(parseFloat(f.cost))) ? 'Quantity and Cost Basis are required.' : null;
    },
    fields: {
      holdingSource: 'source', holdingLabel: 'label', holdingQuantity: 'quantity',
      holdingCost: 'cost', holdingAcquired: 'acquired',
    },
  },

  vesting: {
    act: 'Vesting',
    sheet: 'Stock Vesting',
    headers: STOCK_VESTING_HEADERS,
    list: 'stockVesting', form: 'vestingForm',
    emptyForm: function () { return { mode: 'add', index: -1, date: '', grant: '', units: '' }; },
    toForm: function (vest) {
      return { date: vest['Vest Date'] || '', grant: vest.Grant || '', units: String(vest.Units) };
    },
    toRecord: function (f) {
      return { 'Vest Date': f.date, Grant: f.grant.trim(), Units: parseFloat(f.units) };
    },
    validate: function (f) {
      return (!f.date || !parseFloat(f.units)) ? 'Vest Date and Units are required.' : null;
    },
    fields: { vestingDate: 'date', vestingGrant: 'grant', vestingUnits: 'units' },
  },
};
