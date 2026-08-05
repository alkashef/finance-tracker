# Finance Tracker — CLAUDE.md

## What this is
A personal finance tracker: accounts, transactions, gold, stocks, certificates,
provident fund, savings, currency rates, dashboard. **Single-file app**: `index.html`
bundles all HTML, CSS (inline styles), and JS into one file that runs entirely in the
browser — no build step, no server, no backend. It is hosted as a static file on
**GitHub Pages** (`alkashef.github.io`).

There is no local dev server requirement: open the HTML file directly, or serve it
statically. All state lives in the browser (localStorage for config) and in the
connected Google Sheet (the actual data store).

## Files
- `index.html` — **the app**, self-contained (all HTML template, inline-styled markup,
  and the component's JS logic in one file). This is both the editable source and the
  file that gets deployed as-is — there is no separate build/bundle step in this repo.
- `README.md` — user-facing run instructions and the full business-logic reference
  (mirrors the in-app About page). Keep it current — see "Keeping docs in sync" below.

## How the Spreadsheet is accessed and edited
- Storage is a normal Google Sheet, one tab per data section (Accounts, Transactions,
  Gold, Certificates, Provident Fund, Savings, Currency Rates, etc).
- The app talks to the **Google Sheets API v4** directly over `fetch`
  (`https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/...`) — no Google Apps
  Script, no server-side proxy.
- Every read/write from the UI (add/edit/delete a row) calls this API immediately; the
  Sheet is the single source of truth. "Refresh from Sheet" re-pulls all tabs, useful if
  the Sheet was edited by hand in the browser.
- **Gotcha**: cells the Sheet has typed as `Date` come back from the API as raw serial
  numbers, not strings — this breaks string-based comparisons/matching. The client
  converts these to ISO date strings on read. Prefer keeping date-like columns formatted
  as **Plain text** in the Sheet to avoid the serial-number path entirely; some legacy
  cells may still be typed as Date.
- Spreadsheet ID is user-provided in Settings and saved to `localStorage`
  (`financeTracker.config`), alongside the OAuth Client ID.

## How auth works
- Uses **Google Identity Services (GIS)** OAuth 2.0 token flow (`google.accounts.oauth2`),
  loaded from Google's GIS script — not Google Apps Script, and not a full sign-in flow.
- Flow: user pastes their own OAuth **Client ID** (Web application type, created in Google
  Cloud Console) into Settings. `initTokenClient` requests an access token scoped to
  `https://www.googleapis.com/auth/spreadsheets` via a **real OAuth popup** (not an
  iframe) — this avoids COOP/CORS sandbox restrictions that break iframe-based flows when
  served from GitHub Pages.
- The access token is held in memory (component state) with an expiry timestamp;
  `ensureToken()` reuses it until ~30s before expiry, then silently re-requests (prompt
  only on first consent). Token is **not** persisted to localStorage — only the Client ID
  and Spreadsheet ID are.
- Setup the user must do once per Google Cloud project: enable the Google Sheets API,
  create an OAuth Client ID (Web application), add the GitHub Pages origin to
  "Authorized JavaScript origins", and add themselves as a test user (while the OAuth
  consent screen is unpublished/in testing).

## Hosting
- The standalone HTML file is pushed to the `alkashef.github.io` GitHub Pages repo and
  served as a static file — no CI/build pipeline. Any change to app logic/UI happens in
  `Finance Tracker.dc.html`, then gets re-exported to `Finance Tracker (standalone).html`
  before pushing.

## Conventions
- All styling is inline (no CSS classes/stylesheets) — this is a constraint of the design
  tool the `.dc.html` source was authored in, not a stylistic choice; keep it consistent
  if hand-editing.
- Tags: every account/gold-lot/certificate carries exactly one of `Spending`,
  `Saving > School`, `Saving > Other` — see the in-app About page for the full rules
  (balances, gold math, certificate maturity math, currency rates).

## Known open item
Some older Sheet cells are still typed as Date (not Plain text), which triggers the
serial-number-read path above. Client-side conversion handles it, but converting those
cells to Plain text in the Sheet directly removes the edge case.

## Keeping docs in sync
`README.md` documents how to run the app and the full business logic (balances, gold
math, certificate maturity math, stock/RSU/ESPP math, currency rates — mirroring the
in-app About page). Whenever a change in this repo alters app behavior, business logic,
setup/run steps, or the file layout, update `README.md` in the same change — don't let
it drift from `index.html`.
