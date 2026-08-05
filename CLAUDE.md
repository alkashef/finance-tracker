                                                                   # Finance Tracker — CLAUDE.md

## What this is

A personal finance tracker: accounts, transactions, gold, stocks, certificates,
provident fund, savings, currency rates, dashboard. It runs entirely in the browser
against a Google Sheet, is hosted as static files on **GitHub Pages**
(`alkashef.github.io`), and has **no build step** — what is in this repo is what runs.

Read [docs/design.md](docs/design.md) before changing app structure, and
[docs/functional-reqs.md](docs/functional-reqs.md) before changing any calculation.
Don't re-explain their contents here.

## Files

- `index.html` — page shell only: `<head>`, an empty `#sidebar` and `#main`, and the
  `<link>`/`<script src>` tags. No screen markup lives here.
- `styles.css` — all styling, as ordinary CSS classes.
- `app.js` — state, Sheets/OAuth calls, view model, screen views, render loop,
  handlers. One classic script in an IIFE.
- `README.md` — what the app is and how to run it.
- `docs/functional-reqs.md` — business rules (mirrors the in-app About page).
- `docs/design.md` — architecture, Sheets access, auth.
- `docs/plan.md` — the completed plan for the rewrite that produced this layout.

Every file here is a normal hand-editable source. Nothing is generated; there is no
export step and no "do not edit" file.

## Conventions

- **No build tooling.** No npm install, no bundler, no transpile, no ES modules —
  `index.html` must keep working when opened straight from disk over `file://`.
- **No framework and no CDN dependencies** beyond the Google Identity Services script
  needed for OAuth. Don't reach for React, a template library, or a diffing layer;
  the render model in `docs/design.md` is deliberate.
- **Styling goes in `styles.css` as classes.** Inline `style="..."` is only
  acceptable for a genuinely computed value (e.g. the scenario slider's fill width).
- **Escape everything interpolated into HTML** with `esc()`, attributes included.
  Views are built by string concatenation, so this is the only thing standing between
  Sheet data and injection.
- **Wire behaviour through delegation**, not inline handlers: `data-act` for clicks
  (with `data-i` / `data-k` for row context), `data-f` for input. Add the handler to
  the `actions` / `fields` map rather than attaching listeners inside a view.
- **Tags**: every account/gold-lot/certificate carries exactly one of `Spending`,
  `Saving > School`, `Saving > Other` — rules in `docs/functional-reqs.md`.

## Verifying a change

There is no test suite. To check work, drive the app in a real browser against a test
Spreadsheet, or stub `window.fetch` and `window.google.accounts.oauth2` and click
through the screens — the Sheets layer is the only thing needing network. Cover both
the Overview and Manage tab of any screen you touched, and re-check typing in text
inputs (caret position), the search box, and dragging the stock what-if slider: those
are the behaviours the render loop has to restore by hand.

## Keeping docs in sync

Whenever a change alters behaviour, architecture, or setup, update the doc that owns
it in the same change. Which doc owns what:

| Change | Doc to update |
| --- | --- |
| Behaviour or business logic (a rule, a formula, a default) | `docs/functional-reqs.md` — and the in-app About page in `app.js`, which must not drift from it |
| Architecture, render model, Sheets access, auth | `docs/design.md` |
| How to run or set the app up | `README.md` |
| Agent workflow, file layout, conventions | this file |

Don't re-inline moved content back into `README.md` or `CLAUDE.md` out of habit —
link to the owning doc instead.
