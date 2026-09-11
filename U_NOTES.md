# Cart Class Methods

## constructor()
- No arguments
- Initializes the cart with an empty items array

## addItem(name, price, qty)
- Arguments: name (string), price (number), qty (number)
- Adds an item to the cart items array

## total()
- No arguments
- Returns the rounded total of all items in the cart
- Calculates sum of (price * quantity) for all items and rounds to 2 decimal places

## applyDiscount(pct)
- Arguments: pct (number) - discount percentage
- Throws: Error if pct is less than 0 or greater than 100
- Returns: the total amount after applying the discount