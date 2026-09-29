# Ledger Class Public Methods

## `open(name)`
Opens a new account with the given name.
- **Arguments**: `name` (string) - The name of the account to open
- **Throws**: 
  - `Error` if an account with the given name already exists

## `deposit(name, amount)`
Deposits the specified amount into the given account.
- **Arguments**: 
  - `name` (string) - The name of the account to deposit into
  - `amount` (number) - The amount to deposit
- **Throws**:
  - `Error` if the account does not exist
  - `Error` if the amount is not a positive number

## `balance(name)`
Returns the current balance of the given account.
- **Arguments**: `name` (string) - The name of the account to check
- **Throws**:
  - `Error` if the account does not exist

## `withdraw(name, amount)`
Withdraws the specified amount from the given account.
- **Arguments**:
  - `name` (string) - The name of the account to withdraw from
  - `amount` (number) - The amount to withdraw
- **Throws**:
  - `Error` if the account does not exist
  - `Error` if the amount is not a positive number
  - `Error` if there are insufficient funds in the account

## `transfer(from, to, amount)`
Transfers the specified amount from one account to another.
- **Arguments**:
  - `from` (string) - The name of the account to transfer from
  - `to` (string) - The name of the account to transfer to
  - `amount` (number) - The amount to transfer
- **Throws**:
  - `Error` if `from` and `to` are the same account
  - `Error` if the source account does not exist
  - `Error` if the destination account does not exist
  - `Error` if the amount is not a positive number
  - `Error` if there are insufficient funds in the source account

## `undo()`
Reverts the last transaction operation.
- **Arguments**: None
- **Throws**:
  - `Error` if there are no operations to undo

## `history(name)`
Returns the transaction history for the given account.
- **Arguments**: `name` (string) - The name of the account to get history for
- **Throws**:
  - `Error` if the account does not exist

## `applyInterest(ratePct)`
Applies interest to all positive balance accounts.
- **Arguments**: `ratePct` (number) - The interest rate percentage to apply
- **Throws**: None

## `toCSV()`
Converts the ledger data to CSV format.
- **Arguments**: None
- **Throws**: None

## `static fromCSV(text)`
Creates a Ledger instance from CSV formatted text.
- **Arguments**: `text` (string) - CSV formatted text representing ledger data
- **Throws**:
  - `Error` if the CSV data is empty
  - `Error` if the header is invalid
  - `Error` if a line has malformed data
  - `Error` if an account name is empty
  - `Error` if a balance is invalid (NaN or negative)