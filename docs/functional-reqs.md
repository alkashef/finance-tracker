# Functional requirements

Every rule this tracker uses to organize and calculate your money. This file is the
only place these rules are written down — the app used to carry an About screen that
duplicated them, and it was removed in favour of this doc.

For how the app is built, see [design.md](design.md). For how to run it, see the
[README](../README.md).

## How everything is organized

Every account, gold lot, and certificate carries exactly one tag:

- **Spending** — day-to-day accounts you spend from.
- **Saving > School** — cash set aside for school.
- **Saving > Other** — everything else parked, not spent: Gold, Certificates, and any
  other savings cash.

Untagged items default to Spending (accounts) or Saving > Other (gold/certificates)
so nothing old goes missing.

Tags are editable on the Tags screen; the three above are seeded on first run.

## Accounts & Ledgers

- Each account's ledger (its running list of in/out amounts) is generated
  automatically from Transactions — you never edit a ledger directly.
- Balance = the running sum of every signed transaction touching that account,
  oldest to newest. Ties on date fall back to the order the rows appear in the Sheet.
- Accounts are grouped by Owner on the Dashboard; accounts with no owner set show
  under "Unassigned".
- Renaming an account renames its ledger tab in the Sheet; deleting an account
  deletes that tab.

## How a transaction affects balances

- **From + To set**: the amount leaves the From account (–) and lands in the To
  account (+).
- **From only, no To**: the amount is applied as-is to that account. Used for
  "Starting Balance" and "Plug" transaction types — the only two types that don't
  require a To Account.
- A transaction whose From and To are the same account is skipped in that account's
  ledger.
- A ledger row's Type is derived, not stored: `In` for a positive signed amount,
  `Out` for a negative one.

## Gold

- Each lot's grams = Quantity × Weight (gm).
- Cost = grams × purchase price per gram. Current value = grams × current price per
  gram.
- Gain = current value − cost.
- "Update price for all lots" overwrites the current price/gm and as-of date on
  every lot at once — gold is priced as one market, not per-lot.
- When a new lot is added without a current price or as-of date, both are inherited
  from the lot with the latest as-of date (falling back to the purchase date).
- "Fetch latest 24k price" looks up today's international 24k gold spot price in
  EGP/gram (via GoldAPI.io — a free API key, entered once, is required) and fills the
  Current Price/As Of fields for review. It does not save by itself — "Update price for
  all lots" still applies it, same as typing the number in by hand.

## Certificates

- Amount at maturity = Amount × (1 + Interest Rate) — a flat rate applied once,
  matching how the bank statement shows it (not compounded per period).
- EGP figures use each certificate's Currency converted through the shared Currency
  Rates table.
- Gain vs principal compares EGP-now to EGP-at-maturity across all certificates
  combined.
- Certificates are grouped by currency, each group independently collapsible.
- **Maturity Watch** flags any certificate maturing within 60 days, or already
  matured, on the Dashboard. Sellable stock (vested RSU + cash, and ESPP) is listed
  alongside them as immediately liquid.

## Currency rates

- One rate per currency (to EGP), shared across every certificate in that currency.
- Setting a new rate immediately recalculates every EGP figure that depends on it —
  old rates are overwritten, not kept as history.
- A currency with no rate set converts at 0.
- "Fetch latest" looks up the currency already typed into the Currency field against
  EGP (via open.er-api.com — no key needed) and fills Rate/As Of for review. It does
  not save by itself — "Set rate" still applies it.

## Stocks (RSU & ESPP)

- Values are all in USD, shown apart from EGP totals.
- **Sellable now** = vested RSU + ESPP holdings + cash. Holding value = Quantity ×
  current price; gain = value − cost basis.
- **Unvested** = future RSU vesting schedule, grouped by vest year. Value = Units ×
  current price. Unvested stock is deliberately excluded from total savings.
- ESPP discount earned = current ESPP value − amount paid (only shown when ESPP
  shares are currently held).
- Updating the stock price recomputes every holding value, vesting value, and the
  "what if it trades at $X" scenario slider at once. The slider spans $10–$80 and
  resets to the current price whenever the price is updated.
- "Fetch latest close" looks up the latest daily close for the Symbol field (via Alpha
  Vantage — a free API key, entered once, is required) and fills Current Price/As Of
  for review. It does not save by itself — "Update price" still applies it.

## Market Prices

- A read-only reference/validation screen (sidebar's Settings group) showing today's
  live gold, stock and currency-rate figures side by side. "Check today's prices"
  fetches all three at once — see [design.md](design.md) for the providers.
- Gold shows the 24k EGP/gram spot price; stock shows the latest close for whatever
  Symbol is set on the Stocks screen; currency rates show one figure per currency
  already on the Currency Rates panel.
- **Nothing here is saved.** It never writes the Sheet, and checking a price here never
  touches the Gold/Stocks/Certificates Manage screens' pending forms — the two are
  wholly independent. A missing API key or stock symbol is reported for that one
  figure rather than blocking the other two.

## Provident Fund

- A single balance + as-of date + tag, updated manually (not derived from
  transactions).

## Dashboard totals

- **Savings by currency** splits owned assets into EGP, USD and EUR native totals,
  each with an EGP equivalent:
  - EGP = EGP certificates + gold current value + provident fund + cash in every
    non-Spending account.
  - USD = USD certificates + sellable stock.
  - EUR = EUR certificates.
- **Total savings** is the sum of those three converted to EGP. Unvested stock is
  not counted.

## Data entry & export

- **The app never invents data.** Nothing is seeded on first connect: missing tabs
  are created empty and stay empty until you enter something. Every figure on every
  screen comes from your Sheet.
- Every add/edit/delete writes straight to the connected Sheet; there is no local
  draft state and no undo.
- Deleting an account or a tag asks for confirmation; other deletes do not.
- CSV export is available for the Transactions screen and for any account ledger.
- "Refresh from Sheet" re-pulls every tab, useful if the Sheet was edited by hand.
- The **Plan** screen is a simple roadmap list (Step 1–3, item, status, notes,
  version) stored in the `Plan` tab. It carries no financial data.
