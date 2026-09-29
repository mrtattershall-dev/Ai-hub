# Bank Class Public Methods

## open(name)
Opens a new account with the given name.
- **Arguments**: 
  - `name` (string): The name of the account to open
- **Throws**:
  - `Error`: If an account with the given name already exists

## deposit(name, amount)
Deposits money into an existing account.
- **Arguments**:
  - `name` (string): The name of the account to deposit into
  - `amount` (number): The amount to deposit
- **Throws**:
  - `Error`: If the account does not exist
  - `Error`: If the amount is not a positive number

## balance(name)
Retrieves the current balance of an account.
- **Arguments**:
  - `name` (string): The name of the account to check
- **Throws**:
  - `Error`: If the account does not exist

## withdraw(name, amount)
Withdraws money from an existing account.
- **Arguments**:
  - `name` (string): The name of the account to withdraw from
  - `amount` (number): The amount to withdraw
- **Throws**:
  - `Error`: If the account does not exist
  - `Error`: If the amount is not a positive number
  - `Error`: If there are insufficient funds in the account

## transfer(from, to, amount)
Transfers money between two existing accounts.
- **Arguments**:
  - `from` (string): The name of the account to transfer from
  - `to` (string): The name of the account to transfer to
  - `amount` (number): The amount to transfer
- **Throws**:
  - `Error`: If the source account does not exist
  - `Error`: If the destination account does not exist
  - `Error`: If the amount is not a positive number
  - `Error`: If there are insufficient funds in the source account

## history(name)
Retrieves the transaction history for an account.
- **Arguments**:
  - `name` (string): The name of the account to get history for
- **Throws**:
  - `Error`: If the account does not exist