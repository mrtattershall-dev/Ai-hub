# Bank (s1_bank.js)

- `open(name)` - creates an account with balance 0. Throws if the account already exists.
- `deposit(name, amount)` - adds money. Throws for an unknown account or an amount that is not a positive number.
- `balance(name)` - returns the balance. Throws for an unknown account.
- `withdraw(name, amount)` - removes money. Throws for an unknown account, a non-positive amount, or insufficient funds.
- `transfer(from, to, amount)` - moves money, all-or-nothing. Throws for an unknown account, a bad amount, or insufficient funds; on a throw neither balance changes.
- `history(name)` - returns the account's entries in order as `{ type, amount }`. Throws for an unknown account.
