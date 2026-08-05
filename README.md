# AK47 Finance Tracker

A personal finance tracker — accounts, transactions, gold, stocks, certificates,
provident fund, and currency rates — that runs entirely in the browser with a Google
Sheet as the data store. No build step, no server, no backend.

## How to run

The app is three static files: `index.html`, `styles.css`, `app.js`. There is nothing
to install and no dev server required.

- **Locally**: open `index.html` directly in a browser, or serve the folder with any
  static file server (e.g. `npx serve .`).
- **Hosted**: the files are served as-is from GitHub Pages — deploying is just
  pushing them to the Pages-connected repo.

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

Signing in happens on your first explicit action — "Save & Connect", or "Refresh from
Sheet" on a later visit — never automatically on page load.

**Gotcha**: format date-like columns in the Sheet as **Plain text**. Columns typed
as `Date` come back from the Sheets API as raw serial numbers, which breaks
string-based date matching; the app converts these on read, but Plain text avoids
the issue entirely.

## Where things are documented

- **[docs/functional-reqs.md](docs/functional-reqs.md)** — every business rule:
  tagging, balances, gold and certificate math, currency rates, stocks, dashboard
  totals. Mirrors the in-app **About** page.
- **[docs/design.md](docs/design.md)** — architecture: the three-file layout, the
  render loop, how the Spreadsheet is read and written, and how auth works.
- **[CLAUDE.md](CLAUDE.md)** — conventions and workflow notes for AI agents working
  in this repo.
