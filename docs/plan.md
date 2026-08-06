# Finance Tracker — refactoring plan

Eight milestones that remove the code smells left after the app was rewritten off its
design tool. Milestones 1–3 have landed; 4 onwards have not been started. The "where
the code stands" figures below are the diagnosis this plan was written from — they
describe the starting point, not the tree today.

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

| # | Milestone | Model | Thinking |
| --- | --- | --- | --- |
| 1 | Safety net — the runner and harnesses | Sonnet 5 | on |
| 2 | Housekeeping — dead code and `scripts/` | Haiku 4.5 | off |
| 3 | Descriptor-driven CRUD | **Opus 5** | **hard** |
| 4 | Split `buildViewModel()` | **Opus 5** | on |
| 5 | Shared view helpers | Sonnet 5 | on |
| 6 | `src/js/` — ES modules | Sonnet 5 | on |
| 7 | `src/css/` — tokens and split | Sonnet 5 | on |
| 8 | Re-verify and document | Sonnet 5 → Opus 5 | on |

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

1. ⬜ **The runner** (`scripts/test.ps1`). Server on a free port, headless Edge over
   every harness × scenario, one summary, exit 0/1. `-Update` rewrites
   `test/golden.json`; nothing else may. It references `serve.ps1` at the repo root
   until Milestone 2 moves it.
2. ⬜ **Golden DOM snapshot** (`test/golden.html`). Walk every screen and both tabs,
   serialize `#sidebar.innerHTML` + `#main.innerHTML` per screen, compare to
   `test/golden.json`. Fixed screen order and fixed expand/collapse state, or the
   snapshot isn't reproducible. Diff output must name the screen and show the first
   differing span — at 700 lines of HTML, anything less is unusable.
3. ⬜ **Write-payload capture.** `window.__writes` records only sheet *names* today.
   Extend the stub `fetch` to record `{ range, headers, rows }` for every PUT. This is
   the only thing that will catch Milestone 3's worst failure — a value written under
   the wrong header.
4. ⬜ **CSS coverage check.** While walking the screens, collect every class name in the
   DOM, parse the class selectors out of the stylesheet, report *unused* selectors and
   *undefined* classes.

`test/unit.html` is **not** built here — it can only `import` once Milestone 6 makes the
app modules.

**Tests**

- ⬜ The runner exits **1** when a check fails: break one assertion deliberately and
  confirm it. A runner that always exits 0 is worse than no runner.
- ⬜ Baseline captured against unmodified code, then a second run with no changes is
  clean — proves the snapshot is deterministic, not accidentally passing.
- ⬜ `-Update` is the only path that rewrites `golden.json`; a plain run leaves it
  byte-identical.
- ⬜ Both scenarios (`populated`, `?scenario=empty`) and the `?env=1` prefill path all
  drive to completion with no JS errors.

**Run it with:** Sonnet 5, thinking on. Self-contained new code against an existing
harness with a clear spec.

---

## Milestone 2 — Housekeeping: dead code and `scripts/`

All the zero-risk work in one commit. Nothing here can change a rendered figure.

1. ⬜ Remove the 6 `.about-*` classes, `.mb-0` and `.mb-24` from `styles.css`.
2. ⬜ Rename `.sb-about` → `.sb-footer-nav`, or fold it into an existing rule.
3. ⬜ Comment `v.scenarioInputs` to record that it is read via `lastVm`, so the next
   reader doesn't delete it.
4. ⬜ `git mv serve.ps1 scripts/serve.ps1`. **Its `$root` must climb one extra level** —
   `Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)`. Left alone it
   serves `scripts/`, which starts cleanly and 404s everything.
5. ⬜ Update the run command in `README.md` and `CLAUDE.md`, and the server path in
   `scripts/test.ps1`.

The `src/` half of the layout is *not* done here — milestones 6 and 7 write there
directly, so nothing moves twice.

**Tests**

- ⬜ CSS coverage check reports **0 unused and 0 undefined** classes. This is the real
  test: it re-derives the dead list independently rather than trusting the one above.
- ⬜ Golden snapshot: expect **exactly one diff**, the `sb-about` → `sb-footer-nav` class
  name in the sidebar. Review it, then `-Update`. Any second diff is a bug.
- ⬜ Grep `app.js` and `index.html` for each deleted class name — zero hits *before*
  deleting, not after.
- ⬜ `scripts/serve.ps1` serves the **repo root**: `/index.html`, `/app.js`,
  `/config/.env`, `/test/smoke.html` all 200. Check by request, not by eye — a wrong
  `$root` looks like a healthy server.
- ⬜ Runner green through the moved server, both scenarios.

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

1. ⬜ One builder per domain — `ledgerModel`, `transactionsModel`, `goldModel`,
   `certificatesModel`, `stocksModel`, `dashboardModel`, `planModel` — each taking
   `state` and returning its slice.
