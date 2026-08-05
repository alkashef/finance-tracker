# Plan: de-DC-ify the app, split CSS/JS, reorganize docs

## Why this is bigger than "split three files"

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

## Guiding constraints (unchanged from today)

- Still a static site: no build step, no bundler, no npm install required to run it.
  GitHub Pages just serves files as-is.
- Still talks to Google Sheets API v4 directly via `fetch`, no backend.
- Still uses Google Identity Services OAuth popup flow, Client ID + Spreadsheet ID
  saved to `localStorage` under `financeTracker.config`.
- Behavior, business logic, and visual design should not change — this is a
  structural refactor, not a feature or design change. Anything that looks like a
  behavior change should be called out and confirmed separately, not folded in
  silently.

## Phase 1 — Rewrite: retire the DC runtime, produce plain HTML/CSS/JS

**Goal**: one `index.html` (markup + `<link>`/`<script src>` tags only), one
`styles.css`, one `app.js` (or a small number of clearly-named JS modules), all
hand-writable and hand-editable directly — no compiler, no `{{ }}` template syntax,
no generated runtime.

Steps:
1. Read the full DC logic class (`class Component extends DCLogic`, line ~3314 to
   end) and enumerate every piece of state, computed getter, and handler. This is
   the actual app behavior and becomes the spec for the rewrite — treat it as the
   ground truth, not the runtime or template scaffolding around it.
2. Read the full `<x-dc>` template (lines ~1898–3224) and map every `sc-if`/`sc-for`
   block and `{{ }}` binding to the piece of state/handler driving it. This becomes
   the spec for the plain-HTML structure and the render logic that keeps it in sync
   with state.
3. Decide the rewrite approach and get sign-off before writing code (see "Open
   decision" below) — this determines how much of steps 4–6 is "translate directive
   syntax" vs. "introduce a tiny framework."
4. Extract all inline `style="..."` strings (both static ones in the template and
   ones computed in the logic class, e.g. `navStyle()`, `goldGainCardBg`) into
   `styles.css` as classes. This is the biggest chunk of work — styling is 100%
   inline today, and CLAUDE.md currently documents that as a hard constraint of the
   design tool. Once the DC tool is out of the picture, that constraint no longer
   applies, and normal CSS classes/selectors are the natural replacement.
5. Rewrite the logic class as plain JS: same state shape, same computed values, same
   Sheets API / OAuth code (this part barely changes — it's already plain
   fetch/OAuth calls, not DC-specific), but driving a hand-rolled `render()` instead
   of the DCLogic/React contract.
6. Rewrite the template as plain HTML generation (template literals, or targeted DOM
   updates) replacing `sc-if`/`sc-for`/`{{ }}` with plain JS conditionals/loops —
   this is the piece that replaces React's diffing, so see the re-render strategy
   below.
7. Remove the React/ReactDOM unpkg CDN `<script>` tags entirely — no component
   framework, zero runtime dependencies besides the Google Identity Services script
   the app already loads for OAuth.
8. Verify byte-for-byte-equivalent behavior against the current app for every
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

## Phase 2 — Cleanup pass

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

## Phase 3 — Docs reorganization

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

## Phase 4 — Keep-in-sync instruction (already partially in place)

CLAUDE.md already has a "Keeping docs in sync" rule from the last change. Update it
so it explicitly names all three docs and states which doc owns which kind of
change, so future edits land in the right file instead of being re-inlined into
CLAUDE.md or README.md out of habit:
- Behavior/business-logic change → `docs/functional-reqs.md`
- Architecture/auth/Sheets-access change → `docs/design.md`
- Run/setup step change → `README.md`
- Anything agent-workflow-specific (how to approach this repo, file layout,
  conventions) → `CLAUDE.md` itself

## Suggested execution order

1. Phase 1 (rewrite) — by far the largest chunk of work; likely wants its own
   sub-plan or at least a page-by-page checklist once started, given the app has
   11+ distinct screens/tabs.
2. Phase 2 (cleanup) — fast once Phase 1 is done and verified.
3. Phase 3 (docs split) — independent of Phase 1/2 mechanically (content already
   exists in README.md/CLAUDE.md today), but the file-layout parts of
   `docs/design.md` and `CLAUDE.md` should be written against the *post-rewrite*
   layout, so sequence this after Phase 1/2 rather than in parallel.
4. Phase 4 (sync instruction update) — small, do alongside Phase 3.

## Risks / things to watch

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
