/* Shared fixture data for the test harnesses (smoke.html, golden.html). Entirely
   invented — round numbers so expected values are obvious by hand. Never put real
   figures here; this file is in the repo.

   Order matches the ranges app.js requests in values:batchGet: Accounts, Transaction
   Types, Tags, Transactions, Plan, Gold, Certificates, Currency Rates, Provident Fund,
   Stock Meta, Stock Holdings, Stock Vesting. */
var POPULATED = [
  [['Bank A', 'Alex', 'Spending'], ['Savings B', 'Sam', 'Saving > Other'], ['School Fund', 'Alex', 'Saving > School']],
  [['Salary'], ['Groceries'], ['Starting Balance']],
  [['Spending'], ['Saving > School'], ['Saving > Other']],
  [['2026-01-05', 1000, 'Opening balance', 'Starting Balance', 'Bank A', ''],
   ['2026-02-10', 250.5, 'Groceries & stuff <b>', 'Groceries', 'Bank A', 'Savings B'],
   ['2026-03-01', 500, 'Transfer', 'Salary', 'Savings B', 'School Fund']],
  [['1', 'Item one', 'Done', 'a note', 'v1'], ['2', 'Item two', 'Not started', '', ''], ['3', 'Item three', 'In progress', '', '']],
  [[2, 'Gold 24', 'Brand X', 5, 'Vault', 3000, '2024-03-21', 4000, '2026-07-29', 'Saving > Other'],
   [1, 'Gold 21', 'Brand Y', 10, 'Home', 5000, '2025-01-01', 4000, '2026-07-29', 'Saving > Other']],
  [['C-001', 'Example cert EGP', '2024-02-13', 100000, 'EGP', '1 Year', '2026-09-01', 0.2, 'Saving > Other'],
   ['C-002', 'Example cert USD', '2023-11-06', 1000, 'USD', '3 Month', '2026-11-07', 0.1, 'Saving > Other']],
  [['EGP', 1, '2024-04-08'], ['USD', 50, '2024-04-08'], ['EUR', 60, '2024-04-08']],
  [[250000, '2026-01-01', 'Saving > Other']],
  [['ACME', 20, 100, '2026-08-01']],
  [['Vested RSU', 'RSU lot', 100, 1500, '2026-03-03', 'Saving > Other'], ['ESPP', 'ESPP lot', 50, 500, '2025-06-01', 'Saving > Other']],
  [['2027-01-15', 'G-1', 200], ['2028-01-15', 'G-2', 300]]
];
var EMPTY = POPULATED.map(function () { return []; });