2. ⬜ Compute the shared intermediates (`ledgers`, `ratesMap`, gold total value, stock
   totals) once and pass them in explicitly rather than recomputing per builder. The
   dashboard consumes gold, certificate and stock figures, so ordering matters.
3. ⬜ Do **not** add per-screen lazy building or caching. The whole model rebuilds on
   every keystroke today and is fast enough; that would be complexity bought with a
   tidiness argument.

**Tests**

- ⬜ **Golden DOM snapshot**, both scenarios. This milestone runs before modules exist,
  so `buildViewModel()` is still sealed in the IIFE and can't be called directly — the
  snapshot is the available proxy. The direct view-model golden is deferred to
  Milestone 8.
- ⬜ **Arithmetic against the spec, not the baseline.** With gold, certificates, stock
  and provident fund all non-zero, assert total savings equals the formula in
  [functional-reqs.md](functional-reqs.md#dashboard-totals) — EGP + USD + EUR converted,
  unvested stock excluded. A snapshot happily preserves a pre-existing bug; this
  doesn't.
- ⬜ **Purity.** Drive the same screen twice with identical state and assert an identical
  snapshot — catches a builder that mutates a shared intermediate the next one reads.
- ⬜ **Empty state.** Every screen against an empty Sheet: no rows, no rates, no stock
  meta. Division-by-zero and `undefined` land here.

**Run it with:** Opus 5, thinking on. 399 lines is the easy part; the dashboard's
dependency on three other domains is what a weaker model gets subtly wrong.

---

## Milestone 5 — Shared view helpers

1. ⬜ Add `tabBar(screen, activeTab, teal)`; replace all 5 copies.
2. ⬜ Add `statCard(label, value, colourClass)` and a small variant; replace the 25
   longhand blocks.
3. ⬜ Add `dataTable({ columns, rows, rowActions })` for the tables sharing the
   header/row/actions shape. Leave the bespoke ones alone — the dashboard currency
   cards and certificate group tables cost more forced through a generic helper than
   they save.
4. ⬜ Fold the repeated gain-colour ternary into one `gainClass(n)` helper.

**Tests**

- ⬜ **Byte-identical golden snapshot.** The purest case in the plan: a helper emitting
  the same HTML as the longhand it replaced produces a zero-byte diff. **Do not
  `-Update` this milestone** — a diff means the helper is wrong, including whitespace
  differences that can change inline-element spacing.
- ⬜ **Escaping, through the DOM.** Put `<script>alert(1)</script>` and
  `" onmouseover="x` into the harness fixture's text columns, walk every screen, assert
  no raw `<` and no injected attribute. Stronger than testing a helper in isolation
  because it covers the real path from Sheet data to page — and centralizing markup is
  exactly when an `esc()` gets dropped.
- ⬜ **The zero boundary.** All 5 tab bars and all 10 stat-card colours already appear
  across the screens the golden run walks, so the snapshot covers them. `gainClass` at
  **exactly zero** is the one case no fixture row hits — add a row that does.
- ⬜ Direct helper unit tests are deferred to Milestone 8.

**Run it with:** Sonnet 5, thinking on. Repetitive extraction with an unambiguous
pass/fail signal — the snapshot tells you immediately, so a stronger model buys little.

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

1. ⬜ Move the code; drop the IIFE wrapper (module scope is already private).
2. ⬜ If `src/js/views.js` is still over ~500 lines, split it per screen.
3. ⬜ `index.html` → `<script type="module" src="src/app.js">`; `test/smoke.html` →
   `../src/app.js`.
4. ⬜ Fix a latent path bug: `applyLocalDefaults()` calls `fetch('config/.env')`, which
   resolves **relative to the document**. From `/index.html` that is right; from
   `/test/smoke.html` it resolves to `/test/config/.env` and only passes because the
   stub matches on substring. Use `fetch(new URL('../config/.env', import.meta.url))`,
   which resolves from the module regardless of which page loaded it.
5. ⬜ Create `test/unit.html` — a module page importing from `src/js/*` — and wire it
   into the runner. Leave it near-empty; Milestone 8 fills it. Creating it now proves
   the modules are importable from outside the app, which a boot check alone does not
   establish.

**Tests**

- ⬜ **Nothing lost in the move.** Count function declarations across the 8 files and
  assert it equals the count in the pre-split `app.js`. A dropped function is the
  characteristic failure and may not surface until a rarely-used screen is opened.
- ⬜ **Boot with zero console errors**, both scenarios — the harness records
  `window.__errors`; an unresolved import or a cycle shows up there and nowhere else.
- ⬜ **No import cycles.** Parse the `import` lines across `src/js/*.js` and assert the
  graph is acyclic. ~15 lines, and it survives future files.
- ⬜ **Served, not just opened.** Run through `scripts/serve.ps1` *and* `npx serve` —
  modules hard-fail on a wrong MIME type where classic scripts did not.
- ⬜ **`config/.env` resolves from both pages.** With a real `config/.env` present and
  the fetch stub disabled, load `/index.html` *and* `/test/smoke.html` and assert both
  prefill. Before the fix this fails from `/test/`, which is the point.
- ⬜ **Deployed tree is complete.** After pushing, load the live site and confirm boot.
  A file missed in the push is now a blank page, not a degraded one.
- ⬜ Golden snapshot clean — a pure move must change nothing.

**Run it with:** Sonnet 5, thinking on, **in one session without a compaction**. It is
mechanical, but it touches every line at once and the risk is omission, not
misjudgement. Escalate to Opus 5 only if a cycle or boot failure needs untangling.

---

## Milestone 7 — `src/css/`: tokens and split

1. ⬜ Introduce `:root` custom properties for the repeated literals — brand colours, the
   four font sizes, the three border radii, the border grey. **This is what kills the
   CSS duplication; splitting alone does not.**
2. ⬜ Split into cascade-ordered files:

   | File | Contents |
   | --- | --- |
   | `src/css/base.css` | reset, tokens, `body`, links, layout |
   | `src/css/components.css` | buttons, inputs, tables, tabs, pills, stat cards, chevrons |
   | `src/css/screens.css` | dashboard, stocks, certificates, plan, ledger |
   | `src/css/utilities.css` | the `.mb-*` helpers — last, so they win |

3. ⬜ Four `<link>` tags in `index.html` in that order, with a comment that the order
   matters. Same four in `test/smoke.html` — it loads the real stylesheet, so a missed
   tag silently unstyles the harness.

**Tests** — the golden snapshot is blind here: the HTML is unchanged and only the
rendered result moves. CSS needs its own checks.

- ⬜ **Computed-style assertions.** One representative element per token — a 13px label,
  a 12px caption, a 10px-radius card, a `#fff` panel, each brand colour — assert
  `getComputedStyle` returns the same value before and after. This names the broken
  token instead of just flagging a changed page.
- ⬜ **Screenshot hashes, every screen, fixed viewport.** Identical DOM at a pinned
  viewport renders byte-identically, so hashing each PNG is a reliable "something moved"
  signal with no image-diff dependency. It says *that* something changed; the
  computed-style assertions say *what*.
- ⬜ **Cascade order.** Assert a known override still wins — a `.mb-*` utility beating a
  component's own margin. This is the failure mode the split introduces and the one
  nothing else detects.
- ⬜ **Rule-count conservation.** Rules across the four files sum to 257 minus Milestone
  2's deletions. Blunt, but it catches a whole section dropped between files.
- ⬜ **Token sweep.** Grep the four files for the literals that were supposed to be
  replaced — any survivor is a miss, or a deliberate exception that deserves a comment.

**Run it with:** Sonnet 5, thinking on. The split is pure file movement, but deciding
whether a given `13px` is *the same* 13px as the others is real judgment — a mechanical
find-and-replace is how a font size ends up coupled to an unrelated one.

---

## Milestone 8 — Re-verify and document

1. ⬜ **Fill `test/unit.html`** — this is where the deferrals get paid back. Now that
   `src/js/*` is importable:
   - the per-domain builders against a frozen `state` fixture, compared to a stored JSON
     golden (the direct view-model check Milestone 4 could not run);
   - `buildViewModel()` twice on the same state → identical output;
   - `gainClass` at positive, negative and exactly zero; `statCard` per colour; `tabBar`
     per screen;
   - `dataTable` with zero rows, one row, and a row with no actions;
   - `parseEnv` on comments, padding, quotes and a missing `=`.
2. ⬜ Update `docs/design.md` (directory layout, module boundaries), `CLAUDE.md` (file
   list, conventions, the `scripts/serve.ps1` path) and `README.md` (the run command) in
   the same change.

**Tests**

- ⬜ `scripts/test.ps1` exits 0 end to end: smoke green in both scenarios, golden clean,
  CSS coverage clean, unit tests green.
- ⬜ **Whole-run screenshot hashes** — from **before Milestone 1** against **after
  Milestone 7**, not just per milestone. A per-milestone check that was re-baselined can
  hide a drift this comparison still catches.
- ⬜ **The hand-restored behaviours, by hand.** These are what the render loop
  reconstructs and the likeliest regressions: caret position while typing (including the
  amount field that reformats as you type), the Transactions search box, dragging the
  what-if slider, and scroll position of both panes after a re-render.
- ⬜ **Nothing written to an empty Sheet** — the "no data in the app" rule, and a
  plausible casualty of descriptor-driven CRUD.
- ⬜ **The live site boots.** Deploy and load it; the whole tree has to be up there.

**Run it with:** Sonnet 5, thinking on, to run and extend the suite. Escalate to Opus 5
for any diff that needs triage — "is this shift real?" is a judgment call, and by this
point the change set is too large to bisect cheaply.

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
