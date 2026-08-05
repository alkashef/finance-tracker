# Finance Tracker — plan

Status legend: **✅ done** · **⬜ not started** · **⚠️ done, but differently than planned**

| Part | What | Status |
| --- | --- | --- |
| Part I | Retire the DC runtime, split into plain HTML/CSS/JS, reorganize docs | **✅ done** |
| Part II | Remove code smells: duplication, dead code, long methods/class, oversized JS and CSS files | **⬜ not started** |

Part I shipped; it is kept below as the record of what was done and why.
**Part II is the live plan — start there.**
Every decision is settled — ES modules for the JS, separate `<link>` tags for the CSS,
a `src/` + `scripts/` layout, a dependency-free `scripts/test.ps1` runner with committed
baselines, and manual commits at each phase boundary. Each phase carries its own test
plan and a recommended model. **Start with the safety net, then Phase 5.**

---

## Part I — Rewrite off the design tool ✅ DONE

*Everything in this part is complete. Per-step outcomes are marked inline; deviations
are collected under "What actually happened" at the end of the part.*

### Why this is bigger than "split three files"

`index.html` today is not hand-written app code — it's a **compiled artifact**:

- **Lines 1–1897**: `dc-runtime`, a generated bundle (template compiler, `sc-if`/`sc-for`
  directive interpreter, a `StreamableComponent` React wrapper, CDN loader for
  React/ReactDOM from unpkg). The file itself says `// GENERATED from
  dc-runtime/src/*.ts — do not edit. Rebuild with \`cd dc-runtime && bun run build\``.
  That `dc-runtime/` source doesn't exist in this repo — only its compiled output,
  inlined.
- **Lines 1898–3224**: the app's UI, written in Design-Component template syntax
  inside `<x-dc>` — `sc-if value="{{ ... }}"`, `sc-for list="{{ ... }}"`,
  `{{ expression }}` interpolation, every element's look defined via inline
  `style="..."` strings built from state (e.g. `navStyleDashboard`). This is not
  plain HTML; it's markup for the DC template compiler above to consume.
- **Line 3225 on**: `<script type="text/x-dc" data-dc-script"><script>` containing
  `class Component extends DCLogic { ... }` — the real app logic (state, computed
  props, handlers, Sheets API calls, OAuth flow).

So "separate the CSS" and "separate the JS" can't be a mechanical cut-paste into
`styles.css` / `app.js` while keeping the rest as-is — there is no plain CSS to lift
(styles are inline strings computed in the logic class) and no plain JS to lift
(the logic class only runs inside the DC runtime's component model, and the
template only renders through the DC template compiler). Doing this properly means
**retiring the DC runtime and template syntax entirely** and rewriting the app as
plain HTML + CSS + vanilla JS (or a small hand-rolled render function) that does the
same thing. This plan treats that rewrite as the real first phase; everything else
depends on it.

### Guiding constraints (unchanged from today)

- Still a static site: no build step, no bundler, no npm install required to run it.
  GitHub Pages just serves files as-is.
- Still talks to Google Sheets API v4 directly via `fetch`, no backend.
- Still uses Google Identity Services OAuth popup flow, Client ID + Spreadsheet ID
  saved to `localStorage` under `financeTracker.config`.
- Behavior, business logic, and visual design should not change — this is a
  structural refactor, not a feature or design change. Anything that looks like a
  behavior change should be called out and confirmed separately, not folded in
  silently.

### Phase 1 — Rewrite: retire the DC runtime, produce plain HTML/CSS/JS  ✅ DONE

**Goal**: one `index.html` (markup + `<link>`/`<script src>` tags only), one
`styles.css`, one `app.js` (or a small number of clearly-named JS modules), all
hand-writable and hand-editable directly — no compiler, no `{{ }}` template syntax,
no generated runtime.

Steps:
1. ✅ Read the full DC logic class (`class Component extends DCLogic`, line ~3314 to
   end) and enumerate every piece of state, computed getter, and handler. This is
   the actual app behavior and becomes the spec for the rewrite — treat it as the
   ground truth, not the runtime or template scaffolding around it.
2. ✅ Read the full `<x-dc>` template (lines ~1898–3224) and map every `sc-if`/`sc-for`
   block and `{{ }}` binding to the piece of state/handler driving it. This becomes
   the spec for the plain-HTML structure and the render logic that keeps it in sync
   with state.
