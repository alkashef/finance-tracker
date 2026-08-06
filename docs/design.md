# Design & architecture

How the app is built. For the business rules it implements see
[functional-reqs.md](functional-reqs.md); for how to run it see the
[README](../README.md).

## Shape of the thing

A static site with no build step, no bundler, and no backend, served as-is:

| Path | Contains |
| --- | --- |
| `index.html` | The page shell: `<head>` metadata, the favicon, the four `<link>` stylesheets (cascade order matters — see below), the Google Identity Services `<script>`, an empty `#sidebar` and `#main`, and `<script type="module" src="src/app.js">`. Nothing else — every screen is rendered by JS. |
| `src/css/` | All styling, split into four cascade-ordered files — see below. |
| `src/app.js` | The entry module: the render loop (with the by-hand focus/caret/scroll restoration a template-string render loop needs), event delegation, and boot. |
| `src/js/` | Everything else, one file per concern: `format.js`, `constants.js`, `state.js`, `sheets.js`, `marketData.js`, `model.js`, `views.js` (a barrel — the screens themselves live under `views/*.js`), `actions.js`. |

`src/app.js` and `src/js/*.js` are plain ES modules (`<script type="module">`),
resolved by the browser with no bundler and no transpile — still no build step. They
used to be one classic script wrapped in an IIFE; that was originally to keep
`index.html` working when opened directly from disk over `file://`, but **that reason
never actually held**: OAuth requires an origin registered in Google Cloud Console and
`file://` reports origin `null`, which cannot be registered, so the app has always
needed a served origin.

The module graph is a DAG — `format → constants → state → sheets → marketData → model
→ views → actions → app` — because a circular import leaves a binding `undefined` at
evaluation time rather than failing at the call site. `marketData.js` has no imports of
its own (it takes a key/symbol/currency and returns a plain value or throws), so its
only real constraint is sitting upstream of `actions.js`, the one file that calls it;
it's placed next to `sheets.js` because both are "talk to an external HTTP API" modules.
Two places need a function that lives
strictly downstream and can't import it without creating a cycle back to themselves;
both are resolved the same way, a small indirection wired in after import rather than
at definition:

- `state.js`'s `set()` / `setForm()` / `toggle()` call `render()`, which lives in
  `app.js` (the last file in the graph, since it needs the DOM elements and the view
  builders). `state.js` exports a `setRenderer(fn)` hook instead of importing `render`
  directly; `app.js` calls it as the first line of `boot()`.
- `ENTITIES.transactions.after` (`constants.js`) and `fields.stockScenario`
  (`actions.js`) both need a function one or two files downstream — the ledger
  recompute in `model.js`, and the what-if slider's readout updater in `app.js`.
  Both are patched onto the already-built descriptor/map right after the file that
  defines the function they need is imported.

### `src/css/`

Four files, `<link>`ed in `index.html` in cascade order — **the order is load-bearing
and this is the only place it's recorded**:

| File | Contains |
| --- | --- |
| `base.css` | Reset, `:root` design tokens (brand colours, font sizes, border radii), `body`, links, layout, the sidebar. |
| `components.css` | Buttons, inputs, tables, tabs, pills, stat cards, chevrons, page furniture (titles/hints/banners), gain/loss/flag value colours. |
| `screens.css` | Dashboard, stocks, certificates, plan, ledger, settings — styling specific to one screen. |
| `utilities.css` | The `.mb-*` spacing helpers — loaded last, so a utility class always wins the cascade over a component's own margin. |

Repeated literals — brand colours, the four font sizes, the three border radii, the
border grey — are `:root` custom properties defined once in `base.css` and consumed
everywhere else as `var(...)`. Not every literal was tokenized: `#fff` backgrounds and
a handful of one-off border radii were left as plain values because they weren't the
ones actually repeating.

## Rendering model

There is no framework. One `state` object (`src/js/state.js`) is the single source of
truth, mirroring what the app needs across every screen. The cycle is:

1. A handler mutates `state` and calls `render()` (`src/app.js`).
2. `render()` builds a view model (`buildViewModel()`, `src/js/model.js`) — a plain
   object of already-formatted display strings and row arrays, with no functions or
   style strings in it.
3. `viewSidebar()` and `viewMain()` (`src/js/views.js`, a barrel over `views/*.js`)
   turn that view model into HTML strings, and `render()` assigns them with
   `innerHTML`.

Screens are chosen by `state.activeSheet` in `viewScreen()`. Per-account ledgers use
the pseudo-screen id `account:<name>`.

