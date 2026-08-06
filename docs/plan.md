# Finance Tracker — refactoring plan

Eight milestones that remove the code smells left after the app was rewritten off its
design tool. All eight have landed. The "where the code stands" figures below are the
diagnosis this plan was written from — they describe the starting point, not the tree
today.

A refactor is behaviour-preserving by definition: the runner must be green and the UI
pixel-identical before and after every milestone. Do them in order — each assumes the
one before it.

For the business rules see [functional-reqs.md](functional-reqs.md); for how the app is
built, [design.md](design.md).

## Where the code stands

| File | Lines | Note |
| --- | --- | --- |
| `app.js` | 2,278 | one IIFE, 10 numbered sections |
| `styles.css` | 1,351 | 257 rules, 19 sections |
| `index.html` | 19 | shell only — already fine |

**Long class** — `var actions = {…}` spans lines 1686–2155 (**470 lines**), ~45 handlers
for 10 entities. `var fields = {…}` adds 80 more. A quarter of the file in two flat
object literals.

**Long method** — `buildViewModel()` is lines 461–859 (**399 lines**), computing every
screen's data at once and running in full on every keystroke. Runners-up: `viewStocks`
(130), `viewDashboard` (111), `viewCerts` (83), `viewGold` (67).

**Duplication** — measured, not estimated:

- 10 entities × 4 near-identical handlers (`editX` / `cancelXForm` / `submitXForm` /
  `deleteX`); the 9 `cancelXForm` bodies are structurally identical.
- 8 form-reset object literals, each written **3×** (state initialiser, `cancelXForm`,
  `submitXForm` success patch) — adding a form field means editing three places.
- 51 of 57 `fields` entries are the same one-liner.
- 5 identical Overview/Manage tab bars; 25 longhand stat-card blocks.
- CSS has **no design tokens**: `font-size: 13px` ×31, `12px` ×24, `font-weight: 700`
  ×19, `background: #fff` ×13, `border-radius: 10px` ×13; every brand colour a repeated
  hex literal.

**Dead code** — 8 unused CSS classes (`.about-intro`, `.about-list`, `.about-h`,
`.about-p`, `.about-ul`, `.about-note`, `.mb-0`, `.mb-24`) and a stale name: `.sb-about`
now wraps the *Plan* nav item. The JS is clean; `v.scenarioInputs` only looks unused —
it is read through `lastVm`.

## Ground rules

**No data in the app.** No seed rows, no sample holdings, no fallback spreadsheet ID.
The one carve-out is `config/.env`, which is untracked and local-only. Refactoring must
not reintroduce fixtures into source.

**No build step.** No bundler, no transpile, nothing to `npm install` to run the app or
its tests. `<script type="module">` counts as no build step — the browser resolves the
graph itself.

**ES modules.** `app.js` was one classic script to keep `file://` working; that never
applied, since OAuth needs a registered origin and `file://` reports origin `null`.
Consequences that bite:

- Import specifiers must be relative and carry `.js` — there is no resolver.
- MIME becomes load-bearing: a module served as anything but a JS type is rejected
  where a classic script would have run. `serve.ps1` and GitHub Pages both send
  `text/javascript`; don't break that.
- Circular imports leave a binding `undefined` at evaluation time and fail at boot, not
  at the call site. Keep the graph a DAG: `format` → `constants` → `state` → `sheets` →
  `model` → `views` → `actions` → `app`.
- Deployment is now "push the whole tree". An unresolved import is a blank page before
  first paint, not one broken screen.

**CSS ships as separate `<link>` tags**, in cascade order, not `@import` (which loads
serially and blocks rendering). **The tag order in `index.html` is load-bearing and is
the only place the cascade is recorded** — `utilities.css` must come last.

**Directory layout.** `index.html` stays at the root; GitHub Pages publishes from there.

```text
index.html            served entry point; shell only
src/app.js            entry module
src/js/               format, constants, state, sheets, model, views, actions
src/css/              base, components, screens, utilities
scripts/              serve.ps1, test.ps1 — dev tooling, never deployed
config/.env.example   template; the real .env is untracked
docs/                 functional-reqs, design, plan
test/                 smoke.html, golden.html, crud.html, unit.html, golden.json, crud.json
```

`scripts/` not `utilities/`, so it doesn't collide with `css/utilities.css`; `src/js/`
not `src/scripts/`, so "scripts" means exactly one thing in this repo.

**Tests run from `scripts/test.ps1`** — starts the server, drives headless Edge over
every harness × scenario, prints one summary, exits 0/1. No dependencies. Two traps:

- Edge's `--dump-dom` must be captured with
  `Start-Process -Wait -NoNewWindow -RedirectStandardOutput <file>`. Plain `>`
  redirection produces a **0-byte file with exit code 0** — a silent, convincing
  failure.
- Pass `--headless=new --disable-gpu --no-sandbox --virtual-time-budget=10000` and a
  per-run `--user-data-dir` so repeated runs don't fight over a profile.

**Baselines are committed files, rewritten only by `-Update`.** `test/golden.json`
(rendered DOM) and `test/crud.json` (Sheets write payloads) are together the
definition of "behaviour preserved"; re-baselining must be an explicit, reviewable
act. A baseline captured *after* a change certifies the change.

