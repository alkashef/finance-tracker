# AK47 Finance Tracker

A personal finance tracker — accounts, transactions, gold, stocks, certificates,
provident fund, and currency rates — in a single self-contained HTML file with
Google Sheets as the data store. No build step, no server, no backend.

## How to run

The entire app is `index.html`. There is no build, no dependencies to install, and
no dev server required.

- **Locally**: open `index.html` directly in a browser, or serve the folder with any
  static file server (e.g. `npx serve .`).
- **Hosted**: the file is served as-is from GitHub Pages — deploying is just pushing
  the file to the Pages-connected repo.

### One-time setup (per user, per Google Cloud project)

The app talks to the Google Sheets API v4 directly from the browser and needs your
own OAuth Client ID and Spreadsheet:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
   create (or pick) a project and enable the **Google Sheets API**.
2. Credentials → Create Credentials → **OAuth client ID**, type **Web application**.
3. Under **Authorized JavaScript origins**, add the origin you'll load the app from
   (e.g. `https://<you>.github.io`, or `http://localhost:<port>` for local use).
4. While the OAuth consent screen is unpublished/in testing, add your own Google
   account as a test user.
5. Copy the generated **Client ID**.
6. Create a Google Sheet with one tab per data section (Accounts, Transactions,
   Gold, Certificates, Provident Fund, Stocks, Currency Rates, etc.) and copy its
   **Spreadsheet ID** from its URL.
7. Open the app → Settings screen → paste the Client ID and Spreadsheet ID → Connect.

The Client ID and Spreadsheet ID are saved to `localStorage`
(`financeTracker.config`). The OAuth access token is kept in memory only (not
persisted) and is re-requested silently as it nears expiry.

**Gotcha**: format date-like columns in the Sheet as **Plain text**. Columns typed
as `Date` come back from the Sheets API as raw serial numbers, which breaks
string-based date matching; the app converts these on read, but Plain text avoids
the issue entirely.

## Business logic

Every rule this tracker uses to organize and calculate your money — this mirrors the
in-app **About** page.

### How everything is organized

Every account, gold lot, and certificate carries exactly one tag:

- **Spending** — day-to-day accounts you spend from.
- **Saving > School** — cash set aside for school.
- **Saving > Other** — everything else parked, not spent: Gold, Certificates, and any
  other savings cash.

Untagged items default to Spending (accounts) or Saving > Other (gold/certificates)
so nothing old goes missing.

### Accounts & Ledgers

- Each account's ledger (its running list of in/out amounts) is generated
  automatically from Transactions — you never edit a ledger directly.
- Balance = the running sum of every signed transaction touching that account,
  oldest to newest.
- Accounts are grouped by Owner on the Dashboard; accounts with no owner set show
  under "Unassigned".

### How a transaction affects balances

- **From + To set**: the amount leaves the From account (–) and lands in the To
  account (+).
- **From only, no To**: the amount is applied as-is to that account. Used for
  "Starting Balance" and "Plug" transaction types — the only two types that don't
  require a To Account.

### Gold

- Each lot's grams = Quantity × Weight (gm).
- Cost = grams × purchase price per gram. Current value = grams × current price per
  gram.
- Gain = current value − cost.
- "Update price for all lots" overwrites the current price/gm and as-of date on
  every lot at once — gold is priced as one market, not per-lot.

### Certificates

- Amount at maturity = Amount × (1 + Interest Rate) — a flat rate applied once,
  matching how the bank statement shows it (not compounded per period).
- EGP figures use each certificate's Currency converted through the shared Currency
  Rates table.
- Gain vs principal compares EGP-now to EGP-at-maturity across all certificates
  combined.
- **Maturity Watch** flags any certificate maturing within 60 days, or already
  matured, on the Dashboard.

### Currency rates

- One rate per currency (to EGP), shared across every certificate in that currency.
- Setting a new rate immediately recalculates every EGP figure that depends on it —
  old rates are overwritten, not kept as history.

### Stocks (RSU & ESPP)

- Values are all in USD, shown apart from EGP totals.
- **Sellable now** = vested RSU + ESPP holdings + cash. Holding value = Quantity ×
  current price; gain = value − cost basis.
- **Unvested** = future RSU vesting schedule, grouped by vest year. Value = Units ×
  current price.
- ESPP discount earned = current ESPP value − amount paid (only shown when ESPP
  shares are currently held).
- Updating the stock price recomputes every holding value, vesting value, and the
  "what if it trades at $X" scenario slider at once.

### Provident Fund

- A single balance + as-of date + tag, updated manually (not derived from
  transactions).

### Sync with Google Sheets

- This app is a single standalone HTML file — no server, no deployment. It runs
  entirely in your browser and talks to the Google Sheets API directly, with your
  connected Sheet as the only storage.
- Sign-in uses Google's own OAuth popup (not an embedded frame), so it works
  reliably straight from GitHub Pages. Every add/edit/delete writes straight to the
  Sheet through that authorized session.
- "Refresh from Sheet" re-pulls everything, useful if the Sheet was edited by hand.
- Transactions and CSV exports (Transactions page, and any ledger page) are
  available any time.

## Keeping this README up to date

This README must be updated whenever app behavior, business logic, or setup steps
change — see `CLAUDE.md` for the standing instruction to keep it in sync with the
code.