**`buildViewModel()` composes, it does not compute.** Every figure is produced by one
of twelve per-domain builders — `shellModel`, `navModel`, `listsModel`,
`transactionsModel`, `ledgerModel`, `goldModel`, `ratesModel`, `certificatesModel`,
`stocksModel`, `providentFundModel`, `dashboardModel`, `planModel` — and
`buildViewModel()` calls them in dependency order and merges their slices.

A builder takes `state` plus whatever it needs from the builders before it, and
returns the slice of the model its screens read. Two things cross domain boundaries
and are therefore passed explicitly rather than re-derived:

- **The shared intermediates.** `buildLedgers()` (every account's running ledger, read
  by the ledger screen and twice by the dashboard) and `buildRatesMap()` (currency →
  rate to EGP, read by certificates and the dashboard) are built once, up front.
- **The totals one domain owes another.** `goldModel`, `certificatesModel`,
  `stocksModel` and `providentFundModel` return `{ view, totals }` instead of a bare
  slice: `view` is merged into the model, `totals` is handed to `dashboardModel`, which
  runs last because savings-by-currency and the maturity watch are made of the other
  four domains' numbers.

No builder reads `state` outside its own argument and none mutates what it is handed —
sorts and reversals copy first, because the ledgers and the totals are shared. There is
deliberately no per-screen laziness or caching: the whole model is rebuilt on every
keystroke, which at this size costs nothing worth the complexity.

**Events are delegated**, not re-bound per render: two document-level listeners in
`src/app.js` dispatch on data attributes.

- `data-act="someAction"` on a clicked element → `actions.someAction(dataset)`.
  Row-level buttons carry `data-i="<index>"`; the certificate group toggle carries
  `data-k="<currency>"`.
- `data-f="someField"` on an input/select → `fields.someField(value)` on `input`.

Both maps (`actions`, `fields`) are built in `src/js/actions.js`.

**Most of both maps is generated from entity descriptors.** Eight of the ten entities
— transaction types, tags, transactions, plan, gold, certificates, stock holdings,
stock vesting — differ only in which sheet, headers, state keys and form fields they
touch, so each is described once in the `ENTITIES` object (`src/js/constants.js`) and
its handlers are built from that:

| Descriptor key | What it decides |
| --- | --- |
| `act` | the names in the markup: `edit<act>`, `cancel<act>Form`, `submit<act>Form`, `delete<act>` |
| `sheet`, `headers` | where the write lands and the column order it is projected through |
| `list`, `form` | the `state` keys holding the rows and the form |
| `emptyForm()` | a fresh blank form — the initial state value, what Cancel restores, and what a successful save leaves behind |
| `toForm`, `toRecord` | record ↔ form conversion |
| `toRow` | state item → the record `writeSheet()` projects; omitted where the item already is one |
| `validate` | `null` to save, a message to show, `''` to abort without one |
| `fields` | `data-f` attribute → the form key it sets |
| `after` | runs after a successful write (transactions invalidate every ledger) |
| `confirmDelete` | the prompt to raise first; only tags has one |

`edit`, `cancel` and `delete` are always generated. `submit` is generated too unless
the entity validates on its own terms — transactions (whether To Account is required
depends on the type), gold (a lot with no price inherits one) and certificates (the
form takes a percentage, the sheet stores a fraction) are written out by hand and call
`saveRecord()` for the shared tail. A field handler that rewrites what the user typed
is likewise written out; adding a *plain* field is a line in a descriptor's `fields`,
not a new handler. Generation refuses to shadow a hand-written name, so a collision
fails at boot rather than silently dropping the transform.

Two entities are deliberately not descriptor-driven and stay written out in full:

- **Accounts** — its records are Sheet *tabs*. Saving renames one, adding creates one,
  deleting removes one, it rejects duplicate names, navigates away if the deleted
  account's ledger is on screen, and writes three parallel maps as a single sheet.
- **Provident Fund** — a single record: no index, no list, no delete, no mode, so
  `edit`/`delete` have nothing to generalise over.

Because the whole pane is rebuilt on every keystroke, three things React used to give
for free are restored explicitly in `render()`:

- **Focus and caret**: `captureFocus()` records the focused control's `data-f`, its
  value and its selection range; `restoreFocus()` puts them back afterwards. If the
  handler reformatted the value (the amount field inserting thousands separators),
  the caret goes to the end instead — matching what React did.
