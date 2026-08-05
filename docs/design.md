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
| `app.js` | Everything else: constants and seed data, formatting helpers, the state object, the OAuth + Sheets API layer, the view model, the screen views, the render loop, and the event handlers. |

`app.js` is a single classic script wrapped in an IIFE — deliberately not an ES
module, so `index.html` still works when opened directly from disk over `file://`
(ES modules are blocked by CORS there).

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

**Events are delegated**, not re-bound per render: two document-level listeners
dispatch on data attributes.

- `data-act="someAction"` on a clicked element → `actions.someAction(dataset)`.
  Row-level buttons carry `data-i="<index>"`; the certificate group toggle carries
  `data-k="<currency>"`.
- `data-f="someField"` on an input/select → `fields.someField(value)` on `input`.

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

- Storage is a normal Google Sheet, one tab per data section (Accounts, Transactions,
  Gold, Certificates, Provident Fund, Savings, Currency Rates, Stock Meta, Stock
  Holdings, Stock Vesting, Plan, Tags, Transaction Types), plus one tab per account
  holding that account's generated ledger.
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