3. ✅ Decide the rewrite approach and get sign-off before writing code (see "Open
   decision" below) — this determines how much of steps 4–6 is "translate directive
   syntax" vs. "introduce a tiny framework."
4. ✅ Extract all inline `style="..."` strings (both static ones in the template and
   ones computed in the logic class, e.g. `navStyle()`, `goldGainCardBg`) into
   `styles.css` as classes. This is the biggest chunk of work — styling is 100%
   inline today, and CLAUDE.md currently documents that as a hard constraint of the
   design tool. Once the DC tool is out of the picture, that constraint no longer
   applies, and normal CSS classes/selectors are the natural replacement.
5. ✅ Rewrite the logic class as plain JS: same state shape, same computed values, same
   Sheets API / OAuth code (this part barely changes — it's already plain
   fetch/OAuth calls, not DC-specific), but driving a hand-rolled `render()` instead
   of the DCLogic/React contract.
6. ✅ Rewrite the template as plain HTML generation (template literals, or targeted DOM
   updates) replacing `sc-if`/`sc-for`/`{{ }}` with plain JS conditionals/loops —
   this is the piece that replaces React's diffing, so see the re-render strategy
   below.
7. ✅ Remove the React/ReactDOM unpkg CDN `<script>` tags entirely — no component
   framework, zero runtime dependencies besides the Google Identity Services script
   the app already loads for OAuth.
8. ⚠️ Verify byte-for-byte-equivalent behavior against the current app for every
   screen: Dashboard, Transactions, Gold, Certificates, Stocks, Provident Fund,
   Accounts, Transaction Types, Tags, Settings, About, per-account Ledger, CSV
   exports. Use the existing About page content (already captured in
   `docs/functional-reqs.md` per Phase 3) as the checklist.

**Decision: drop React.** No component framework, no virtual DOM, no CDN dependency
beyond the Google Identity Services script already required for OAuth. Rationale:
the app is form/table/tab heavy with no complex animations or highly interactive
widgets (the stock what-if slider is the one exception — a plain `oninput` handler
covers it fine), and the goal is plain, hand-editable files with zero build step —
React added a runtime dependency without buying much given how the DC template
layer was doing all the actual templating work anyway.

**Re-render strategy (replaces what React's diffing did):** since there's no vdom,
pick one explicit strategy up front rather than improvising per-screen:
- Keep the current app's coarse granularity: one `render(state)` per active screen
  (`activeSheet`) that rebuilds that screen's container via `innerHTML =` a template
  string, re-attaching event listeners each render (via delegated listeners on the
  container where practical, so re-render doesn't mean re-binding dozens of
  handlers).
- Full-page state → single source of truth in one JS object (mirrors the DCLogic
  `state` today), same shape as now; every handler mutates it and calls `render()`;
  no partial/optimistic UI beyond what exists today.
- Avoid over-engineering a diffing layer — the app's tables/forms are small enough
  (dozens of rows, not thousands) that `innerHTML` rebuild-on-change is fast enough
  and far simpler to reason about than hand-written DOM patching.

### Phase 2 — Cleanup pass  ✅ DONE

Once Phase 1 produces plain files:
- Remove every remaining trace of the design-tool origin: `x-dc`, `data-dc-script`,
  `__bundler_thumbnail` template, `ext-resource-dependency` helmet tags, DC-specific
  comments (`// GENERATED from dc-runtime/src/*.ts...`), the `sc-camel-view-box`
  artifact visible in the favicon SVG (line ~1900 — a leftover attribute-casing bug
  from the DC export step).
- Normalize naming/formatting now that hand-editing is the norm (consistent
  quote style, consistent indentation, no dead code left over from the rewrite).
- Confirm `.gitignore`/`.vscode/settings.json` don't reference the old file layout.
- Re-verify no file in the repo is still described as "do not hand-edit" or
  "build output" — after this phase, every file in the repo is a normal,
  hand-editable source file with no external generation step.

### Phase 3 — Docs reorganization  ✅ DONE

Split the current README.md content into three docs, each with a single
responsibility:

- **`docs/functional-reqs.md`** — all business logic, moved out of README.md:
  tagging rules (Spending / Saving > School / Saving > Other and untagged
  defaults), account & ledger balance rules, how a transaction affects balances
  (From+To vs. From-only), gold math (grams/cost/value/gain, bulk price update),
  certificate math (maturity formula, EGP conversion, gain vs. principal, Maturity
  Watch 60-day window), currency rate rules, stocks/RSU/ESPP math (sellable-now,
  unvested-by-year, ESPP discount, price-update recompute, what-if slider), and
  Provident Fund (manual balance/as-of/tag). This is the same content currently in
  README.md's "Business logic" section — move it, don't rewrite the substance,
  and keep it as the audience-facing mirror of the in-app About page.
- **`docs/design.md`** — all architecture/system-design content, moved out of
  CLAUDE.md: single-file static-site architecture (or new plain HTML/CSS/JS
  three-file architecture, post-Phase-1/2), no-build/no-backend hosting model on
  GitHub Pages, how the Spreadsheet is accessed and edited (Google Sheets API v4
  direct `fetch`, one tab per data section, "Refresh from Sheet" semantics, the
  Date-cell-serial-number gotcha and Plain Text recommendation), and how auth works
  (Google Identity Services OAuth popup flow, Client ID/Spreadsheet ID in
  `localStorage`, token kept in-memory only with silent refresh, one-time Google
  Cloud Console setup steps). This is the CLAUDE.md content that's really "how the
  system is built," not "how to prompt an AI working on it."
- **`README.md`** — trimmed down to what a human (or new contributor) needs to get
  running and oriented: what the app is (short), how to run it (open the file /
  serve statically, one-time OAuth setup — this can mostly stay as-is), and pointers
  to `docs/functional-reqs.md` and `docs/design.md` for the details. No business
  logic or architecture detail duplicated inline anymore.
- **`CLAUDE.md`** — trimmed to what's genuinely agent-specific: pointers to
  `docs/design.md` and `docs/functional-reqs.md` instead of inlining their content,
  the file-layout description updated to match the post-rewrite reality (plain
  `index.html` / `styles.css` / `app.js`, no more DC artifacts), and the standing
  instruction (already added previously) to keep docs in sync — updated to cover
  all three docs (README, functional-reqs, design) instead of just README.

### Phase 4 — Keep-in-sync instruction  ✅ DONE

CLAUDE.md already has a "Keeping docs in sync" rule from the last change. Update it
so it explicitly names all three docs and states which doc owns which kind of
change, so future edits land in the right file instead of being re-inlined into
CLAUDE.md or README.md out of habit:
- Behavior/business-logic change → `docs/functional-reqs.md`
- Architecture/auth/Sheets-access change → `docs/design.md`
- Run/setup step change → `README.md`
- Anything agent-workflow-specific (how to approach this repo, file layout,
  conventions) → `CLAUDE.md` itself

### Suggested execution order  ✅ FOLLOWED AS WRITTEN

1. Phase 1 (rewrite) — by far the largest chunk of work; likely wants its own
   sub-plan or at least a page-by-page checklist once started, given the app has
   11+ distinct screens/tabs.
2. Phase 2 (cleanup) — fast once Phase 1 is done and verified.
3. Phase 3 (docs split) — independent of Phase 1/2 mechanically (content already
   exists in README.md/CLAUDE.md today), but the file-layout parts of
   `docs/design.md` and `CLAUDE.md` should be written against the *post-rewrite*
   layout, so sequence this after Phase 1/2 rather than in parallel.
4. Phase 4 (sync instruction update) — small, do alongside Phase 3.

### Risks / things to watch  — outcomes noted inline

- **Regression risk is real and broad**: 11+ screens, each with Overview/Manage
  tabs, forms, sorting, CSV export, and live recomputation on price/rate updates.
  Without an automated test suite (none exists today), verification is manual
  click-through per screen. Consider whether a lightweight smoke-test script
  (e.g. a checklist run in a real browser against a test Spreadsheet) should be
  written as part of Phase 1 rather than improvised at the end.
- **OAuth/Sheets code is low-risk to carry over** — it's already plain
  `fetch`/`google.accounts.oauth2` calls, not DC-specific, so Phase 1 should be able
  to move it close to verbatim into the new `app.js`.
- **Losing React's diffing is a real behavior-preservation risk, not just a
  mechanical swap**: things React gave for free — input focus/cursor position
  surviving a re-render, controlled-input value binding, not re-triggering
  `<select>` dropdowns mid-interaction — have to be deliberately preserved with the
  `innerHTML`-rebuild approach above. Text inputs and the stock what-if slider are
  the spots most likely to visibly regress (e.g. losing cursor position while
  typing in the search/amount fields if a render fires on every keystroke); test
  these interaction patterns specifically, not just end-state correctness.
- **Styling fidelity**: converting hundreds of inline style strings (many
  conditional/computed, e.g. gain-color-changes-on-sign) into CSS classes risks
  subtle visual diffs (specificity, hover states that don't exist today, etc.).
  Budget time for a visual side-by-side pass, not just a functional one.
- **No rollback safety net**: since this is a full rewrite of the only file that
  runs in production, do this on a branch and keep the current `index.html`
  deployable until the rewrite is verified end-to-end.

### What actually happened

Completed. Notes on where reality diverged from the plan above.

#### Step 8 could not be met as written (⚠️)

"Byte-for-byte-equivalent behavior against the current app" turned out to be the
wrong target: **the committed `index.html` was already broken.** Its DC export lost
the toolchain's `sc-raw-table` / `sc-raw-tr` encoding, so the browser foster-parents
every `<sc-for>` out of its `<table>` at parse time — the `sc-for` ends up empty
beside the table and the `<tr>` inside keeps unbound `{{ row.name }}` placeholders.
Verified with a DOMParser test.

Consequence in the old build: Transactions, Accounts, Tags, Transaction Types, Gold,
Certificates, per-account ledgers, dashboard currency-card rows, owner account rows,
plan items and both stock tables all rendered as a single blank placeholder row, and
`sc-if` empty-states ("No gold holdings yet") showed unconditionally. The rewrite
renders all of them correctly, so behaviour is deliberately *not* identical here.

Everything that did render in the old build was compared and matches: side-by-side
screenshots of every screen are pixel-comparable, and all computed figures agree
(total savings, per-currency splits, gold/certificate/stock math, ledger balances).

#### Additions beyond the plan

- **A smoke test was written** (`test/smoke.html`), as the risks section suggested
  considering. It stubs the Sheets API and OAuth, drives every screen, and asserts
  the interaction behaviours the render loop restores by hand. `?scenario=empty`
  covers the empty-Sheet path.
- **`serve.ps1`** — a dependency-free local static server. Needed because OAuth
  cannot work from `file://` (origin `null` cannot be registered with Google), which
  the old README's "just open the file" instruction glossed over.

#### Follow-on decisions taken after the plan was written

- **All seed data was removed from the app.** The old build hardcoded the user's
  spreadsheet ID, certificate numbers and amounts, gold lots, provident fund balance
  and stock holdings, and wrote them into any empty tab on first connect. The Sheet
  is now the only source of data; nothing is ever seeded. This is a behaviour change
  and was agreed explicitly.
- **The in-app About screen was removed**, its content now living only in
  `docs/functional-reqs.md`. The Plan tab it contained was promoted to its own
  screen, so the `Plan` tab of the Sheet is still fully editable.
- **Deployment** stays "push all three files together" with no cache-busting;
  GitHub Pages' `max-age=600` makes any stale mix self-heal.

#### Known remaining item

The what-if slider's range is still hardcoded to $10–$80, which is tuned to one
particular share price. It is UI configuration rather than user data, so it was left
alone, but it will look wrong for a stock trading outside that band.

---

## Part II — Refactoring ⬜ NOT STARTED

**Nothing in this part has been started.** Part I optimised for getting behaviour
right; it did not optimise for structure. Everything below is grounded in
measurements of the current files, not general advice.

### Constraints (all still binding)

Part I's constraints carry over unchanged, plus the two rules added since:

- **No data in the app.** No seed rows, no sample holdings, no fallback spreadsheet
  ID. Refactoring must not reintroduce fixtures into `app.js`.
- **No build step.** No bundler, no transpile, nothing to `npm install` to run the
  app. Any splitting must work with plain `<script>` / `<link>` tags — including
  `<script type="module">`, which the browser resolves itself and which therefore
  still counts as no build step.

A refactor is by definition behaviour-preserving: `test/smoke.html` must pass in both
scenarios before and after every phase, and the UI must stay pixel-identical.

### Where the code stands today

| File | Lines | Note |
| --- | --- | --- |
| `app.js` | 2,278 | one IIFE, 10 numbered sections |
| `styles.css` | 1,351 | 257 rules, 19 sections |
| `index.html` | 19 | shell only — already fine |

#### Smell 1 — Long class: the `actions` object

`var actions = {…}` spans **lines 1686–2155 (470 lines)** and holds ~45 handlers for
10 different entities. `var fields = {…}` adds another **80 lines / 57 entries**.
Together that is a quarter of the file in two flat object literals with no internal
structure.

#### Smell 2 — Long method: `buildViewModel()`

**Lines 461–859 (399 lines)** in a single function. It computes the view model for
every screen at once — ledgers, transactions, gold, certificates, dashboard groups,
stocks, provident fund, currency cards, plan — and runs in full on every keystroke.

Runners-up: `viewStocks` (130 lines), `viewDashboard` (111), `viewCerts` (83),
`viewGold` (67).

#### Smell 3 — Duplication

Measured, not estimated:

- **10 entities × 4 near-identical handlers** (`editX` / `cancelXForm` /
  `submitXForm` / `deleteX`) — accounts, types, tags, transactions, plan, gold,
  certificates, holdings, vesting, provident fund. The 9 `cancelXForm` bodies are
  structurally identical.
- **8 form-reset object literals, each repeated 3×** (25 occurrences): once in the
  `state` initialiser, once in `cancelXForm`, once in the `submitXForm` success
  patch. Adding a form field means editing three places.
- **51 of 57 `fields` entries** are the same one-liner shape:
  `function (v) { setForm('xForm', 'key', v); }`.
- **5 identical Overview/Manage tab bars**, one per screen.
- **25 stat-label / stat-value card blocks** written out longhand.
- **CSS has no design tokens.** `font-size: 13px` appears 31×, `font-size: 12px` 24×,
  `font-weight: 700` 19×, `background: #fff` 13×, `border-radius: 10px` 13×. Every
  brand colour is a repeated hex literal.

#### Smell 4 — Dead code

- **8 unused CSS classes**: `.about-intro`, `.about-list`, `.about-h`, `.about-p`,
  `.about-ul`, `.about-note` (left behind when the About screen was removed), plus
  `.mb-0` and `.mb-24`.
- **Stale name**: `.sb-about` now wraps the *Plan* nav item.
- The JS is otherwise clean — no unreachable functions found. (`v.scenarioInputs`
  looks unused to a naive grep but is read through `lastVm`; keep it, comment it.)

### Decision — split the JS into ES modules ✅ DECIDED

`app.js` is one classic script so that `index.html` would work when opened from disk
over `file://`. **That rationale is void.** OAuth requires an origin registered in
Google Cloud Console; `file://` reports origin `null`, which cannot be registered. The
app has always needed a real origin — `serve.ps1` or `npx serve` locally, GitHub Pages
in production — so `file://` compatibility protects nothing. Modules are unblocked.

**Phase 9 uses `<script type="module">` with real `import` / `export`.** This is still
no build step: the browser resolves the graph itself. Nothing to install, nothing to
compile, what is in the repo is still what runs.

What the decision pulls in:

- `index.html` — one tag change: `<script type="module" src="app.js"></script>`.
- `test/smoke.html` — the same tag change and **nothing else**. The harness is
  black-box: it installs the `window.fetch` / `window.google` / `window.confirm` stubs
  from a classic inline script (which still runs first), then drives the app through
  DOM events on `window.load` (which still fires after module evaluation, since module
  scripts are deferred). It never calls an app function directly, so no coupling
  breaks.
- The IIFE wrapper in `app.js` goes away — module scope is already private.
- **Import specifiers must be relative and carry the `.js` extension**
  (`import { esc } from './js/format.js'`). There is no resolver: bare specifiers
  (`from 'format'`) fail outright.
- **MIME type becomes load-bearing.** A module served as anything other than a
  JavaScript type is rejected, where a classic script would have run anyway. Already
  verified — `serve.ps1` maps `.js` → `text/javascript; charset=utf-8`
  ([serve.ps1:19](../serve.ps1#L19)) and GitHub Pages does the same. Nothing to change;
  just don't break it.
- **New failure mode — circular imports.** Two modules importing each other leaves one
  binding `undefined` at evaluation time, and it fails at boot rather than at the call
  site. The file split in Phase 9 is a DAG by design (`format` → `constants` → `state`
  → `sheets` → `model` → `views` → `actions` → `app`); keep it one.
- **Deployment changes shape.** Decision 4 was "push all three files together"; it is
  now "push the whole tree". A file missed in a push used to break one feature — with
  modules an unresolved import breaks the entire app, silently, before first paint.
- **New capability worth using.** A test page can now `import` a function directly, so
  Phases 7 and 8 get real unit tests instead of DOM-only assertions. This is the main
  reason (a) beat (b), and the test plans below rely on it.

### Decision — split the CSS into separate `<link>` tags ✅ DECIDED

Four stylesheets, four `<link>` tags in `index.html`, in cascade order. Rejected: one
`styles.css` that `@import`s the rest — `@import` loads serially and blocks rendering,
and it buys only a single tag.

Consequences to hold on to:

- **The tag order in `index.html` is load-bearing**, and it is the only place the
  cascade is recorded. `src/css/utilities.css` must come last so `.mb-*` beats a
  component's own margin. Comment it in `index.html`; a reordered tag is a silent,
  hard-to-attribute regression.
- **`styles.css` itself goes away**, replaced by `src/css/*.css`. That is a 5th and 6th
  file to remember at deploy time, on top of the module split — see the deployment
  note above.
- Within a file, source order still decides ties at equal specificity, exactly as
  today. Splitting changes nothing about how the cascade works; it only spreads the
  ordering across four files instead of one, which is why the order test in Phase 10
  exists.

### Decision — directory layout ✅ DECIDED

Everything the app *is* moves under `src/`; everything else is already sorted into
`docs/`, `config/` and `test/`. `index.html` stays at the root — not merely allowed,
but required: GitHub Pages publishes this repo from its root, so `/index.html` is the
served entry point.

| Today | Target |
| --- | --- |
| `index.html` | `index.html` *(unchanged — Pages needs it here)* |
| `app.js` | `src/app.js` — entry: render loop, delegation, boot |
| — | `src/js/*.js` — the 7 modules from Phase 9 |
| `styles.css` | `src/css/*.css` — the 4 stylesheets from Phase 10 |
| `serve.ps1` | `scripts/serve.ps1` |
| `docs/`, `config/`, `test/` | unchanged |

```text
index.html            served entry point; nothing but the shell
src/
  app.js              entry module
  js/                 format, constants, state, sheets, model, views, actions
  css/                base, components, screens, utilities
scripts/serve.ps1     dev tooling — never deployed, never imported
config/.env.example   template; the real .env is untracked
docs/                 functional-reqs, design, plan
test/smoke.html       the harness
```

**`scripts/`, not `utilities/`.** Two reasons beyond convention: Phase 10 creates
`css/utilities.css`, and having `utilities/` mean *tooling* while `utilities.css`
means *CSS helpers* is a name collision waiting to confuse. `tools/` would be equally
fine. And **`src/js/` rather than `src/scripts/`**, so "scripts" means exactly one
thing in this repo — dev tooling at the root.

#### Edits the move forces

Small, but each one silently breaks something if missed:

1. **`serve.ps1` serves its own directory.** Line 13 is
   `$root = Split-Path -Parent $MyInvocation.MyCommand.Path`. Left alone, moving the
   file makes it serve `scripts/` instead of the repo — a server that starts fine and
   404s everything. It must climb one level:
   `$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)`.
2. **`index.html`** — `<script type="module" src="src/app.js">` and the four
   `<link href="src/css/…">` tags.
3. **`test/smoke.html`** — `../app.js` → `../src/app.js`, `../styles.css` → the four
   `../src/css/…` tags.
4. **`README.md`** — the run command becomes
   `powershell -ExecutionPolicy Bypass -File scripts/serve.ps1`.
5. **`docs/design.md` and `CLAUDE.md`** — both carry a file-layout table.

#### One latent bug the move should fix

`applyLocalDefaults()` calls `fetch('config/.env')`, which resolves **relative to the
document**, not the script. From `/index.html` that is `/config/.env` — correct today.
From `/test/smoke.html` it resolves to `/test/config/.env`, which does not exist; the
harness only passes because its `fetch` stub matches on substring and never touches
the disk.

Phase 9 makes this properly fixable, because a module knows its own URL:

```js
fetch(new URL('../config/.env', import.meta.url))
```

From `src/app.js` that resolves to `/config/.env` regardless of which page loaded the
module, or what subpath the site is served from. Do this as part of Phase 9 — it also
makes the smoke harness exercise the real path instead of a stubbed approximation.

#### Sequencing — don't move anything twice

The move is nearly free if it rides along with work already planned:

- **`scripts/serve.ps1` moves in Phase 5.** It is independent of the app, cannot break
  a render, and only needs `serve.ps1` and the README touched. Grouping it with the
  dead-code deletion keeps all the zero-risk housekeeping in one commit.
- **Phase 9 writes JS straight to `src/js/`**, not to `js/` followed by a later move.
- **Phase 10 writes CSS straight to `src/css/`.**

So there is no separate "restructure" phase, and no file is relocated twice.

#### Tests

- ⬜ **Server root.** Start `scripts/serve.ps1` and request `/index.html`,
  `/src/app.js`, `/config/.env` and `/test/smoke.html` — all 200. This is the check
  that catches the `$root` mistake, and the one most likely to be skipped because the
  server *appears* to start normally.
- ⬜ **No stale paths.** Grep the tree for `"app.js"`, `"styles.css"` and `serve.ps1`
  outside their new homes; every hit should be a doc that was meant to be updated.
- ⬜ **`config/.env` resolves from both pages.** With a real `config/.env` present,
  load `/index.html` *and* `/test/smoke.html` with the fetch stub disabled, and assert
  the fields prefill in both. Before the `import.meta.url` fix this fails from
  `/test/`, which is the point.
- ⬜ **Deployed tree is complete.** After pushing, load the live site and confirm boot —
  `src/` and `config/` must both have gone up. With modules a missing file is a blank
  page, not a degraded one.
- ⬜ Golden DOM snapshot unchanged, both scenarios — a move must change nothing.

#### Known, accepted

The hosted site fetches `config/.env` at boot and gets a 404, since the file is
deliberately never deployed. It is one request, it is handled, and the fallback is the
normal empty Settings form. Avoiding it would need a second request or a tracked
marker file, both worse than one 404 in the network tab.

**Run it with:** Haiku 4.5, thinking off, for the `scripts/` move in Phase 5 — it is
four mechanical edits with an exact spec above. The `src/` moves are not separate work;
they are the file paths Phases 9 and 10 write to.

### Decision — how the tests run ✅ DECIDED

No new dependencies anywhere. The repo stays install-free: `git clone` and open it.

**A runner, not a browser tab.** `scripts/test.ps1` drives headless Edge, collects each
harness's verdict, prints a summary and **exits 0 or 1**. Part II needs roughly 25 runs
across phases and scenarios; reading a `<pre>` by hand 25 times is how a failing check
gets skimmed past.

One implementation detail, learned the hard way and easy to lose an hour to: Edge's
`--dump-dom` output must be captured with
`Start-Process -Wait -NoNewWindow -RedirectStandardOutput <file>`. Plain `>` redirection
of the exe produces a **0-byte file with exit code 0** — a silent, convincing failure.
Pass `--headless=new --disable-gpu --no-sandbox --virtual-time-budget=10000` and a
per-run `--user-data-dir` so parallel or repeated runs don't fight over a profile.

**Baselines are committed files, refreshed deliberately.** The runner writes
`test/golden.json`; a `--update` flag is the *only* way to rewrite it. Re-baselining is
then an explicit, reviewable act rather than something that happens because a test was
run twice. A baseline kept in `localStorage` was rejected outright: it cannot prove that
a phase from three days ago changed nothing.

**Phase 10 gets a hash, not an image diff.** Nothing in this repo can pixel-compare, and
adding an image-diff dependency for one phase is not worth it. Headless Edge screenshots
of an identical DOM at a pinned viewport are byte-identical, so hashing each PNG gives a
reliable *"something moved"* signal for free. When a hash changes, the computed-style
assertions say *which token*, and then you look. Revisit only if the hashes prove flaky.

**Unit tests live in `test/unit.html`,** a module page, separate from `test/smoke.html`.
Different jobs: `smoke.html` is black-box and its value is that it touches nothing but
the DOM; `unit.html` imports functions directly and asserts on return values. Keeping
them apart stops one from being weakened to accommodate the other.

#### Consequence: unit tests cannot exist before Phase 9

`unit.html` can only `import` once `app.js` is modules — which is Phase 9. Phases 7 and 8
run **before** that, so their test plans cannot rely on imports:

- **Phase 7** is verified by the golden DOM snapshot plus arithmetic assertions read off
  the rendered dashboard, not by calling `buildViewModel()` directly.
- **Phase 8** is verified by the byte-identical snapshot. Its escaping check works
  through the DOM instead: put `<script>` and quote characters in the harness fixture and
  assert every screen renders them escaped — which is a *stronger* test than calling the
  helper, since it covers the real path from Sheet data to page.
- **Phase 9** creates `test/unit.html`.
- **Phase 11** back-fills unit tests for the Phase 7 builders and Phase 8 helpers, now
  that they are importable.

The alternative — moving Phase 9 ahead of 7 and 8 to unlock imports earlier — was
rejected: Phase 9's file-size targets assume the Phase 7 split and Phase 8 dedup have
already happened, and splitting first would trip the "views.js over 500 lines" rule for
reasons that Phase 8 was about to fix anyway.

### Decision — commits ✅ DECIDED

**Manual, by the repo owner, after each phase.** No agent commits, per `CLAUDE.md`. Each
phase is expected to end with a green runner and a clean, reviewable diff — that is the
handoff point, and the per-phase boundary is what makes a bad phase revertable on its
own.
---

### Picking a model per phase

These phases differ enormously in risk. Phase 5 is a find-and-delete; Phase 6 can
silently write a value into the wrong Sheet column and you would not notice until the
numbers were wrong. Match the model to that, not to the line count.

- Switch model with `/model`; **Fast mode** (`/fast`) keeps Opus's capability with
  faster output and is a reasonable way to stay on Opus for the mechanical phases.
- "Thinking" below means extended thinking — toggle it, or trigger it in the prompt
  with *think* / *think hard* / *ultrathink*.
- **Run one phase per session.** Every phase ends at a green test and a clean working
  tree, which is the natural place to `/clear`. Phase 9 in particular should not be
  split across a context compaction — it moves all 2,278 lines at once.

| Phase | Model | Thinking | Why |
| --- | --- | --- | --- |
| Safety net | Sonnet 5 | on | New test code, clear spec, low blast radius |
| 5 — housekeeping | Haiku 4.5 | off | 8 named classes, 1 rename, 1 file move — all enumerated |
| 6 — CRUD descriptors | **Opus 5** | **hard** (*ultrathink*) | 10 entities × column orders held at once; wrong key = wrong column |
| 7 — view model split | **Opus 5** | on | Cross-domain data dependencies, ordering is subtle |
| 8 — view helpers | Sonnet 5 | on | Pattern work with a byte-exact pass/fail signal |
| 9 — split `app.js` into `src/` | Sonnet 5 | on | Mechanical, but 2,278 lines is where a function gets dropped |
| 10 — CSS tokens + `src/css/` | Sonnet 5 | on | Token judgment ("is *this* 13px the same 13px?") needs care |
| 11 — re-verify | Sonnet 5 → Opus 5 | on | Sonnet runs the suite; escalate to Opus to triage any diff |

Don't drop below Sonnet on 6–10. The failure mode of a cheap model here is not a
crash, it is a plausible-looking refactor that changes a number.

### Safety net — build this FIRST, before Phase 5 ⬜

`test/smoke.html` proves the app *runs*. It does not prove a refactor changed nothing,
which is the only question Part II asks. Four additions, roughly 300 lines total, and
every phase leans on them. **Build this before touching any app code** — a baseline
captured after a change certifies the change.

1. ⬜ **The runner** (`scripts/test.ps1`). Starts the static server on a free port,
   drives headless Edge over every harness × scenario, prints one summary, exits 0/1.
   `-Update` re-writes `test/golden.json`; nothing else may. See the decision above for
   the `Start-Process -RedirectStandardOutput` trap — `>` silently yields 0 bytes.
   Note it must reference `serve.ps1` at the repo root until Phase 5 moves it to
   `scripts/`; that one-line update is part of Phase 5.
2. ⬜ **Golden DOM snapshot** (`test/golden.html`). Drive every screen and both tabs,
   serialize `#sidebar.innerHTML` + `#main.innerHTML` per screen, compare against
   `test/golden.json`. That file is the definition of "behaviour preserved". Diff output
   must name the screen and show the first differing span, or it is useless at 700 lines
   of HTML. Drive the screens in a fixed order with fixed expand/collapse state, or the
   snapshot is not reproducible.
3. ⬜ **Write-payload capture.** `window.__writes` currently records only sheet *names*.
   Extend the stub `fetch` to record `{ range, headers, rows }` for every PUT. This is
   the one test that catches Phase 6's worst failure — a value written under the wrong
   header — and nothing else will.
4. ⬜ **CSS coverage check.** While walking every screen, collect every class name
   present in the DOM; parse the class selectors out of `styles.css`; report *unused*
   selectors and *undefined* classes. Proves Phase 5's deletions are safe, and stops
   the next dead class from accumulating.

`test/unit.html` is **not** here — it can only import once Phase 9 makes the app
modules. It is created in Phase 9 and filled in Phase 11.

**Run it with:** Sonnet 5, thinking on. Self-contained new code against an existing
harness with a clear spec.

### Phases

Each phase ends with `scripts/test.ps1` exiting 0 — smoke green in **both** scenarios
(`populated` and `?scenario=empty`), golden snapshot clean — plus a visual check of the
affected screens. Do them in order; later phases assume earlier ones.

**Commits are manual, by the repo owner, after each phase.** Leave the working tree
clean and reviewable at every boundary; that is what makes a bad phase revertable on
its own.

#### Phase 5 — Housekeeping: dead code and the `scripts/` move ⬜

All the zero-risk work in one commit. Nothing here can change a rendered figure.

1. ⬜ Remove the 6 `.about-*` classes, `.mb-0` and `.mb-24` from `styles.css`.
2. ⬜ Rename `.sb-about` → `.sb-footer-nav`, or fold it into an existing rule.
3. ⬜ Comment `v.scenarioInputs` to record that it is read via `lastVm`, so the next
   reader doesn't delete it.
4. ⬜ `git mv serve.ps1 scripts/serve.ps1`, and fix its `$root` to climb one extra
   level — see "Edits the move forces" above. Update the run command in `README.md`
   and `CLAUDE.md`.

The `src/` half of the layout decision is *not* done here. Phases 9 and 10 write to
`src/js/` and `src/css/` directly, so nothing gets moved twice.

**Tests**

- ⬜ CSS coverage check reports **0 unused and 0 undefined** classes afterwards. This is
  the whole test — it independently re-derives the dead list rather than trusting it.
- ⬜ Golden snapshot: expect **exactly one diff**, the `sb-about` → `sb-footer-nav`
  class name in the sidebar. Review it, then re-baseline. Any second diff is a bug.
- ⬜ Grep `app.js` and `index.html` for each deleted class name — must be zero hits
  before deleting, not after.
- ⬜ `scripts/serve.ps1` serves the **repo root**: `/index.html`, `/app.js`,
  `/config/.env` and `/test/smoke.html` all return 200. A wrong `$root` still starts
  cleanly and 404s everything, so this must be checked by request, not by eye.
- ⬜ Smoke test green through the moved server, both scenarios.

**Run it with:** Haiku 4.5, thinking off. Every edit is enumerated above, and the
coverage check that needed judgment was already written in the safety net.

#### Phase 6 — Collapse the CRUD duplication ⬜

The biggest single win: should take the ~470-line `actions` object closer to 200, and
make adding an ordinary entity a data change rather than four new handlers.

**Scope first — 8 entities, not 10.** Two do not fit the model and must be left alone:

- **Accounts.** `submitAcctForm` and `deleteAccount` are not row edits. They rename a
  Sheet *tab* (`renameSheet`, falling back to `ensureSheets` when the tab was never
  created), create one on add, delete one on remove, navigate away if the deleted
  account's ledger is the active screen, reject duplicate names, and write three
  parallel structures (`accounts` / `accountOwners` / `accountTags`) through
  `writeAccountsSheet` rather than one row array. Forcing this into a descriptor
  would mean a descriptor that can express tab lifecycle — much more machinery than
  the duplication costs.
- **Provident Fund.** A single record: no index, no list, no delete, and `pfForm` has
  no `mode`. `editX` / `deleteX` have nothing to generalise over.

That leaves **8 genuinely repetitive entities**: types, tags, transactions, plan,
gold, certificates, holdings, vesting.

1. ⬜ Give each of the 8 one descriptor: sheet name, headers, `state` key, form key,
   the empty-form literal, and `toRecord(form)` / `toForm(record)`. One place per
   entity instead of three.
2. ⬜ Derive `editX` / `cancelXForm` / `deleteX` generically from the descriptor —
   across these 8 they differ only in which keys they touch.
3. ⬜ Keep `submitXForm` per entity **where validation genuinely differs** (gold's
   price inheritance, transactions' To-Account rule, certificates' percent-to-fraction
   conversion). Do not force those into a generic shape; that trades duplication for
   worse indirection.
4. ⬜ Generate the mechanical `fields` entries from the descriptors, keeping the 6 that
   transform input (`txAmount`, `pfBalance`, and the four upper-casing ones) as
   explicit exceptions.

Watch for: the two `confirm()` prompts (accounts, tags) must survive — the accounts one
is inside the code this phase does not touch, the tags one is inside code it does. The
ledger recompute that follows transaction writes (`persist(...)`'s `after` callback)
must survive too.

**Tests** — the heaviest set in Part II, because this is the phase that can corrupt data.

- ⬜ **Round-trip per entity, all 10** — the 8 converted ones *and* the 2 exempt ones.
  Accounts and Provident Fund must be *proven* untouched, not assumed. For each: add a
  row through the UI, edit it, delete it, and assert the captured write payload —
  header order and cell values — matches the pre-refactor baseline byte for byte. Run
  this after *each* entity is converted, not after all eight.
- ⬜ **Column-order guard.** Assert the written header row equals the constant header
  array for that sheet. A descriptor with keys in the wrong order still produces
  well-formed output; only this catches it.
- ⬜ **Confirm prompts.** Stub `window.confirm` to count calls: exactly one for account
  delete, one for tag delete, **zero** for the other eight.
- ⬜ **Ledger recompute.** After a transaction write and after an account write, assert
  the affected per-account ledger tabs appear in the write list. Easy to lose when the
  bespoke handler becomes generic.
- ⬜ **The 6 field exceptions, individually.** `txAmount` inserts thousands separators
  and keeps the caret at the end; `pfBalance` likewise; each of the four upper-casing
  fields upper-cases. These are precisely the entries that must *not* be generated.
- ⬜ **Empty scenario.** Add the first row of an entity into an empty Sheet — the path
  where `toForm` gets nothing to work with.
- ⬜ Golden snapshot clean.

**Run it with:** Opus 5, thinking hard (*ultrathink*), **one entity per message**. Ten
entities × four handlers × exact column orders is more state than is worth holding in
one turn, and the failure is silent. This is where to spend the budget.

#### Phase 7 — Break up `buildViewModel()` ⬜

1. ⬜ Split into one builder per domain — `ledgerModel`, `transactionsModel`,
   `goldModel`, `certificatesModel`, `stocksModel`, `dashboardModel`, `planModel` —
   each taking `state` and returning its slice.
2. ⬜ Compute the shared intermediates (`ledgers`, `ratesMap`, gold total value, stock
   totals) once and pass them in explicitly rather than recomputing per builder. The
   dashboard consumes gold, certificate and stock figures, so ordering matters.
3. ⬜ Optional: build only the slice the active screen needs. Measure first — the whole
   model rebuilds on every keystroke today and is fast enough, so this is a tidiness
   argument, not a performance one. Don't add caching complexity for it.

**Tests**

- ⬜ **Golden DOM snapshot**, both scenarios. Note this phase runs *before* Phase 9, so
  `buildViewModel()` is still sealed inside the IIFE and cannot be called directly —
  the snapshot is the available proxy. The direct view-model golden is deferred to
  Phase 11, once `test/unit.html` can import it.
- ⬜ **Arithmetic against the spec, not the baseline.** With gold, certificates, stock
  and provident fund all non-zero, assert total savings equals the formula in
  [functional-reqs.md](functional-reqs.md#dashboard-totals) — EGP + USD + EUR converted,
  unvested stock excluded. A snapshot happily preserves a pre-existing bug; this
  doesn't.
- ⬜ **Ordering / purity.** Call `buildViewModel()` twice on the same state and assert
  identical output. Catches a builder that mutates a shared intermediate the next
  builder reads.
- ⬜ **Empty-state per builder.** Each builder against an empty Sheet — no rows, no
  rates, no stock meta. Division-by-zero and `undefined` land here.
- ⬜ Golden DOM snapshot clean; smoke green in both scenarios.

**Run it with:** Opus 5, thinking on. 399 lines is the easy part; the dashboard's
dependency on three other domains is the part a weaker model gets subtly wrong.

#### Phase 8 — De-duplicate the view layer ⬜

1. ⬜ Add `tabBar(screen, activeTab, teal)`; replace all 5 copies.
2. ⬜ Add `statCard(label, value, colourClass)` and a small variant; replace the 25
   longhand blocks.
3. ⬜ Add `dataTable({ columns, rows, rowActions })` for the tables that share the
   header/row/actions shape. Leave the genuinely bespoke ones (dashboard currency
   cards, certificate groups) alone — forcing them through a generic helper costs
   more than it saves.
4. ⬜ Fold the repeated gain-colour ternary into one `gainClass(n)` helper.

**Tests**

- ⬜ **Byte-identical golden snapshot.** The purest case in Part II: a helper that emits
  the same HTML as the longhand it replaced produces a zero-byte diff. Do not
  re-baseline this phase — a diff here means the helper is wrong, including whitespace
  differences that could change inline-element spacing.
- ⬜ **Escaping, through the DOM.** Imports don't exist until Phase 9, so test this the
  stronger way instead: put `<script>alert(1)</script>` and `" onmouseover="x` into the
  harness fixture's text columns, walk every screen, and assert no raw `<` and no
  injected attribute appears. That covers the real path from Sheet data to page rather
  than one helper in isolation. Escaping is the only defence there is, and centralizing
  markup is exactly when an `esc()` gets dropped.
- ⬜ **Colour and tab coverage via the snapshot.** All 5 tab bars and all 10 stat-card
  colour classes already appear across the screens the golden run walks, so a
  byte-identical snapshot covers them. The one case it does *not* cover is `gainClass`
  at **exactly zero** — no fixture row hits it. Add a fixture row that does.
- ⬜ Direct helper unit tests are deferred to Phase 11 (`test/unit.html`).
- ⬜ **`dataTable` degenerate cases:** zero rows, one row, a row with no actions.

**Run it with:** Sonnet 5, thinking on. Repetitive extraction with an unambiguous
pass/fail signal — the snapshot tells you immediately, so a stronger model buys little.

#### Phase 9 — Split `app.js` ⬜

Now settled: ES modules, written straight to their final home under `src/` (see both
decisions above). Target ~8 files, none over ~400 lines:

| File | Contents | Rough size |
| --- | --- | --- |
| `src/js/format.js` | `esc`, `fmtMoney`, `fmtEGP`, `fmtEUR`, `signed`, `formatAmountDisplay`, `sheetsFmtDate` | ~70 |
| `src/js/constants.js` | header arrays, tag constants, entity descriptors from Phase 6 | ~90 |
| `src/js/state.js` | the `state` object plus `set` / `setForm` / `toggle` | ~110 |
| `src/js/sheets.js` | OAuth and every Sheets API call | ~270 |
| `src/js/model.js` | `computeLedger` plus the per-domain builders from Phase 7 | ~420 |
| `src/js/views.js` | view helpers and screen views | ~700 |
| `src/js/actions.js` | the `actions` and `fields` maps | ~250 |
| `src/app.js` | render loop, event delegation, boot | ~120 |

⬜ If `src/js/views.js` is still over ~500 lines after Phase 8, split it per screen.

⬜ Also in this phase: `index.html` → `<script type="module" src="src/app.js">`,
`test/smoke.html` → `../src/app.js`, and switch `applyLocalDefaults()` to
`fetch(new URL('../config/.env', import.meta.url))` so the path stops depending on
which page loaded the module.

⬜ Create `test/unit.html` — a module page that imports from `src/js/*` — and wire it
into `scripts/test.ps1`. Leave it near-empty here; Phase 11 fills it. Creating it now
means Phase 9 proves the modules are importable from outside the app, which is the
thing a boot check alone does not establish.

**Tests**

- ⬜ **Nothing lost in the move.** Count exported + local function declarations across
  the 8 files and assert it equals the count in the pre-split `app.js`. A dropped
  function during a bulk move is the characteristic failure, and it may not surface
  until a rarely-used screen is opened.
- ⬜ **Boot with zero console errors** in both scenarios — the smoke harness already
  records `window.__errors`; an unresolved import or a cycle shows up there and
  nowhere else.
- ⬜ **No import cycles.** Parse the `import` lines across `src/js/*.js` and assert the graph
  is acyclic. At 8 files this is also checkable by eye, but the check is ~15 lines and
  survives future files.
- ⬜ **Served, not just opened.** Run the suite through `scripts/serve.ps1` *and* `npx serve` —
  modules hard-fail on a wrong MIME type where classic scripts did not.
- ⬜ **Every file actually reachable.** After deploy, load the live GitHub Pages URL and
  confirm boot. A file missed in the push now breaks the whole app rather than one
  screen.
- ⬜ Golden DOM snapshot clean — a pure move must change nothing.

**Run it with:** Sonnet 5, thinking on, **in one session without a compaction**. It is
mechanical, but it touches every line of the file at once, and the risk is omission
rather than misjudgement. Escalate to Opus 5 only if a cycle or a boot failure needs
untangling.

#### Phase 10 — Split and tokenize `styles.css` ⬜

1. ⬜ Introduce `:root` custom properties for the repeated literals — brand colours,
   the four font sizes, the three border radii, the border grey. **This is what kills
   the CSS duplication; splitting alone does not.**
2. ⬜ Split into cascade-ordered files:

   | File | Contents |
   | --- | --- |
   | `src/css/base.css` | reset, tokens, `body`, links, layout |
   | `src/css/components.css` | buttons, inputs, tables, tabs, pills, stat cards, chevrons |
   | `src/css/screens.css` | dashboard, stocks, certificates, plan, ledger |
   | `src/css/utilities.css` | the `.mb-*` helpers — last, so they win |

3. ⬜ Update `index.html` with `<link>` tags in that order, and comment that the order
   matters. Update `test/smoke.html` to the same four `../src/css/…` tags — it loads
   the real stylesheet, so a missed tag there silently unstyles the harness.

**Tests** — the golden DOM snapshot is blind here: the HTML is unchanged and only the
rendered result moves. CSS needs its own checks.

- ⬜ **Computed-style assertions.** Pick one representative element per token — a
  13px label, a 12px caption, a 10px-radius card, a `#fff` panel, each brand colour —
  and assert `getComputedStyle` returns the same value before and after. Cheaper than
  screenshots and it names the broken token instead of just flagging a changed page.
- ⬜ **Screenshot hash, every screen, fixed viewport.** Headless Edge `--screenshot` at a
  pinned window size; hash each PNG and compare to the stored hash. Identical DOM at a
  fixed viewport renders byte-identically, so this is a reliable "something moved"
  signal with no image-diff dependency. It says *that* something changed, not what —
  the computed-style assertions above localize it, then look at the screenshot. The
  only check that catches a rule lost in the split rather than mistyped.
- ⬜ **Cascade order.** Assert a known override still wins — a `.mb-*` utility beating a
  component's own margin. This is the failure mode the split introduces and the one
  nothing else detects.
- ⬜ **Rule-count conservation.** Rules across the four files should sum to 257 minus
  Phase 5's deletions. A blunt check, but it catches a whole section dropped between
  files.
- ⬜ **Token sweep.** After tokenizing, grep the four files for the literal values that
  were supposed to be replaced — any survivor is either a miss or a deliberate
  exception that deserves a comment.

**Run it with:** Sonnet 5, thinking on. The split is pure file movement, but deciding
whether a given `13px` is *the same* 13px as the others is real judgment — a mechanical
find-and-replace here is how a font size ends up coupled to an unrelated one.

#### Phase 11 — Re-verify ⬜

1. ⬜ `scripts/test.ps1` exits 0: smoke green in both scenarios, golden snapshot clean,
   CSS coverage clean.
2. ⬜ **Fill `test/unit.html`** — this is the phase that pays back the deferrals. Now
   that `src/js/*` is importable:
   - the per-domain builders from Phase 7, against a frozen `state` fixture, compared
     to a stored JSON golden (the direct view-model check Phase 7 could not run);
   - `buildViewModel()` called twice on the same state → identical output, catching a
     builder that mutates a shared intermediate;
   - `gainClass` at positive, negative and exactly zero; `statCard` for each colour;
     `tabBar` for each of the 5 screens;
   - `dataTable` with zero rows, one row, and a row with no actions;
   - `parseEnv` on comments, padding, quotes and a missing `=`.
3. ⬜ Screenshot every screen from **before the safety net** against **after Phase 10**
   and compare hashes end to end, not just per phase — a per-phase check that was
   re-baselined can hide a drift the whole-run comparison still catches.
4. ⬜ Re-check the hand-restored behaviours by hand, since they are the ones the render
   loop reconstructs and the ones most likely to regress:
   - caret position while typing in a text input, and in the amount field that
     reformats as you type;
   - the Transactions search box;
   - dragging the what-if slider (the one targeted-DOM-patch path);
   - scroll position of both panes after a re-render.
5. ⬜ Confirm the app still writes **nothing** to an empty Sheet — the "no data in the
   app" rule, and a plausible casualty of descriptor-driven CRUD.
6. ⬜ Update `docs/design.md` (directory layout, module boundaries, the ES-module
   decision) and `CLAUDE.md` (file list, conventions, the `scripts/serve.ps1` path) in
   the same change. `README.md` too, if the run command moved.

**Run it with:** Sonnet 5, thinking on, to run and extend the suite. Escalate to Opus 5
for any diff that needs triage — "is this pixel shift real?" is a judgment call, and by
this point the change set is too large to bisect cheaply.

### Deferred — not part of Part II ✅ DECIDED

- **The what-if slider's hardcoded $10–$80 range stays as it is.** Deriving it from the
  current price is a real fix — the slider is wrong for a stock trading outside that
  band — but it is a *behaviour* change, and folding one into Part II would forfeit the
  ability to say "nothing changed", which is the entire claim the golden baselines
  exist to support. Revisit as its own change, with its own sign-off, once Part II has
  landed.

### Risks

- **Phase 6 is the risky one.** Collapsing the handlers into descriptor-driven code is
  where a wrong key silently writes the wrong column. Do it entity by entity, running
  the write-payload test between each, rather than all eight at once.
- **Phase 10 can shift the visuals.** Replacing literals with tokens is mechanical but
  easy to fat-finger; the screenshot hashes are the safety net and should not be
  skipped.
- **A green runner is not a green build.** `scripts/test.ps1` exiting 0 means the
  checks that exist passed. It says nothing about a screen no harness walks or a token
  no assertion covers. When a phase adds surface, add the check in the same phase.
- **Modules fail loudly and totally.** A bad import takes the whole app down before
  first paint rather than breaking one screen. That is easier to notice locally and
  worse if it reaches GitHub Pages — hence the post-deploy load check in Phase 9.
- **Don't over-abstract.** Several of these smells are worth living with: bespoke
  validation, the dashboard's one-off cards, and the certificate group tables are all
  clearer written out. The goal is less repetition, not maximum genericity.
- **The safety net is load-bearing.** If the golden baseline is captured *after* a phase
  rather than before, it certifies the bug. Capture it first, and re-baseline only
  deliberately, with the diff reviewed.
- **No rollback net beyond git.** The repo owner commits manually after each phase, so
  a bad phase can be reverted on its own. A phase that ends without a commit puts the
  next phase's diff on top of it, and that is where the ability to bisect is lost.