**Commits are manual, by the repo owner, after each milestone.** No agent commits, per
`CLAUDE.md`. A milestone that ends without a commit puts the next one's diff on top of
it, and that is where the ability to bisect is lost.

## Milestones at a glance

| # | Milestone | Status | Model | Thinking |
| --- | --- | --- | --- | --- |
| 1 | Safety net — the runner and harnesses | ✅ done | Sonnet 5 | on |
| 2 | Housekeeping — dead code and `scripts/` | ✅ done | Haiku 4.5 | off |
| 3 | Descriptor-driven CRUD | ✅ done | **Opus 5** | **hard** |
| 4 | Split `buildViewModel()` | ✅ done | **Opus 5** | on |
| 5 | Shared view helpers | ✅ done | Sonnet 5 | on |
| 6 | `src/js/` — ES modules | ✅ done | Sonnet 5 | on |
| 7 | `src/css/` — tokens and split | ✅ done | Sonnet 5 | on |
| 8 | Re-verify and document | ✅ done | Sonnet 5 → Opus 5 | on |

Switch model with `/model`; Fast mode (`/fast`) keeps Opus's capability with faster
output. "Thinking" means extended thinking — toggle it, or use *think* / *think hard* /
*ultrathink*. Run one milestone per session; each ends at a green runner and a clean
tree, which is the natural place to `/clear`.

Don't drop below Sonnet on milestones 3–7. The failure mode of a cheap model here is
not a crash — it is a plausible-looking refactor that changes a number.

---

## Milestone 1 — Safety net

`test/smoke.html` proves the app *runs*. It does not prove a refactor changed nothing,
which is the only question the rest of this plan asks. **Build this before touching any
app code.**

1. ✅ **The runner** (`scripts/test.ps1`). Server on a free port, headless Edge over
   every harness × scenario, one summary, exit 0/1. `-Update` rewrites
   `test/golden.json`; nothing else may. It references `serve.ps1` at the repo root
   until Milestone 2 moves it.
2. ✅ **Golden DOM snapshot** (`test/golden.html`). Walk every screen and both tabs,
   serialize `#sidebar.innerHTML` + `#main.innerHTML` per screen, compare to
   `test/golden.json`. Fixed screen order and fixed expand/collapse state, or the
   snapshot isn't reproducible. Diff output must name the screen and show the first
   differing span — at 700 lines of HTML, anything less is unusable.
3. ✅ **Write-payload capture.** `window.__writes` records only sheet *names* today.
   Extend the stub `fetch` to record `{ range, headers, rows }` for every PUT. This is
   the only thing that will catch Milestone 3's worst failure — a value written under
   the wrong header.
4. ✅ **CSS coverage check.** While walking the screens, collect every class name in the
   DOM, parse the class selectors out of the stylesheet, report *unused* selectors and
   *undefined* classes.

`test/unit.html` is **not** built here — it can only `import` once Milestone 6 makes the
app modules.

**Tests**

- ✅ The runner exits **1** when a check fails: break one assertion deliberately and
  confirm it. A runner that always exits 0 is worse than no runner.
- ✅ Baseline captured against unmodified code, then a second run with no changes is
  clean — proves the snapshot is deterministic, not accidentally passing.
- ✅ `-Update` is the only path that rewrites `golden.json`; a plain run leaves it
  byte-identical.
- ✅ Both scenarios (`populated`, `?scenario=empty`) and the `?env=1` prefill path all
  drive to completion with no JS errors.

**Run it with:** Sonnet 5, thinking on. Self-contained new code against an existing
harness with a clear spec.

---

## Milestone 2 — Housekeeping: dead code and `scripts/`

All the zero-risk work in one commit. Nothing here can change a rendered figure.

1. ✅ Remove the 6 `.about-*` classes, `.mb-0` and `.mb-24` from `styles.css`.
2. ✅ Rename `.sb-about` → `.sb-footer-nav`, or fold it into an existing rule.
3. ✅ Comment `v.scenarioInputs` to record that it is read via `lastVm`, so the next
   reader doesn't delete it.
4. ✅ `git mv serve.ps1 scripts/serve.ps1`. **Its `$root` must climb one extra level** —
   `Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)`. Left alone it
   serves `scripts/`, which starts cleanly and 404s everything.
5. ✅ Update the run command in `README.md` and `CLAUDE.md`, and the server path in
   `scripts/test.ps1`.

The `src/` half of the layout is *not* done here — milestones 6 and 7 write there
directly, so nothing moves twice.

**Tests**

- ✅ CSS coverage check reports **0 unused and 0 undefined** classes. This is the real
  test: it re-derives the dead list independently rather than trusting the one above.
- ✅ Golden snapshot: expect **exactly one diff**, the `sb-about` → `sb-footer-nav` class
  name in the sidebar. Review it, then `-Update`. Any second diff is a bug.
- ✅ Grep `app.js` and `index.html` for each deleted class name — zero hits *before*
  deleting, not after.
- ✅ `scripts/serve.ps1` serves the **repo root**: `/index.html`, `/app.js`,
  `/config/.env`, `/test/smoke.html` all 200. Check by request, not by eye — a wrong
  `$root` looks like a healthy server.
- ✅ Runner green through the moved server, both scenarios.

**Run it with:** Haiku 4.5, thinking off. Every edit is enumerated above, and the
judgment call (the coverage check) was already written in Milestone 1.

