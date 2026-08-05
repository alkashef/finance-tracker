# Finance Tracker — plan

Status legend: **✅ done** · **⬜ not started** · **⚠️ done, but differently than planned**

| Part | What | Status |
| --- | --- | --- |
| Part I | Retire the DC runtime, split into plain HTML/CSS/JS, reorganize docs | **✅ done** |
| Part II | Remove code smells: duplication, dead code, long methods/class, oversized JS and CSS files | **⬜ not started** |

Part I shipped; it is kept below as the record of what was done and why.
**Part II is the live plan — start there.**

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
  app. Any splitting must work with plain `<script>` / `<link>` tags.

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

### Open decision — how to split the JS ⬜

**Answer this before Phase 9.** `app.js` is a single classic script because the
original goal was for `index.html` to work from `file://`. That reason is now gone:
OAuth cannot work from `file://` at all, so the app already requires a server. ES
modules are back on the table.

- **(a) ES modules** — `<script type="module">`, real `import`/`export`, no globals,
  each file independently readable. Cost: the page can no longer be opened by
  double-clicking even for a UI-only look, and `test/smoke.html` must load the entry
  module the same way.
- **(b) Several classic scripts sharing one namespace object** — still works from
  `file://`, but reintroduces load-order coupling and a global.
- **(c) Leave `app.js` whole** and only fix the smells inside it.

**Recommendation: (a).** The `file://` compatibility that (b) protects is already
worthless for the real app, and (a) is the only option where module boundaries are
enforced rather than merely conventional.

### Open decision — how to split the CSS ⬜

- **(a) Several `<link>` tags** in `index.html`, in cascade order. Parallel fetches,
  no build step, trivially debuggable.
- **(b) One `styles.css` that `@import`s the rest.** One tag, but imports load
  serially and block rendering.

**Recommendation: (a)**, with a comment in `index.html` noting the order is
load-bearing.

### Phases

Each phase ends with `test/smoke.html` green in both scenarios plus a visual check of
the affected screens. Do them in order — later phases assume earlier ones.

#### Phase 5 — Delete dead code ⬜

Smallest, moves nothing, safe to do first.

1. ⬜ Remove the 6 `.about-*` classes, `.mb-0` and `.mb-24` from `styles.css`.
2. ⬜ Rename `.sb-about` → `.sb-footer-nav`, or fold it into an existing rule.
3. ⬜ Comment `v.scenarioInputs` to record that it is read via `lastVm`, so the next
   reader doesn't delete it.

#### Phase 6 — Collapse the CRUD duplication ⬜

The biggest single win: should take the ~470-line `actions` object closer to 150, and
make adding an entity a data change rather than four new handlers.

1. ⬜ Give each entity one descriptor: sheet name, headers, `state` key, form key, the
   empty-form literal, and `toRecord(form)` / `toForm(record)`. One place per entity
   instead of three.
2. ⬜ Derive `editX` / `cancelXForm` / `deleteX` generically from the descriptor —
   they differ only in which keys they touch.
3. ⬜ Keep `submitXForm` per entity **only where validation genuinely differs** (gold's
   price inheritance, transactions' To-Account rule, certificates' percent-to-fraction
   conversion). Do not force those into a generic shape; that trades duplication for
   worse indirection.
4. ⬜ Generate the 51 mechanical `fields` entries from the descriptors, keeping the 6
   that transform input (`txAmount`, `pfBalance`, and the four upper-casing ones) as
   explicit exceptions.

Watch for: the two `confirm()` prompts (accounts, tags) must survive, and so must the
ledger recompute that follows transaction and account writes.

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

#### Phase 8 — De-duplicate the view layer ⬜

1. ⬜ Add `tabBar(screen, activeTab, teal)`; replace all 5 copies.
2. ⬜ Add `statCard(label, value, colourClass)` and a small variant; replace the 25
   longhand blocks.
3. ⬜ Add `dataTable({ columns, rows, rowActions })` for the tables that share the
   header/row/actions shape. Leave the genuinely bespoke ones (dashboard currency
   cards, certificate groups) alone — forcing them through a generic helper costs
   more than it saves.
4. ⬜ Fold the repeated gain-colour ternary into one `gainClass(n)` helper.

#### Phase 9 — Split `app.js` ⬜

Depends on the ES-modules decision above. Target ~8 files, none over ~400 lines:

| File | Contents | Rough size |
| --- | --- | --- |
| `js/format.js` | `esc`, `fmtMoney`, `fmtEGP`, `fmtEUR`, `signed`, `formatAmountDisplay`, `sheetsFmtDate` | ~70 |
| `js/constants.js` | header arrays, tag constants, entity descriptors from Phase 6 | ~90 |
| `js/state.js` | the `state` object plus `set` / `setForm` / `toggle` | ~110 |
| `js/sheets.js` | OAuth and every Sheets API call | ~270 |
| `js/model.js` | `computeLedger` plus the per-domain builders from Phase 7 | ~420 |
| `js/views.js` | view helpers and screen views | ~700 |
| `js/actions.js` | the `actions` and `fields` maps | ~250 |
| `app.js` | render loop, event delegation, boot | ~120 |

⬜ If `js/views.js` is still over ~500 lines after Phase 8, split it per screen.

#### Phase 10 — Split and tokenize `styles.css` ⬜

1. ⬜ Introduce `:root` custom properties for the repeated literals — brand colours,
   the four font sizes, the three border radii, the border grey. **This is what kills
   the CSS duplication; splitting alone does not.**
2. ⬜ Split into cascade-ordered files:

   | File | Contents |
   | --- | --- |
   | `css/base.css` | reset, tokens, `body`, links, layout |
   | `css/components.css` | buttons, inputs, tables, tabs, pills, stat cards, chevrons |
   | `css/screens.css` | dashboard, stocks, certificates, plan, ledger |
   | `css/utilities.css` | the `.mb-*` helpers — last, so they win |

3. ⬜ Update `index.html` with `<link>` tags in that order, and comment that the order
   matters.

#### Phase 11 — Re-verify ⬜

1. ⬜ `test/smoke.html` green in both scenarios.
2. ⬜ Extend the smoke test with a check per new shared helper where cheap.
3. ⬜ Screenshot every screen before and after the whole of Part II and diff them —
   Phase 10's tokenizing is the step most likely to shift something by a pixel.
4. ⬜ Re-check the hand-restored behaviours: caret in text inputs, the search box,
   slider drag, scroll position.
5. ⬜ Update `docs/design.md` (file layout, module boundaries) and `CLAUDE.md` (file
   list, conventions) in the same change.

### Optional, not required ⬜

- ⬜ Derive the what-if slider's $10–$80 range from the current price instead of
  hardcoding it (Part I's "Known remaining item"). This is a behaviour change, so it
  needs sign-off separately rather than being folded into a refactor.

### Risks

- **Phase 6 is the risky one.** Collapsing 40 handlers into descriptor-driven code is
  where a wrong key silently writes the wrong column. Do it entity by entity, running
  the smoke test between each, rather than all ten at once.
- **Phase 10 can shift the visuals.** Replacing literals with tokens is mechanical but
  easy to fat-finger; the screenshot diff in Phase 11 is the safety net and should not
  be skipped.
- **Don't over-abstract.** Several of these smells are worth living with: bespoke
  validation, the dashboard's one-off cards, and the certificate group tables are all
  clearer written out. The goal is less repetition, not maximum genericity.
- **No rollback net beyond git.** Commit at each phase boundary so a bad phase can be
  reverted on its own — but only when asked, per `CLAUDE.md`.
