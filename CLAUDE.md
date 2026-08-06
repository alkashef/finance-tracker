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
  `<link>`/`<script type="module">` tags. No screen markup lives here.
- `src/css/base.css`, `components.css`, `screens.css`, `utilities.css` — all styling,
  as ordinary CSS classes plus a `:root` token block in `base.css`. `<link>`ed in
  `index.html` in that order — **the order is load-bearing**, `utilities.css` must
  load last. See [design.md](docs/design.md) for what's in each file.
- `src/app.js` — the entry module: render loop (with the by-hand focus/caret/scroll
  restoration a template-string render loop needs), event delegation, boot.
- `src/js/format.js`, `constants.js`, `state.js`, `sheets.js`, `marketData.js`,
  `model.js`, `views.js` (a barrel over `views/*.js`, one file per screen), `actions.js`
  — everything else: formatting helpers, entity descriptors, the state object, the
  Sheets/OAuth layer, the live gold/stock/currency price lookups, the view model, the
  screen views, the `actions`/`fields` maps. Plain ES modules, imported by
  `src/app.js`; the module graph is a DAG
  (`format → constants → state → sheets → marketData → model → views → actions → app`)
  — see [design.md](docs/design.md) for the two places that needed a small indirection
  to keep it that way, and for how `marketData.js` fetches live prices with no backend.
- `scripts/serve.ps1` — no-dependency local static server (`npx serve .` also works).
- `scripts/test.ps1` — the automated runner: serves the repo on a free port, drives
  every `test/*.html` harness through headless Edge for every scenario, prints one
  pass/fail summary, exits 0/1. `-Update` recaptures `test/golden.json`,
  `test/crud.json` and `test/screenshots.json`; nothing else may touch them.
- `test/smoke.html` — drives every screen against a stubbed Sheets API, checks the
  behaviours the render loop restores by hand (focus, caret, scroll, controlled
  inputs) and that no data gets invented.
- `test/golden.html` — walks every screen and both tabs, serializes the rendered
  `#sidebar`/`#main` HTML, and either compares it to `test/golden.json` or (with
  `?update=1`) emits a fresh capture. Also runs the CSS coverage check (every class
  name touched by the walk vs. every class selector across `src/css/*.css`) and, since
  the CSS token/split, the token-sweep, rule-count, computed-style and cascade-order
  checks a DOM-only snapshot can't see.
- `test/golden.json` — the committed DOM baseline `test/golden.html` compares
  against. Rewritten only by `scripts/test.ps1 -Update`; review the diff before
  committing it — a baseline captured after a change certifies the change.
- `test/crud.html` — drives add / edit / cancel / delete through the UI for all ten
  entities and compares the captured Sheets write payload against `test/crud.json`.
  Also checks, without reference to any baseline, that every write's header row
  matches the header constant for that sheet, that `confirm()` is raised exactly for
  the account and tag deletes, that ledgers are recomputed after transaction and
  account writes, and that the six transforming field handlers still transform.
- `test/crud.json` — the committed write-payload baseline. Same rule as
  `golden.json`: `scripts/test.ps1 -Update` and nothing else.
- `test/unit.html` — imports `src/js/*` directly (no DOM driving) and checks the
  per-domain view-model builders' arithmetic against a frozen `state` fixture,
  `buildViewModel()` purity, the small pure helpers (`gainClass`, `statCard`,
  `tabBar`, `dataTable`, `parseEnv`) at their boundary values, and that the module
  graph has no import cycle.
- `test/screenshots.html` — drives the app to one named screen (`?scenario=…&land=…`)
  and stops there; `scripts/test.ps1` screenshots it at a pinned window size and hashes
  the PNG against `test/screenshots.json`. Catches CSS-only rendering drift the DOM
  snapshot can't see.
- `test/screenshots.json` — the committed per-screen PNG-hash baseline. Same rule as
  `golden.json`: `scripts/test.ps1 -Update` and nothing else.
- `test/fixtures.js`, `test/harness.js` — the fake Sheet data and the stubbed
  Sheets-API/OAuth `fetch`, shared by `smoke.html`, `golden.html` and `crud.html` so
  every harness drives the app against identical invented data.
- `config/.env.example` — template for an untracked `config/.env` that prefills the
  Client ID / Spreadsheet ID locally. The real file is gitignored and never deployed.
- `README.md` — what the app is and how to run it.
- `docs/functional-reqs.md` — business rules.
- `docs/design.md` — architecture, the `src/` module and CSS layout, Sheet
  tab/column layout, Sheets access, auth.