- **Scroll position**: `scrollTop` of both panes is saved and restored.
- **Controlled inputs**: handlers that reject invalid input still call `render()`,
  so the DOM snaps back to the last accepted value.

The one exception to full re-render is the stock what-if slider. Replacing a range
input mid-drag drops the drag gesture, so its `input` handler updates
`state.stockScenarioPrice` and then writes only the dependent readouts
(`#scenario-price`, `#scenario-fill`, `#scenario-sellable`, `#scenario-unvested`)
directly. Everything it needs to do that is stashed on the view model as
`scenarioInputs`.

Re-rendering a pane per keystroke is fine at this scale — the tables hold dozens of
rows, not thousands. Resist adding a diffing layer unless that stops being true.

## Escaping

Views build HTML by string concatenation, so **every interpolated value goes through
`esc()`** — including attribute values. Sheet data is user-controlled input as far as
the page is concerned.

## How the Spreadsheet is accessed and edited

- Storage is a normal Google Sheet, one tab per data section, plus one tab per
  account holding that account's generated ledger.
- **The app holds no data of its own.** Nothing is seeded, ever: a missing tab is
  created empty, and the only rows written are ones the user entered (plus the
  derived ledgers). If a tab is empty, the corresponding screen is empty.

Row 1 of every tab is the header row; reads start at row 2. Columns, in order:

| Tab | Columns |
| --- | --- |
| `Accounts` | Account Name, Owner, Tag |
| `Transaction Types` | Transaction Type |
| `Tags` | Tag |
| `Transactions` | Date, Amount, Description, Transaction Type, From Account, To Account |
| `Gold` | Quantity, Type, Brand, Weight (gm), Where, Purchase Price per Gram (EGP), Purchase Date, Current Price per Gram (EGP), As Of, Tag |
| `Certificates` | Certificate Number, Product Name, Open Date, Amount, Currency, Interest Frequency, Maturity Date, Interest Rate, Tag |
| `Currency Rates` | Currency, Rate to EGP, As Of |
| `Provident Fund` | Balance, As Of, Tag (single row) |
| `Stock Meta` | Symbol, Current Price (USD), Cash (USD), As Of (single row) |
| `Stock Holdings` | Source, Label, Quantity, Cost Basis (USD), Acquired Date, Tag |
| `Stock Vesting` | Vest Date, Grant, Units |
| `Plan` | Step, Item, Status, Notes, Version |
| *per account* | Date, Description, Transaction Type, Amount, Balance (generated — do not edit) |

`Interest Rate` is stored as a fraction (`0.27`), while the form takes a percentage.
`Tag` accepts any value from the `Tags` tab; the dashboard only groups by the three
in `docs/functional-reqs.md`.

How the calls are made:

- The app talks to the **Google Sheets API v4** directly over `fetch`
  (`https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/...`) — no Google
  Apps Script, no server-side proxy.
- Reads are a single `values:batchGet` across all ranges. Writes are clear-then-PUT
  of a whole tab (`writeSheet`), so a row edit rewrites the tab.
- Tab creation/deletion/rename go through `:batchUpdate`; `sheetIdMap` caches tab ids
  after the first metadata call.
- Every read/write from the UI calls this API immediately; the Sheet is the single
  source of truth. "Refresh from Sheet" re-pulls all tabs, useful if the Sheet was
  edited by hand in the browser.
- **Gotcha**: cells the Sheet has typed as `Date` come back from the API as raw serial
  numbers, not strings — this breaks string-based comparisons/matching.
  `sheetsFmtDate()` converts these to ISO date strings on read. Prefer keeping
  date-like columns formatted as **Plain text** in the Sheet to avoid the
  serial-number path entirely; some legacy cells may still be typed as Date.
- Spreadsheet ID is user-provided in Settings and saved to `localStorage`
  (`financeTracker.config`), alongside the OAuth Client ID.

### Optional local defaults (`config/.env`)

On a dev copy, `config/.env` can supply starting values for the two connection fields
and, optionally, the GoldAPI.io and Alpha Vantage keys (`src/js/marketData.js`), so
they survive a cleared `localStorage`. `applyLocalDefaults()` (`src/app.js`) runs at
the end of `boot()`, after the first paint:

