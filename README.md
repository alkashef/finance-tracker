# AK47 Finance Tracker

A personal finance tracker — accounts, transactions, gold, stocks, certificates,
provident fund, and currency rates — that runs entirely in the browser with a Google
Sheet as the data store. No build step, no server, no backend.

**All your data lives in the Sheet.** The app ships with none of it: no accounts, no
balances, no spreadsheet ID. It reads what your Sheet contains and writes back only
what you enter.

## How to run

The app is static files — `index.html`, `src/css/*.css`, `src/app.js` and
`src/js/*.js` — served as-is. There is nothing to build and no dependencies to
install; `src/app.js` and `src/js/*.js` are plain ES modules the browser resolves
itself. See [docs/design.md](docs/design.md) for the full layout.

### You need a local web server (not `file://`)

Opening `index.html` by double-clicking it will draw the UI, but **Google sign-in will
fail**. A `file://` page has the origin `null`, and Google will not let you register
`null` as an "Authorized JavaScript origin". So to actually reach your Sheet, serve
the folder over `http://localhost`.

Two ways, pick either:

**Option A — `npx serve` (you have Node installed)**

```console
cd C:\Users\aalka\Github\finance-tracker
npx serve . -l 8723
```

`npx` ships with Node, so there is nothing to install first — the first run downloads
`serve` into a cache and reuses it after. Then open <http://localhost:8723>.

> If `npx` is "not recognized", your terminal was opened before Node was installed.
> Close it and open a new one. To check: `node --version` should print something like
> `v24.19.0`.

**Option B — `scripts/serve.ps1` (no Node needed)**

```console
powershell -ExecutionPolicy Bypass -File scripts/serve.ps1
```

A ~60-line PowerShell static server included in this repo. Same result, zero
dependencies. Use `-Port 8080` to change the port. Ctrl+C stops it.

**Hosted**: the whole tree is served as-is from GitHub Pages — deploying is just
pushing it to the Pages-connected repo. Push the whole tree together; a module the
push leaves out of date is a blank page before first paint, not one broken screen, so
load the live site once after deploying.

### One-time setup (per user, per Google Cloud project)

The app talks to the Google Sheets API v4 directly from the browser and needs your
own OAuth Client ID and Spreadsheet:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create (or pick) a project and enable the **Google Sheets API**.
2. Credentials → Create Credentials → **OAuth client ID**, type **Web application**.
3. Under **Authorized JavaScript origins**, add every origin you'll load the app
   from — `http://localhost:8723` for local use, and `https://<you>.github.io` for
   the hosted copy. Add both; they can coexist.
4. While the OAuth consent screen is unpublished/in testing, add your own Google
   account as a test user.
5. Copy the generated **Client ID**.
6. Create a Google Sheet and copy its **Spreadsheet ID** from the URL — it's the long
   string between `/d/` and `/edit`.
7. Open the app → Settings screen → paste the Client ID and Spreadsheet ID → Connect.

The Client ID and Spreadsheet ID are saved to `localStorage`
(`financeTracker.config`). The OAuth access token is kept in memory only (not
persisted) and is re-requested silently as it nears expiry.

Signing in happens on your first explicit action — "Save & Connect", or "Refresh from
Sheet" on a later visit — never automatically on page load.

### Skipping the retyping locally (optional)

On a local copy you can keep those two values — and, optionally, a GoldAPI.io and/or
Alpha Vantage key (see below) — in a file instead of pasting them each time you clear
site data:

```sh
cp config/.env.example config/.env      # then fill in your values
```

```ini
GOOGLE_OAUTH_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
SPREADSHEET_ID=1AbC...
GOLDAPI-KEY=
ALPHAVANTAGE-KEY=
```

