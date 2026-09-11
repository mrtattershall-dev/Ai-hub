# Cart Class Methods

## Methods

### addItem(name, price, qty)
- **Arguments:**
  - `name` (string): The name of the item.
  - `price` (number): The price of the item.
  - `qty` (number): The quantity of the item.
- **Throws:**
  - None

### total()
- **Arguments:**
  - None
- **Returns:**
  - The total price of all items in the cart as a float.
- **Throws:**
  - None

### applyDiscount(pct)
- **Arguments:**
  - `pct` (number): The discount percentage to apply.
- **Returns:**
  - The total price after applying the discount as a float.
- **Throws:**
  - `Error`: If the discount percentage is not between 0 and 100.