- It `fetch`es `config/.env` (resolved from `src/app.js`'s own module URL via
  `import.meta.url`, not the loading page's — `test/smoke.html` would otherwise ask
  for `test/config/.env`) and parses `KEY=value` lines with `parseEnv()`
  (`src/js/format.js` — a pure text transform, so it lives with the other
  no-DOM-no-state helpers and is importable on its own by `test/unit.html`): `#`
  comments, optional surrounding quotes, whitespace trimmed, reading four keys —
  `GOOGLE_OAUTH_CLIENT_ID`, `SPREADSHEET_ID`, `GOLDAPI-KEY` and `ALPHAVANTAGE-KEY`.
  Currency rates (`open.er-api.com`) need no key, so there is no fifth one for that.
- **It only fills empty fields, and all three concerns are independent.** The Sheets
  connection pair is only filled when *both* `clientIdInput` and `spreadsheetIdInput`
  are still empty (so `restoreConfig()` already having found a saved config skips
  them); `goldApiKey` and `stockApiKey` are each filled separately whenever that one is
  still empty, regardless of the other two. Either way, editing a value in the browser
  is not undone on reload — a `config/.env` change only takes effect again once the
  corresponding `localStorage` value is cleared.
- **It prefills, it never connects or fetches a price on its own.** Requesting a token
  outside a user gesture gets the popup blocked, so the user still presses "Save &
  Connect"; likewise a prefilled key still needs its own "Fetch latest…" button
  pressed. `state.fromLocalEnv` / `state.goldApiKeyFromEnv` / `state.stockApiKeyFromEnv`
  each drive a line disclosing where their value came from — on the Settings, Gold
  Manage and Stocks Manage screens respectively.
- Any failure — file absent, server refusing to serve dotfiles, unparseable content —
  is swallowed. A missing `config/.env` is the normal case and the only case the
  hosted site ever sees.

The file is gitignored; only `config/.env.example`, carrying placeholders, is tracked.
The Client ID and Spreadsheet ID are not credentials: the Client ID is public by design
and the Spreadsheet ID identifies a document without granting access to it (reading the
Sheet still requires an OAuth token for an account it is shared with). `GOLDAPI-KEY` and
`ALPHAVANTAGE-KEY` *are* real credentials — they are kept out of git the same way, but
treat them like any other API key.

`scripts/serve.ps1` serves dotfiles (unknown extensions fall back to
`application/octet-stream`, which `fetch().text()` is happy with). Static servers that
block dotfiles will simply 404, and the app falls back to the empty Settings form.

## How live market prices are fetched

`src/js/marketData.js` looks up three figures the user would otherwise type by hand:
the Egypt gold price (Gold's Manage screen), a stock's latest close (Stocks' Manage
screen) and a currency's rate to EGP (Certificates' Manage screen, where the shared
Currency Rates panel lives). This app has no backend, so each is a plain `fetch()` from
the browser straight to the provider — a provider that doesn't answer with CORS headers
simply will not work here, and that is a fact about the provider, not a bug in this
file.

