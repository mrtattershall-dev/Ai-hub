# Ledger (r1_ledger.js)

- `open(name)` - creates an account with balance 0. Throws if the account already exists.
- `deposit(name, amount)` - adds money. Throws for an unknown account, an amount that is not a positive number, or a frozen account.
- `balance(name)` - returns the balance. Throws for an unknown account.
- `withdraw(name, amount)` - removes money. Throws for an unknown account, a non-positive amount, not enough money, or a frozen account.
- `transfer(from, to, amount)` - moves money, all-or-nothing. Throws for an unknown account, a bad amount, not enough money, from === to, or when either account is frozen.
- `history(name)` - the account's entries in order as `{ type, amount }`. Throws for an unknown account.
- `freeze(name)` / `unfreeze(name)` - stop / allow deposits, withdrawals and transfers. Throw for an unknown account.
- `undo()` - reverses the most recent deposit, withdraw or transfer (never interest). Throws when there is nothing to undo.
- `applyInterest(ratePct)` - pays interest to every account that is not frozen and has a positive balance; returns the total.
- `toCSV()` - `account,balance` header, then one line per account sorted by name.
- `Ledger.fromCSV(text)` - builds a ledger from `toCSV()` output. Throws for a wrong header or a malformed line.