The app reads it at startup and **prefills the Settings fields, and the Gold/Stocks
Manage screens' API key fields** — that's all. It still never connects, or fetches a
price, on its own (a token request or a fetch without a click gets the OAuth popup
blocked / just isn't triggered), and each screen says where its value came from.
Nothing else is read from the file; no financial data belongs in it. (Currency rates
need no key at all, so there's nothing to add here for that one.)

Two things to know:

- **A value you've already saved wins.** These are defaults for empty fields only —
  each independently, so a Sheets connection saved in an earlier session doesn't stop
  a key added to `.env` later from being picked up, or vice versa — so editing
  Settings or a key in the browser isn't undone on the next reload. To make a changed
  `config/.env` take effect again, clear the corresponding `localStorage` key.
- **`config/.env` is gitignored and never deployed.** The hosted copy has no such
  file — there you type every value into the app by hand once, as above. Only
  `config/.env.example`, with placeholders, is in the repo.

The Client ID and Spreadsheet ID aren't secrets: the Client ID is public by design, and
the Spreadsheet ID names a document without granting access to it. `GOLDAPI-KEY` and
`ALPHAVANTAGE-KEY` *are* real credentials (see below) — treat them like any other API
key. All four stay out of git because `config/.env` is gitignored, not because the
first two unlock anything.

### Optional: fetching live prices instead of typing them in

The Gold, Stocks and Certificates (Currency Rates) Manage screens each have a "Fetch
latest…" button that looks up a live figure instead of you typing it in — it only fills
the fields for you to review; you still press the usual Update/Set button to save.
Currency rates need nothing extra ([open.er-api.com](https://www.exchangerate-api.com/docs/free)
has no key). Gold and stocks each need a free API key, pasted once into the input next
to the button — like the Client ID and Spreadsheet ID, it's saved to `localStorage`
(`financeTracker.marketDataKeys`) and never leaves your browser except to the provider
it's for:

- **Gold** — a free key from [GoldAPI.io](https://www.goldapi.io/). Can also be
  prefilled from `config/.env` as `GOLDAPI-KEY` (see above).
- **Stocks** — a free key from [Alpha Vantage](https://www.alphavantage.co/support/#api-key).
  Can also be prefilled from `config/.env` as `ALPHAVANTAGE-KEY` (see above).

Skip either and just type the price in by hand, as before — nothing else about those
screens changes.

### Setting up the Sheet

Tabs are created automatically when missing, but they are never populated — you enter
your own data through the app or straight into the Sheet. The tabs used are:

`Accounts`, `Transaction Types`, `Tags`, `Transactions`, `Gold`, `Certificates`,
`Currency Rates`, `Provident Fund`, `Stock Meta`, `Stock Holdings`, `Stock Vesting`,
`Plan` — plus one tab per account, holding that account's generated ledger.

Row 1 of each tab is the header row; the app reads from row 2 down. Column order per
tab is listed in [docs/design.md](docs/design.md).

**Gotcha**: format date-like columns as **Plain text**. Columns typed as `Date` come
back from the Sheets API as raw serial numbers, which breaks string-based date
matching; the app converts these on read, but Plain text avoids the issue entirely.

## Checking a change

**Automated**: `powershell -ExecutionPolicy Bypass -File scripts\test.ps1` starts its
own server on a free port, drives `test/smoke.html`, `test/golden.html`,
`test/crud.html` and `test/unit.html` through headless Edge for every scenario, hashes
a screenshot of every screen against `test/screenshots.json`, and prints one pass/fail
summary. Needs Microsoft Edge installed; nothing else. `-Update` recaptures
`test/golden.json` (the DOM baseline), `test/crud.json` (the Sheets write-payload
baseline) and `test/screenshots.json` (the per-screen pixel-hash baseline) from the
current code — only do this after reviewing the diff, since a baseline captured after
a change certifies the change.

**By hand**: open <http://localhost:8723/test/smoke.html> with the server running. It
drives every screen against a stubbed Sheets API and reports pass/fail — no network, no
Google account needed. Add `?scenario=empty` to check the empty-Sheet path, or `?env=1`
to check the `config/.env` prefill path.

## Where things are documented

- **[docs/functional-reqs.md](docs/functional-reqs.md)** — every business rule:
  tagging, balances, gold and certificate math, currency rates, stocks, dashboard
  totals.
- **[docs/design.md](docs/design.md)** — architecture: the `src/` module and CSS
  layout, the render loop, Sheet tab/column layout, and how auth works.
- **[CLAUDE.md](CLAUDE.md)** — conventions and workflow notes for AI agents working
  in this repo.