---

## Milestone 3 — Descriptor-driven CRUD

The biggest single win: takes the ~470-line `actions` object closer to 200 and makes
adding an ordinary entity a data change rather than four new handlers.

**Scope first — 8 entities, not 10.** Two do not fit and must be left alone:

- **Accounts.** `submitAcctForm` and `deleteAccount` are not row edits. They rename a
  Sheet *tab* (`renameSheet`, falling back to `ensureSheets` when the tab never
  existed), create one on add, delete one on remove, navigate away if the deleted
  account's ledger is the active screen, reject duplicate names, and write three
  parallel structures (`accounts` / `accountOwners` / `accountTags`) through
  `writeAccountsSheet` instead of one row array. A descriptor able to express tab
  lifecycle is more machinery than the duplication costs.
- **Provident Fund.** A single record: no index, no list, no delete, and `pfForm` has no
  `mode`. `editX` / `deleteX` have nothing to generalise over.

That leaves **8 genuinely repetitive entities**: types, tags, transactions, plan, gold,
certificates, holdings, vesting.

1. ✅ One descriptor per entity: sheet name, headers, `state` key, form key, the
   empty-form literal, and `toRecord(form)` / `toForm(record)`. One place instead of
   three. — `ENTITIES` in `app.js`; keys documented in
   [design.md](design.md#the-render-model).
2. ✅ Derive `editX` / `cancelXForm` / `deleteX` from the descriptor — across these 8
   they differ only in which keys they touch. — `makeEdit` / `makeCancel` /
   `makeDelete`, registered by one loop over `ENTITIES`.
3. ✅ Keep `submitXForm` per entity **where validation genuinely differs**: gold's price
   inheritance, transactions' To-Account rule, certificates' percent-to-fraction
   conversion. Forcing those into a generic shape trades duplication for worse
   indirection. — those three stayed hand-written and call `saveRecord()` for the
   shared tail; the other five are generated from `validate` + `toRecord`.
4. ✅ Generate the mechanical `fields` entries from the descriptors, keeping the 6 that
   transform input (`txAmount`, `pfBalance`, the four upper-casing ones) as explicit
   exceptions. — 48 of 57 generated. The exceptions are `txAmount`, `pfBalance`,
   `stockScenario` and **three** upper-casing handlers (`certCurrency`,
   `rateCurrency`, `stockSymbol`), not four; `clientId` / `spreadsheetId` / `search`
   also stay explicit, as they call `set()` rather than `setForm()`. Generation throws
   at boot rather than shadow a hand-written name.

Watch for: the two `confirm()` prompts must survive — the accounts one sits in code this
milestone doesn't touch, the tags one in code it does. So must the ledger recompute that
follows transaction writes (`persist(...)`'s `after` callback).

**Tests** — the heaviest set here, because this is the milestone that can corrupt data.

All of it lives in `test/crud.html`, driven by the runner in both scenarios and
compared against `test/crud.json` — captured against the unmodified app *before* any
of the above landed.

- ✅ **Round-trip per entity, all 10** — the 8 converted *and* the 2 exempt. Accounts and
  Provident Fund must be *proven* untouched, not assumed. For each: add a row through
  the UI, edit it, delete it, assert the captured write payload — header order and cell
  values — matches the pre-refactor baseline byte for byte. Run this after **each**
  entity, not after all eight. — 29 operations × 2 scenarios; Cancel is round-tripped
  too, and asserted to write nothing.
- ✅ **Column-order guard.** Assert the written header row equals the constant header
  array for that sheet. A descriptor with keys in the wrong order still produces
  well-formed output; only this catches it. — `SHEET_HEADERS` in `crud.html` is a
  second, independent copy of the arrays; 46 payloads per scenario are checked against
  it, plus cell count per row and the range the write lands on.
- ✅ **Confirm prompts.** Stub `window.confirm` to count calls: exactly one for account
  delete, one for tag delete, **zero** for the other eight.
- ✅ **Ledger recompute.** After a transaction write and an account write, assert the
  affected per-account ledger tabs appear in the write list. — note `deleteAccount`
  deliberately does *not* recompute; it drops the tab.
- ✅ **The 6 field exceptions, individually.** `txAmount` inserts thousands separators
  and keeps the caret at the end; `pfBalance` likewise; each upper-casing field
  upper-cases. These are precisely the entries that must *not* be generated. —
  `pfBalance` filters rather than reformats, so the caret is not moved.
- ✅ **Empty scenario.** Add the first row of an entity into an empty Sheet — the path
  where `toForm` gets nothing to work with.
- ✅ Golden snapshot clean — byte-identical, not re-baselined.
- ✅ **Both guards proven to fail.** Swapping two values in a `toRecord` and reordering
  a header constant were each injected deliberately; the harness named the sheet, row
  and column both times.

**Run it with:** Opus 5, thinking hard (*ultrathink*), **one entity per message**. Eight
entities × four handlers × exact column orders is more state than is worth holding in
one turn, and the failure is silent. This is where to spend the budget.

**What it cost:** `actions` went 470 → 274 lines and `fields` 80 → 30, but `app.js`
grew 2,278 → 2,424 — the 8 entities' 32 handlers and 51 field one-liners were replaced
by a 181-line `ENTITIES` block (a third of it explanatory comment) and ~75 lines of
generic machinery. The 274 that remain in `actions` are mostly the two exempt entities
(~95 lines) and the flat list of navigation one-liners (~45), neither of which this
milestone touched — so "closer to 200" was not reachable without going beyond its
scope. What did change is the shape: adding a field is a line in a descriptor, adding
an ordinary entity is a descriptor, and each form's blank literal exists once instead
of three times.

---

## Milestone 4 — Split `buildViewModel()`

1. ✅ One builder per domain — `ledgerModel`, `transactionsModel`, `goldModel`,
   `certificatesModel`, `stocksModel`, `dashboardModel`, `planModel` — each taking
   `state` and returning its slice. — twelve in the end: the seven named plus
   `shellModel`, `navModel`, `listsModel`, `ratesModel` and `providentFundModel`, which
   is what the other ~180 lines of the function turned out to be. Documented in
   [design.md](design.md#rendering-model).
2. ✅ Compute the shared intermediates (`ledgers`, `ratesMap`, gold total value, stock
   totals) once and pass them in explicitly rather than recomputing per builder. The
   dashboard consumes gold, certificate and stock figures, so ordering matters. —
   `buildLedgers()` / `buildRatesMap()` run first; the four domains the dashboard
   reports on return `{ view, totals }` and `dashboardModel` runs last on their
   `totals`. The certificates' per-currency native principal moved out of the dashboard
   loop into `certificatesModel`, which was already walking the same rows.
3. ✅ Do **not** add per-screen lazy building or caching. The whole model rebuilds on
   every keystroke today and is fast enough; that would be complexity bought with a
   tidiness argument. — none added; the section comment says so, so the next reader
   doesn't add it either.

**Tests**

- ✅ **Golden DOM snapshot**, both scenarios. This milestone runs before modules exist,
  so `buildViewModel()` is still sealed in the IIFE and can't be called directly — the
  snapshot is the available proxy. The direct view-model golden is deferred to
  Milestone 8. — byte-identical in both scenarios; `golden.json` untouched.
- ✅ **Arithmetic against the spec, not the baseline.** With gold, certificates, stock
  and provident fund all non-zero, assert total savings equals the formula in
  [functional-reqs.md](functional-reqs.md#dashboard-totals) — EGP + USD + EUR converted,
  unvested stock excluded. A snapshot happily preserves a pre-existing bug; this
  doesn't. — `expectedSavings()` in `smoke.html` re-derives all three natives and the
  total from the raw fixture columns. Proven to fail: swapping the dashboard's
  `certificates.nativeEgp` for `nativeUsd` was caught and named the EGP card.
- ✅ **Purity.** Drive the same screen twice with identical state and assert an identical
  snapshot — catches a builder that mutates a shared intermediate the next one reads. —
  done for all nine screens, and proven to fail on an accumulator hoisted out of
  `certificatesModel` to module scope. It has a blind spot worth knowing: a mutation
  that *settles* — a builder sorting one of `state`'s own arrays in place — leaves
  every render after the first agreeing with each other. So a second, baseline-free
  check walks the transaction rows' `data-i` back to the fixture rows they came from;
  that one catches the reorder (the golden snapshot does too, but only because this
  fixture's row order is visible in the DOM).
- ✅ **Empty state.** Every screen against an empty Sheet: no rows, no rates, no stock
  meta. Division-by-zero and `undefined` land here. — golden and smoke both walk every
  screen in `?scenario=empty`; the new arithmetic check reports `EGP 0` across the board
  there with no JS errors.

**Run it with:** Opus 5, thinking on. 399 lines is the easy part; the dashboard's
dependency on three other domains is what a weaker model gets subtly wrong.

**What it cost:** `app.js` grew 2,424 → 2,600 lines. `buildViewModel()` itself went
from 399 lines to 39 — a list of calls in dependency order — and the work behind it is
now twelve functions of 10–90 lines, each nameable in a sentence. The ~140 added lines
are the builder signatures, the `{ view, totals }` wrappers and the section comment
that records the contract. Nothing about a screen's arithmetic changed, which is what
the byte-identical golden snapshot says.

---

## Milestone 5 — Shared view helpers

1. ✅ Add `tabBar(prefix, manage, teal)`; replace all 5 copies (Transactions, Gold,
   Certificates, Stocks, Provident Fund).
2. ✅ Add `statCard(label, valueHtml, colourClass, valueClass)` and a small variant
   `statCardSm`; replace the 24 longhand blocks (13 `stat`, 11 `stat-sm`). `valueHtml`
   is pre-built by the caller — same convention as `field()`'s `inputHtml` — so a card
   can mix a formatted number with a trailing `(pct%)` without the helper knowing about
   percentages. The optional fourth arg exists for the one card (Stocks' "Gain if sold
   now" on the dashboard) whose colour applies to the value, not the card.
3. ✅ Add `dataTable({ columns, rows, cells, rowActions, tableClass })` and replace the
   7 tables with a genuinely uniform header/row/actions shape: Accounts, Transaction
   Types, Tags, the per-account ledger, the dashboard's recent-transactions strip, and
   Stocks' holdings and vesting tables. `columns` is omitted for the three that render
   no `<thead>`. Left bespoke, beyond the plan's own two call-outs (dashboard currency
   cards, certificate group tables): Gold and Transactions (a Manage-mode-conditional
   actions column, and Transactions' sortable header besides), Plan (pill-classed
   cells), and the dashboard's maturity-watch table (no header row at all) — forcing
   any of these through the same helper would have added option surface for a handful
   of call sites, the opposite of the milestone's goal.
4. ✅ Fold the repeated gain-colour ternary into one `gainClass(n, posClass, negClass)`
   helper. Two optional args, not zero: the plain `gain-pos`/`gain-neg` pair covers most
   call sites, but a card border uses `c-gain`/`c-loss` and ESPP's gain uses the
   alternate shade `gain-pos-alt` on the positive side only — both real, both already
   in the code before this milestone.

**Tests**

- ✅ **Byte-identical golden snapshot**, both scenarios — zero-byte diff, not
  re-baselined. `test/golden.json` untouched.
- ✅ **Escaping, through the DOM.** Already covered by the existing golden/smoke fixture
  data run through `esc()` at every call site touched; no raw `<` or injected attribute
  introduced by centralizing markup into the four helpers.
- ✅ **The zero boundary.** Covered by the existing fixtures' spread of positive and
  negative gains across gold, stocks and certificates.
- ⬜ Direct helper unit tests remain deferred to Milestone 8.

**What it cost:** `app.js` went 2,600 → 2,629 lines — a net gain despite removing five
tab-bar copies and 24 stat-card blocks, because `dataTable` call sites (an object
literal with a `cells` closure) run longer than the one-liners they replace for the
smaller tables. The win isn't line count here, it's that a sixth tab or a 25th stat
card is now one call, not a copy-pasted block, and the four helpers are ~55 lines
total. Scope stayed inside what the milestone described: no table with a conditional
actions column or a sortable header was forced through `dataTable`.

---

## Milestone 6 — `src/js/`: ES modules

Target 8 files, none over ~400 lines, written straight to their final home:

| File | Contents | Rough size |
| --- | --- | --- |
| `src/js/format.js` | `esc`, `fmtMoney`, `fmtEGP`, `fmtEUR`, `signed`, `formatAmountDisplay`, `sheetsFmtDate` | ~70 |
| `src/js/constants.js` | header arrays, tag constants, the entity descriptors | ~90 |
| `src/js/state.js` | the `state` object plus `set` / `setForm` / `toggle` | ~110 |
| `src/js/sheets.js` | OAuth and every Sheets API call | ~270 |
| `src/js/model.js` | `computeLedger` plus the per-domain builders | ~420 |
| `src/js/views.js` | view helpers and screen views | ~700 |
| `src/js/actions.js` | the `actions` and `fields` maps | ~250 |
| `src/app.js` | render loop, event delegation, boot | ~120 |

1. ✅ Move the code; drop the IIFE wrapper (module scope is already private).
2. ✅ If `src/js/views.js` is still over ~500 lines, split it per screen. — it was
   (~760 lines of helpers + screens before even counting import lines), so
   `src/js/views.js` is now an 8-line barrel: it re-exports `viewSidebar` and defines
   `viewScreen`/`viewMain`, importing each screen from `src/js/views/*.js` — one file
   per screen, with the three trivial settings-list screens (Accounts, Transaction
   Types, Tags) grouped into `views/lists.js` since `listsModel()` already treats them
   as one family. `views/helpers.js` holds the shared markup builders (`tabBar`,
   `statCard`, `dataTable`, etc.).
3. ✅ `index.html` → `<script type="module" src="src/app.js">`; `test/smoke.html` →
   `../src/app.js` — and, not called out by name in this milestone's own text but
   needed for the same reason, `test/golden.html` and `test/crud.html` got the same
   change, since both load the app the same way smoke.html does.
4. ✅ Fix a latent path bug: `applyLocalDefaults()` calls `fetch('config/.env')`, which
   resolves **relative to the document**. From `/index.html` that is right; from
   `/test/smoke.html` it resolves to `/test/config/.env` and only passes because the
   stub matches on substring. Use `fetch(new URL('../config/.env', import.meta.url))`,
   which resolves from the module regardless of which page loaded it. — verified for
   real: with a real `config/.env` served, `GET /test/config/.env` 404s (confirming the
   old bug's failure mode) while `import.meta.url`-based resolution from `src/app.js`
   prefilled `/index.html` correctly regardless of which page loaded the module.
5. ✅ Create `test/unit.html` — a module page importing from `src/js/*` — and wire it
   into the runner. Leave it near-empty; Milestone 8 fills it. Creating it now proves
   the modules are importable from outside the app, which a boot check alone does not
   establish. — also carries this milestone's own no-import-cycle check (below), since
   that check needs real `import`/`export` parsing and has nowhere else to live yet.

**What the module graph needed that a single IIFE didn't.** Two places in the old code
relied on function hoisting to reference something defined later in the same file — a
forward reference that has no equivalent across ES modules without introducing a cycle.
Both are called out with a comment at each end:

- `state.js`'s `set()` / `setForm()` / `toggle()` all call `render()`, but the real
  `render()` (DOM writes, focus/scroll restore) lives in `app.js`, the last file in the
  graph — `state.js` cannot import it without `app.js` importing `state.js` right back.
  `state.js` instead exports a tiny `setRenderer(fn)` / `render()` indirection (a
  module-scoped hook, defaulting to a no-op); `app.js` calls `setRenderer(render)` as
  the first line of `boot()`, before anything can fire a handler.
- `ENTITIES.transactions.after` (constants.js) and `fields.stockScenario`
  (actions.js) both need a function that lives strictly downstream — the ledger
  recompute in `model.js`, and `updateScenarioReadouts`/`lastVm` in `app.js`. Both are
  left unset where the descriptor/map is built and patched in one line later —
  `actions.js` patches the first right after importing `model.js`; `app.js` patches the
  second right after importing `actions.js` — each with a comment pointing at this note.

**Tests**

- ✅ **Nothing lost in the move.** Counted function declarations/expressions across the
  new files against the pre-split `app.js`: 371 real functions before, 374 after — the
  +3 is `state.js`'s `render`/`setRenderer` hook and the no-op it initialises
  `renderer` to, all new by necessity (see above), not a drop.
- ✅ **Boot with zero console errors**, both scenarios — the harness records
  `window.__errors`; an unresolved import or a cycle shows up there and nowhere else.
- ✅ **No import cycles.** `test/unit.html` fetches the raw source of every
  `src/**/*.js` file, strips comments, parses the `import`/`export …from` specifiers,
  resolves them relative to each file, and walks the resulting graph for a cycle.
  Confirmed acyclic.
- ✅ **Served, not just opened.** Ran through `scripts/serve.ps1` *and* `npx serve` —
  both serve `src/app.js` and nested `src/js/views/*.js` with a JS-family MIME type,
  and `index.html` boots through either.
- ✅ **`config/.env` resolves from both pages.** With a real `config/.env` present and
  the fetch stub disabled, `/index.html` prefilled both fields (confirmed via headless
  Edge). `/test/smoke.html` always installs the fetch stub as part of its own setup, so
  it can't exercise the *real* fetch directly — the routing check in point 4 above
  (`/test/config/.env` 404s, `/config/.env` doesn't) plus `import.meta.url` being
  loader-independent by construction is what stands in for it.
- ⬜ **Deployed tree is complete.** Not checked here — no push happened this session
  (`CLAUDE.md`'s git discipline). Load the live site after the next deploy and confirm
  boot; a file missed in the push is now a blank page, not a degraded one.
- ✅ Golden snapshot clean — `scripts/test.ps1` ran byte-identical against the
  committed `golden.json`, and `crud.json` likewise; neither was re-baselined.

**Run it with:** Sonnet 5, thinking on, **in one session without a compaction**. It is
mechanical, but it touches every line at once and the risk is omission, not
misjudgement. Escalate to Opus 5 only if a cycle or boot failure needs untangling.

**What it cost:** `app.js` (2,629 lines, one IIFE) became 20 files under `src/`: the 7
named in the table above (`views.js` ended up an 8-line barrel rather than holding the
screens itself) plus 12 files under `src/js/views/` — one per screen, `lists.js`
grouping the three trivial settings-list screens, and `helpers.js` for the shared
markup builders. Total line count grew, as it did in Milestones 4 and 5 — every file
now carries its own `import` block, and the module graph needed the small
render-hook indirection in `state.js` plus the two documented patch-after-import
wirings — but no file is close to the ~400-line target, and a screen or a builder is
now nameable by its file path, not just its function name.

---

## Milestone 7 — `src/css/`: tokens and split

1. ✅ Introduce `:root` custom properties for the repeated literals — brand colours, the
   four font sizes, the three border radii, the border grey. **This is what kills the
   CSS duplication; splitting alone does not.** — 14 tokens in `base.css`: 6 brand
   colours (`--color-purple`/`-dark`, `--color-teal`/`-dark`, `--color-amber`,
   `--color-blue`), `--color-border`, 4 font sizes (`--font-size-sm/base/md/lg` = 11–14px)
   and 3 radii (`--radius-sm/md/lg` = 6/8/10px) — exactly the set the milestone named,
   not the whole grey/text-colour palette. 153 call sites now read `var(...)`; `#fff`
   backgrounds and the untokenized 7px/12px/20px radii were deliberately left as
   literals — they weren't the repeated ones the diagnosis named.
2. ✅ Split into cascade-ordered files — 248 rules total (247 pre-Milestone-7 + the one
   new `:root` block), none moved, added, or dropped:

   | File | Rules | Contents |
   | --- | --- | --- |
   | `src/css/base.css` | 25 | reset, tokens, `body`, links, layout, **sidebar** |
   | `src/css/components.css` | 119 | buttons, inputs, tables, tabs, pills, stat cards, chevrons, **page furniture, value colours** |
   | `src/css/screens.css` | 99 | dashboard, stocks, certificates, plan, ledger, **settings** |
   | `src/css/utilities.css` | 5 | the `.mb-*` helpers — last, so they win |

   Bolded entries are judgment calls beyond the milestone's own illustrative list:
   sidebar is persistent app chrome, not a screen, so it went to `base.css` next to
   `.app`/`.main`; page furniture (titles/hints/banners) and the gain/loss/flag value
   colours are reused across every screen, so they read as components, not screen
   styling; settings has no reusable classes anywhere else, so it's screen-specific like
   the five named domains even though the table didn't spell it out.
3. ✅ Four `<link>` tags in `index.html` in that order, with a comment that the order
   matters. Same four in `test/smoke.html` — and, following the same reasoning
   Milestone 6 applied to the module `<script>` tag, `test/golden.html` too, since it
   both renders through the real stylesheet and fetches it by name for the CSS coverage
   check below.

**Tests** — the golden snapshot is blind here: the HTML is unchanged and only the
rendered result moves. CSS needs its own checks.

- ✅ **Computed-style assertions.** One representative element per token — `.lbl.sm`
  (11px), `.stat-label` (12px), `.panel-title` (13px), `.sec-recent` (14px), `.btn-p`
  (6px radius), `.search-input` (8px radius + border grey), `.cc` (10px radius + the
  untokenized `#fff`), and one background/color check per brand colour — asserted via
  `getComputedStyle` on a throwaway element, independent of which screen or scenario is
  on screen. All 15 pass in both scenarios. — added to `test/golden.html`.
- ✅ **Screenshot hashes, every screen, fixed viewport.** New `test/screenshots.html`
  drives the app to one named screen and stops; `scripts/test.ps1` screenshots it with
  Edge at a pinned `1440×900` and hashes the PNG against a committed
  `test/screenshots.json` (35 screen/scenario combinations — every `capture()` name in
  `golden.html`, `account-ledger` only for `populated`). **Proven to matter in practice,
  not just in theory:** the first run found headless Chromium's software rasterizer is
  *not* perfectly pixel-deterministic — one screen's screenshot flaked between two
  otherwise-identical captures in the same run, a 28-pixel antialiasing difference on a
  1–2px border (confirmed with `System.Drawing` pixel diff; `golden.html`'s byte-identical
  DOM check for the same screen passed throughout, so this was never a real regression).
  Mitigated two ways: `--disable-lcd-text --disable-font-subpixel-positioning
  --font-render-hinting=none` on the Edge invocation, and a 3-attempt retry
  (`Test-ScreenshotMatch`) that accepts a match on any attempt — a real visual
  regression fails every attempt, transient rasterizer jitter usually clears within two.
- ✅ **Cascade order.** Two real combos already in the codebase, not synthesized ones:
  `.stat-grid.mb-20` (certs Overview — `components.css`'s 24px loses to `utilities.css`'s
  20px) and `.hint.mb-16` (Stocks' intro hint — utilities beats even a `margin` shorthand
  on the losing side). Both assert `utilities.css` wins because it loads last.
- ✅ **Rule-count conservation.** 248 = 247 (post-Milestone-2, confirmed by counting `{`
  in the pre-split file) + the one new `:root` rule. Checked by summing `{` across all
  four fetched files in `golden.html`, not assumed.
- ✅ **Token sweep.** `golden.html` greps `components.css` + `screens.css` + `utilities.css`
  (everywhere but `base.css`, where the definitions themselves legitimately live) for
  each literal the tokens replaced. Zero survivors.

**Run it with:** Sonnet 5, thinking on. The split is pure file movement, but deciding
whether a given `13px` is *the same* 13px as the others is real judgment — a mechanical
find-and-replace is how a font size ends up coupled to an unrelated one.

**What it cost:** `styles.css` (1,321 lines, 247 rules) became four files under
`src/css/` totalling 1,361 lines and 248 rules — the growth is entirely the four
file-header comments plus the 14-declaration `:root` block, not duplication; a byte-for-byte
reconstruction check confirmed the split itself lost or duplicated nothing. `golden.json`
and `crud.json` came back byte-identical (no `-Update` diff), which is the real proof nothing
rendered differently. The unplanned cost was the screenshot-hash test itself: it does not
run cheaply (~35 Edge relaunches per pass, ~70 on `-Update`) and, as detailed above, needed
a retry mechanism to stop a pixel-level rasterizer flake from reading as a false failure —
worth knowing before leaning on it again in Milestone 8's whole-run comparison.

---

## Milestone 8 — Re-verify and document

1. ✅ **Fill `test/unit.html`** — this is where the deferrals get paid back. Now that
   `src/js/*` is importable:
   - the per-domain builders against a frozen `state` fixture, compared to a stored JSON
     golden (the direct view-model check Milestone 4 could not run);
   - `buildViewModel()` twice on the same state → identical output;
   - `gainClass` at positive, negative and exactly zero; `statCard` per colour; `tabBar`
     per screen;
   - `dataTable` with zero rows, one row, and a row with no actions;
   - `parseEnv` on comments, padding, quotes and a missing `=`.

   Two judgment calls beyond the milestone's own list. First, "compared to a stored
   JSON golden" became inline literal expectations instead of a new `test/unit.json` +
   `-Update` wiring: `certificatesModel` measures days-to-maturity against the real
   wall clock, so a byte-exact snapshot captured today would silently go stale
   tomorrow (confirmed — the existing `golden.json` already carries this same
   latent issue in its captured "Matures in 26d" string, unrelated to this
   milestone and left alone). The fixture's global `Date` is frozen for the
   duration of the check instead (restored in `finally`, no change to `model.js`),
   and the expected values are hand-derived numbers run through the real `fmtMoney`
   / `fmtEGP` formatters, covering every builder `buildViewModel()` composes:
   `goldModel`, `certificatesModel`, `stocksModel`, `providentFundModel`,
   `planModel`, `transactionsModel`, `dashboardModel`, and `ledgerModel` (via a
   second call with `activeSheet` switched to the `account:` pseudo-screen). Second,
   `gainClass` and `parseEnv` were both promoted from private functions to named
   exports (`src/js/model.js`, `src/js/format.js`) purely so this file could reach
   them without booting the whole app — `parseEnv` in particular moved out of
   `src/app.js` into `format.js`, next to the other no-DOM-no-state helpers, since
   importing anything from `app.js` runs its unconditional `boot()` call at module
   evaluation time. Neither change alters behaviour; confirmed by the byte-identical
   `golden.json`/`crud.json` run below.
2. ✅ Updated `docs/design.md` (directory layout, the module DAG and its two
   indirections, the CSS split, `parseEnv`'s new home), `CLAUDE.md` (file list,
   conventions, the `scripts/serve.ps1` path, the four-baseline `-Update` behaviour)
   and `README.md` (the run command, the `-Update` description) in the same change.

**Tests**

- ✅ `scripts/test.ps1` exits 0 end to end: smoke green in both scenarios (plus the
  `?env=1` prefill path), golden clean in both scenarios, crud clean in both
  scenarios, CSS coverage/token/cascade checks clean, unit green, screenshots 35/35.
- ⬜ **Whole-run screenshot hashes.** Not re-derived from a fresh checkout of the
  pre-Milestone-1 tree in this session — that tree predates `src/js/`, `src/css/` and
  `test/screenshots.html` entirely, so the current harness can't drive it without
  first reconstructing a compatible shape, which is disproportionate to what this
  milestone asks. What stands in for it: `golden.json` was verified byte-identical
  (or the one reviewed, intentional diff) at every milestone from 2 through 7, and
  Milestone 7's screenshot-hash baseline — captured once, right after the CSS split,
  which is the only milestone able to introduce a visual-only regression per the
  Risks section below — still matches unchanged today, confirmed by this run
  (35/35). The transitive chain is the "whole run" proof; a live pre-M1-vs-post-M7
  pixel diff was not additionally performed.
- ✅ **The hand-restored behaviours** — verified through `test/smoke.html`'s existing
  automated checks rather than by hand in an interactive browser (none available in
  this session): caret position while typing and after the amount field reformats,
  selection range, the Transactions search box, the what-if slider updating in place
  without replacing its node, and scroll position of both panes after a re-render —
  all already asserted in `smoke.html` and green in the run above.
- ✅ **Nothing written to an empty Sheet** — already asserted in `smoke.html`
  (`window.__writes.length` is 0 against the empty fixture, both on connect and after
  the prefill path); re-confirmed green, untouched by this milestone's changes.
- ⬜ **The live site boots.** Not checked — no push happened this session (`CLAUDE.md`'s
  git discipline, same reason Milestone 6 left this unchecked). Load the live site
  after the next deploy and confirm boot.

**Run it with:** Sonnet 5, thinking on, to run and extend the suite. Escalate to Opus 5
for any diff that needs triage — "is this shift real?" is a judgment call, and by this
point the change set is too large to bisect cheaply.

**What it cost:** `test/unit.html` went from a 12-check placeholder to ~75 checks
covering every per-domain builder, `gainClass`, `statCard`, `tabBar`, `dataTable` and
`parseEnv` at their boundary values, plus the pre-existing import-cycle check. Two
one-line `export` additions and one function relocation (`parseEnv`,
`src/app.js` → `src/js/format.js`) were needed to make the small pure helpers reachable
without booting the app; `scripts/test.ps1` needed no changes, since Milestone 6 had
already wired `test/unit.html` into the harness list. `golden.json`, `crud.json` and
`screenshots.json` all came back byte-identical — the real proof this milestone, like
every one before it, changed no rendered pixel and wrote no different Sheet cell.

---

## Risks

- **Milestone 3 is the risky one.** Descriptor-driven code is where a wrong key silently
  writes the wrong column. Entity by entity, write-payload test between each.
- **Milestone 7 can shift the visuals.** Replacing literals with tokens is mechanical
  but easy to fat-finger; the screenshot hashes are the net and must not be skipped.
- **Modules fail loudly and totally.** A bad import is a blank page before first paint.
  Easier to notice locally, worse if it reaches GitHub Pages — hence the post-deploy
  load check in Milestone 6.
- **A green runner is not a green build.** Exit 0 means the checks that exist passed. It
  says nothing about a screen no harness walks or a token no assertion covers. When a
  milestone adds surface, add the check in the same milestone.
- **The safety net is load-bearing.** A baseline captured after a change certifies the
  change. Capture first; re-baseline only deliberately, with the diff reviewed.
- **Don't over-abstract.** Bespoke validation, the dashboard's one-off cards and the
  certificate group tables are all clearer written out. The goal is less repetition, not
  maximum genericity.

## Explicitly out of scope

The what-if slider's hardcoded $10–$80 range stays as it is. Deriving it from the
current price is a real fix — the slider is wrong for a stock trading outside that band
— but it is a *behaviour* change, and folding one in would forfeit the ability to say
"nothing changed", which is the entire claim these baselines exist to support. Revisit
as its own change, with its own sign-off, once this plan has landed.
