# Finance Tracker — CLAUDE.md

## What this is

A personal finance tracker: accounts, transactions, gold, stocks, certificates,
provident fund, savings, currency rates, dashboard. It runs entirely in the browser
against a Google Sheet, is hosted as static files on **GitHub Pages**
(`alkashef.github.io`), and has **no build step** — what is in this repo is what runs.

Read [docs/design.md](docs/design.md) before changing app structure, and
[docs/functional-reqs.md](docs/functional-reqs.md) before changing any calculation.
Don't re-explain their contents here.

## Git discipline

**Never commit or push unless the user explicitly asks in that message.** Not at the
end of a task, not "to be safe", not as a checkpoint — leave changes in the working
tree and say what you changed. The same goes for `git add`, branch creation, tags,
and anything else that writes to git history. Work on `main` unless told otherwise.

## Files

- `index.html` — page shell only: `<head>`, an empty `#sidebar` and `#main`, and the
  `<link>`/`<script src>` tags. No screen markup lives here.
- `styles.css` — all styling, as ordinary CSS classes.
- `app.js` — state, Sheets/OAuth calls, view model, screen views, render loop,
  handlers. One classic script in an IIFE.
- `serve.ps1` — no-dependency local static server (`npx serve .` also works).
- `test/smoke.html` — drives every screen against a stubbed Sheets API.
- `README.md` — what the app is and how to run it.
- `docs/functional-reqs.md` — business rules.
- `docs/design.md` — architecture, Sheet tab/column layout, Sheets access, auth.
- `docs/plan.md` — the completed plan for the rewrite that produced this layout.

Every file here is a normal hand-editable source. Nothing is generated; there is no
export step and no "do not edit" file.

## Conventions

- **No data in the app.** The Sheet is the only source of truth. Never add seed rows,
  sample holdings, default balances, a fallback spreadsheet ID, or anything else that
  puts the user's figures into source. Missing tabs are created empty and stay empty.
  This is a hard rule — the repo is on GitHub.
- **No build tooling.** No npm install to run it, no bundler, no transpile, no ES
  modules — `app.js` stays a classic script.
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

Serve the repo (`npx serve . -l 8723`, or `powershell -ExecutionPolicy Bypass -File
serve.ps1`) and open <http://localhost:8723/test/smoke.html>. It stubs the Sheets API
and OAuth, drives every screen, and reports pass/fail — no network or Google account
needed. `?scenario=empty` checks the empty-Sheet path.

Extend `test/smoke.html` when you add a screen or a field. Beyond it, cover both the
Overview and Manage tab of anything you touched, and re-check typing in text inputs
(caret position), the search box, and dragging the what-if slider — those are the
behaviours the render loop restores by hand and the ones most likely to regress.

Note that OAuth cannot work from `file://` (origin `null` can't be registered with
Google), so anything touching a real Sheet needs the localhost server.

## Keeping docs in sync

Whenever a change alters behaviour, architecture, or setup, update the doc that owns
it in the same change. Which doc owns what:

| Change | Doc to update |
| --- | --- |
| Behaviour or business logic (a rule, a formula, a default) | `docs/functional-reqs.md` |
| Architecture, render model, Sheet columns, Sheets access, auth | `docs/design.md` |
| How to run or set the app up | `README.md` |
| Agent workflow, file layout, conventions | this file |

Don't re-inline moved content back into `README.md` or `CLAUDE.md` out of habit —
link to the owning doc instead.
