# Bank Class Public Methods

## open(name)
- **Arguments**: `name` (string)
- **Throws**: Error if the account already exists.

## deposit(name, amount)
- **Arguments**: `name` (string), `amount` (number)
- **Throws**: Error if the account does not exist, or if the amount is not a positive number.

## balance(name)
- **Arguments**: `name` (string)
- **Throws**: Error if the account does not exist.