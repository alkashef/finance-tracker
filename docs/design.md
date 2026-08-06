# Design & architecture

How the app is built. For the business rules it implements see
[functional-reqs.md](functional-reqs.md); for how to run it see the
[README](../README.md).

## Shape of the thing

A static site with no build step, no bundler, and no backend. Three hand-written
files, served as-is:

| File | Contains |
| --- | --- |
| `index.html` | The page shell: `<head>` metadata, the favicon, `<link>` to the stylesheet, the Google Identity Services `<script>`, an empty `#sidebar` and `#main`, and `<script src="app.js">`. Nothing else — every screen is rendered by JS. |
| `styles.css` | All styling, as ordinary classes. |
| `app.js` | Everything else: constants and entity descriptors, formatting helpers, the state object, the OAuth + Sheets API layer, the view model, the screen views, the render loop, and the event handlers. |

`app.js` is a single classic script wrapped in an IIFE. That was originally to keep
`index.html` working when opened directly from disk over `file://`, but **that reason
no longer holds**: OAuth requires an origin registered in Google Cloud Console and
`file://` reports origin `null`, which cannot be registered, so the app has always
needed a served origin. ES modules cost nothing here and are still no build step —
splitting `app.js` into `js/*.js` modules is Part II Phase 9 of
[plan.md](plan.md#decision--split-the-js-into-es-modules--decided).

## Rendering model

There is no framework. One `state` object is the single source of truth, mirroring
what the app needs across every screen. The cycle is:

1. A handler mutates `state` and calls `render()`.
2. `render()` builds a view model (`buildViewModel()`) — a plain object of
   already-formatted display strings and row arrays, with no functions or style
   strings in it.
3. `viewSidebar()` and `viewMain()` turn that view model into HTML strings, and
   `render()` assigns them with `innerHTML`.

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

**Events are delegated**, not re-bound per render: two document-level listeners
dispatch on data attributes.

- `data-act="someAction"` on a clicked element → `actions.someAction(dataset)`.
  Row-level buttons carry `data-i="<index>"`; the certificate group toggle carries
  `data-k="<currency>"`.
- `data-f="someField"` on an input/select → `fields.someField(value)` on `input`.

**Most of both maps is generated from entity descriptors.** Eight of the ten entities
— transaction types, tags, transactions, plan, gold, certificates, stock holdings,
stock vesting — differ only in which sheet, headers, state keys and form fields they
touch, so each is described once in the `ENTITIES` object and its handlers are built
from that:

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
| `Stock Holdings` | Source, Label, Quantity, Cost Basis (USD), Acquired Date |
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

On a dev copy, `config/.env` can supply starting values for those two fields so they
survive a cleared `localStorage`. `applyLocalDefaults()` runs at the end of `boot()`,
after the first paint:

- It `fetch`es `config/.env`, parses `KEY=value` lines (`#` comments, optional
  surrounding quotes, whitespace trimmed) and reads exactly two keys —
  `GOOGLE_OAUTH_CLIENT_ID` and `SPREADSHEET_ID`.
- **It only fills empty fields.** If `restoreConfig()` already found a saved config,
  the fetch is skipped entirely, so editing Settings in the browser is not undone on
  reload. The corollary: once a config is saved, a changed `config/.env` has no effect
  until `localStorage` is cleared.
- **It prefills, it never connects.** Requesting a token outside a user gesture gets
  the popup blocked, so the user still presses "Save & Connect". `state.fromLocalEnv`
  drives a line on the Settings screen disclosing where the values came from.
- Any failure — file absent, server refusing to serve dotfiles, unparseable content —
  is swallowed. A missing `config/.env` is the normal case and the only case the
  hosted site ever sees.

The file is gitignored; only `config/.env.example`, carrying placeholders, is tracked.
Neither value is a credential: the Client ID is public by design and the Spreadsheet ID
identifies a document without granting access to it. Reading the Sheet still requires
an OAuth token for an account it is shared with.

`serve.ps1` serves dotfiles (unknown extensions fall back to
`application/octet-stream`, which `fetch().text()` is happy with). Static servers that
block dotfiles will simply 404, and the app falls back to the empty Settings form.

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

The three files are pushed to the `alkashef.github.io` GitHub Pages repo and served
as static files — no CI, no build pipeline, no export step. What is in this repo is
what runs.

## History

`index.html` used to be a single ~4,700-line file generated by a Design Component
authoring tool: an inlined `dc-runtime` bundle, a `<x-dc>` template in a custom
directive syntax (`sc-if` / `sc-for` / `{{ }}`), a React/ReactDOM CDN dependency,
and every style written as an inline `style="..."` string computed in JS. That file
was build output, not source. It was replaced by the three plain files above; the
directive syntax, the runtime, and React are gone, and inline styles became CSS
classes.