- `docs/plan.md` — the refactoring plan (all eight milestones landed): the record of
  the work that removed the code smells left after the app was rewritten off its
  original design tool (that rewrite itself predates the plan; its record lives in
  `docs/design.md`'s History section).

Every file here is a normal hand-editable source. Nothing is generated; there is no
export step and no "do not edit" file.

## Conventions

- **No data in the app.** The Sheet is the only source of truth. Never add seed rows,
  sample holdings, default balances, a fallback spreadsheet ID, or anything else that
  puts the user's figures into source. Missing tabs are created empty and stay empty.
  This is a hard rule — the repo is on GitHub.
  The carve-out: `config/.env` is an untracked, local-only file that prefills the two
  connection fields and (optionally) the GoldAPI.io key, `GOLDAPI-KEY` (see
  `docs/design.md`). It works precisely because it is gitignored — only
  `config/.env.example` with placeholders is committed. Don't add a tracked fallback if
  it's missing, and never commit a real one. Extending it further should stay rare and
  deliberate — each key added is one more thing `.env.example`, `parseEnv()`'s callers
  and this doc all have to stay in sync on.
- **No build tooling.** No npm install to run it, no bundler, no transpile.
  `src/app.js` and `src/js/*.js` are plain ES modules — the browser resolves the
  imports itself, so this is still no build step. Import specifiers must be relative
  and carry `.js` (there's no resolver), and the module graph must stay a DAG
  (`format → constants → state → sheets → marketData → model → views → actions → app`,
  see `docs/design.md`) — a circular import leaves a binding `undefined` at evaluation
  time, not at the call site.
- **No backend, so live prices are fetched straight from the browser.** `marketData.js`
  calls GoldAPI.io, Alpha Vantage and open.er-api.com directly with `fetch()` — see
  `docs/design.md`. The two API keys this needs live in `localStorage`
  (`financeTracker.marketDataKeys`), same as the OAuth Client ID / Spreadsheet ID:
  never commit one, never add a tracked fallback. The GoldAPI.io key can additionally
  be prefilled from `config/.env` (`GOLDAPI-KEY`, see above); the Alpha Vantage key has
  no such prefill. A fetch only fills a form for review — it never writes the Sheet by
  itself.
- **No framework and no CDN dependencies** beyond the Google Identity Services script
  needed for OAuth. Don't reach for React, a template library, or a diffing layer;
  the render model in `docs/design.md` is deliberate.
- **Styling goes in `src/css/*.css` as classes**, in the cascade-ordered files
  `docs/design.md` describes — repeated literals (brand colours, font sizes, border
  radii) are `:root` tokens in `base.css`, consumed elsewhere as `var(...)`. Inline
  `style="..."` is only acceptable for a genuinely computed value (e.g. the scenario
  slider's fill width).
- **Escape everything interpolated into HTML** with `esc()`, attributes included.
  Views are built by string concatenation, so this is the only thing standing between
  Sheet data and injection.
- **Wire behaviour through delegation**, not inline handlers: `data-act` for clicks
  (with `data-i` / `data-k` for row context), `data-f` for input. Add the handler to
  the `actions` / `fields` map rather than attaching listeners inside a view.
- **Ordinary CRUD is a descriptor, not a handler.** Eight entities are generated from
  the `ENTITIES` object in `src/js/constants.js` — see the descriptor table in
  `docs/design.md`. A new plain field is one line in a descriptor's `fields`; a new
  ordinary entity is one descriptor, not four handlers. Write a handler out by hand
  only when it genuinely differs, as the three bespoke `submit`s and the six
  transforming field handlers do, and say in a comment what differs. Accounts and
  Provident Fund are not descriptors and are not to be converted into them.
- **Tags**: every account/gold-lot/certificate carries exactly one of `Spending`,
  `Saving > School`, `Saving > Other` — rules in `docs/functional-reqs.md`.

## Verifying a change

`powershell -ExecutionPolicy Bypass -File scripts\test.ps1` is the fast path: it
starts its own server on a free port, drives `test/smoke.html`, `test/golden.html`,
`test/crud.html` and `test/unit.html` through headless Edge for every scenario, hashes
a screenshot of every screen against `test/screenshots.json`, and prints one pass/fail
summary (exit 0/1). It needs Microsoft Edge installed and nothing else. A refactor is
behaviour-preserving by definition, so the baseline comparisons are the real check —
`test/golden.html` on the rendered HTML, `test/crud.html` on what gets written back to
the Sheet, `test/screenshots.html` on the rendered *pixels* (catches a CSS-only change
the DOM snapshot is blind to), `test/unit.html` on `buildViewModel()`'s arithmetic and
the small pure helpers directly. A green smoke run alone only proves the app still
boots.

`-Update` is the **only** thing allowed to rewrite `test/golden.json`,
`test/crud.json` and `test/screenshots.json`; review the diff before committing it,
since a baseline captured after a change certifies the change, not that nothing
changed. `test/unit.html` has no such baseline file — its expectations are literal
values inline in the test.

To drive a harness by hand: serve the repo (`npx serve . -l 8723`, or `powershell
-ExecutionPolicy Bypass -File scripts/serve.ps1`) and open
<http://localhost:8723/test/smoke.html>. It stubs the Sheets API and OAuth, drives
every screen, and reports pass/fail in the page — no network or Google account needed.
`?scenario=empty` checks the empty-Sheet path, `?env=1` the `config/.env` prefill path.

Extend `test/smoke.html` when you add a screen or a field, `test/golden.html`'s screen
walk if you add a screen or a tab, `test/crud.html`'s `ENTITY_SPECS` if you add an
entity or change what one writes, and `test/unit.html` if you add a pure helper worth
checking directly. Beyond that, cover both the Overview and Manage tab of anything you
touched, and re-check typing in text inputs (caret position), the search box, and
dragging the what-if slider — those are the behaviours the render loop restores by
hand and the ones most likely to regress.

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
