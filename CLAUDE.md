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
- `scripts/test.ps1` — the automated runner: serves the repo on a free port, drives
  every `test/*.html` harness through headless Edge for every scenario, prints one
  pass/fail summary, exits 0/1. `-Update` recaptures `test/golden.json`; nothing else
  may touch it. References `serve.ps1` at the repo root until Milestone 2 of
  `docs/plan.md` moves it into `scripts/`.
- `test/smoke.html` — drives every screen against a stubbed Sheets API, checks the
  behaviours the render loop restores by hand (focus, caret, scroll, controlled
  inputs) and that no data gets invented.
- `test/golden.html` — walks every screen and both tabs, serializes the rendered
  `#sidebar`/`#main` HTML, and either compares it to `test/golden.json` or (with
  `?update=1`) emits a fresh capture. Also runs the CSS coverage check: every class
  name touched by the walk vs. every class selector `styles.css` defines.
- `test/golden.json` — the committed DOM baseline `test/golden.html` compares
  against. Rewritten only by `scripts/test.ps1 -Update`; review the diff before
  committing it — a baseline captured after a change certifies the change.
- `test/fixtures.js`, `test/harness.js` — the fake Sheet data and the stubbed
  Sheets-API/OAuth `fetch`, shared by `smoke.html` and `golden.html` so both harnesses
  drive the app against identical invented data.
- `config/.env.example` — template for an untracked `config/.env` that prefills the
  Client ID / Spreadsheet ID locally. The real file is gitignored and never deployed.
- `README.md` — what the app is and how to run it.
- `docs/functional-reqs.md` — business rules.
- `docs/design.md` — architecture, Sheet tab/column layout, Sheets access, auth.
- `docs/plan.md` — the live refactoring plan: the milestones that remove the code
  smells left after the app was rewritten off its original design tool (that rewrite
  itself is done; its record lives in `docs/design.md`'s History section).

Every file here is a normal hand-editable source. Nothing is generated; there is no
export step and no "do not edit" file.

## Conventions

- **No data in the app.** The Sheet is the only source of truth. Never add seed rows,
  sample holdings, default balances, a fallback spreadsheet ID, or anything else that
  puts the user's figures into source. Missing tabs are created empty and stay empty.
  This is a hard rule — the repo is on GitHub.
  The **one** carve-out: `config/.env` is an untracked, local-only file that prefills
  the two connection fields (see `docs/design.md`). It works precisely because it is
  gitignored — only `config/.env.example` with placeholders is committed. Don't extend
  it to hold anything else, don't add a tracked fallback if it's missing, and never
  commit a real one.
- **No build tooling.** No npm install to run it, no bundler, no transpile. `app.js`
  is currently one classic script; the reason for that (working from `file://`) is
  void, since OAuth needs a registered origin and `file://` reports origin `null`.
  Plain `<script type="module">` is therefore allowed — the browser resolves the
  imports, so it is still no build step. Milestone 6 in `docs/plan.md` does that
  split; until it lands, don't add modules piecemeal.
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

`powershell -ExecutionPolicy Bypass -File scripts\test.ps1` is the fast path: it
starts its own server on a free port, drives `test/smoke.html` and `test/golden.html`
through headless Edge for every scenario, and prints one pass/fail summary (exit
0/1). It needs Microsoft Edge installed and nothing else. A refactor is
behaviour-preserving by definition, so `test/golden.html` comparing the rendered HTML
byte-for-byte against the committed `test/golden.json` is the real check — a green
smoke run alone only proves the app still boots.

`-Update` is the **only** thing allowed to rewrite `test/golden.json`; review the diff
before committing it, since a baseline captured after a change certifies the change,
not that nothing changed.

To drive a harness by hand: serve the repo (`npx serve . -l 8723`, or `powershell
-ExecutionPolicy Bypass -File serve.ps1`) and open
<http://localhost:8723/test/smoke.html>. It stubs the Sheets API and OAuth, drives
every screen, and reports pass/fail in the page — no network or Google account needed.
`?scenario=empty` checks the empty-Sheet path, `?env=1` the `config/.env` prefill path.

Extend `test/smoke.html` when you add a screen or a field, and `test/golden.html`'s
screen walk if you add a screen or a tab. Beyond that, cover both the Overview and
Manage tab of anything you touched, and re-check typing in text inputs (caret
position), the search box, and dragging the what-if slider — those are the behaviours
the render loop restores by hand and the ones most likely to regress.

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