| Figure | Provider | Endpoint | Key? |
| --- | --- | --- | --- |
| Gold, EGP/gram, 24k | [GoldAPI.io](https://www.goldapi.io/) | `GET /api/XAU/EGP`, `x-access-token` header | Yes, free tier |
| Stock close (USD) | [Alpha Vantage](https://www.alphavantage.co/) | `GET /query?function=GLOBAL_QUOTE&symbol=…&apikey=…` | Yes, free tier |
| Currency → EGP | [open.er-api.com](https://www.exchangerate-api.com/docs/free) | `GET /v6/latest/<currency>` | No |

Gold is priced as one market for every lot (see functional-reqs.md), so the fetch
always asks for 24k specifically — the one purity that fills the shared "current price"
field, the same one a manual entry would.

Each lookup splits into a pure `parse*` function (response JSON in, `{price, asOf}` /
`{rate, asOf}` out, throws a plain `Error` on anything unexpected — checked against the
JSON body's own error field, the same convention `sheets.js`'s `sheetsFetch()` uses,
rather than `res.ok`/`res.status`) and a thin `fetch*` wrapper around it. The parser is
what `test/unit.html` exercises directly with literal fixture JSON; the wrapper is what
`actions.js`'s `fetchGoldPrice` / `fetchStockPrice` / `fetchRate` call.

**Fetching never writes the Sheet.** All three actions only fill the same form fields a
manual entry would (`goldPriceForm`, `stockPriceForm`, `rateForm`) — the user still
presses "Update price for all lots" / "Update price" / "Set rate" to persist, same as
typing the number in by hand. This is deliberate: a flaky or misread response from a
third-party API gets a chance to be reviewed before it overwrites the Sheet, which is
the single source of truth.

**The Market Prices screen** (`src/js/views/prices.js`, sidebar's Settings group,
`activeSheet: 'prices'`) is a fourth, read-only consumer of `marketData.js`: its
`checkTodaysPrices` action (`actions.js`) fetches gold, the Stocks screen's Symbol and
every currency already on the Currency Rates panel all at once, and holds the results
in their own state slice, `state.priceCheck` — never `goldPriceForm` / `stockPriceForm`
/ `rateForm`, so a check here can never disturb an edit in progress on the Gold,
Stocks or Certificates Manage screens, and this screen writes nothing to the Sheet at
all. Each leg (gold, stock, one per currency) is caught independently — `{ price /
rate, asOf }` on success, `{ error }` on failure, `null` before the first check this
session — so a missing key or symbol on one leg is reported right there without
blocking the other two. It bypasses the usual `state.loading` / `state.error`
banner for this reason: three independent results need to render at once, which a
single global error message can't express.

**The two keys (GoldAPI.io, Alpha Vantage) live in `localStorage`**
(`financeTracker.marketDataKeys`), written by `fields.goldApiKey` / `fields.stockApiKey`
in `actions.js` on every keystroke and restored by `restoreConfig()` in `src/app.js`.
This is a separate `localStorage` key from `financeTracker.config` (the OAuth Client ID
/ Spreadsheet ID) on purpose: editing a market-data key never touches the Sheets
connection, and a key typed before a Sheet is ever connected still survives a reload.
Both keys can additionally be prefilled from `config/.env` (see below, `GOLDAPI-KEY` /
`ALPHAVANTAGE-KEY`). Neither key is ever written to the Sheet or committed to the
repo — same rule as the OAuth Client ID and Spreadsheet ID, just an independent pair
of fields.

## How auth works

- Uses **Google Identity Services (GIS)** OAuth 2.0 token flow
  (`google.accounts.oauth2`), loaded from Google's GIS script — not Google Apps
  Script, and not a full sign-in flow.
- Flow: the user pastes their own OAuth **Client ID** (Web application type, created
  in Google Cloud Console) into Settings. `initTokenClient` requests an access token
  scoped to `https://www.googleapis.com/auth/spreadsheets` via a **real OAuth popup**
  (not an iframe) — this avoids COOP/CORS sandbox restrictions that break
  iframe-based flows when served from GitHub Pages.
- The access token is held in memory (`state.accessToken`) with an expiry timestamp;
  `ensureToken()` reuses it until ~30s before expiry, then silently re-requests
  (prompting for consent only the first time). The token is **not** persisted to
  localStorage — only the Client ID and Spreadsheet ID are.
- Nothing is fetched on page load. A saved config restores the "connected" UI, but
  the first Sheets call — and therefore the OAuth popup — only happens on an explicit
  user action ("Save & Connect", "Refresh from Sheet"). This is deliberate: popups
  triggered without a user gesture get blocked.
- Setup the user must do once per Google Cloud project is in the
  [README](../README.md).

## Hosting

The whole tree is pushed to the `alkashef.github.io` GitHub Pages repo and served as
static files — no CI, no build pipeline, no export step. What is in this repo is what
runs. Because the app is now a real module graph, deployment has to carry every file
in `src/`: an import GitHub Pages 404s on is a blank page before first paint, not one
broken screen, so a push should always be followed by loading the live site once.

## History

`index.html` used to be a single ~4,700-line file generated by a Design Component
authoring tool: an inlined `dc-runtime` bundle, a `<x-dc>` template in a custom
directive syntax (`sc-if` / `sc-for` / `{{ }}`), a React/ReactDOM CDN dependency,
and every style written as an inline `style="..."` string computed in JS. That file
was build output, not source. It was replaced by three plain files — `index.html`,
`styles.css`, `app.js` — with the directive syntax, the runtime, and React gone, and
inline styles turned into CSS classes.

That three-file version itself accumulated the usual signs of a rewrite done in one
pass: a 2,278-line `app.js` in one IIFE, a 470-line flat `actions` object, a
399-line `buildViewModel()`. [plan.md](plan.md) is the record of the eight-milestone
refactor that worked through it — descriptor-driven CRUD for the eight repetitive
entities, `buildViewModel()` split into per-domain builders, `app.js` split into the
`src/js/` module graph described above, and `styles.css` split into `src/css/` with
design tokens replacing its repeated literals — while a golden-DOM/write-payload/
screenshot-hash safety net certified each step as behaviour-preserving. Every
mechanism described in this document above the History section reflects where that
refactor landed, not the original rewrite.
