# Inventory Class Methods

## Methods

### add(name, qty)
- **Arguments:**
  - `name` (string): The name of the item to add.
  - `qty` (number): The quantity of the item to add.
- **Throws:**
  - `Error`: If the arguments are invalid (name is not a string, qty is not a number, or qty is less than or equal to 0).

### count(name)
- **Arguments:**
  - `name` (string): The name of the item to count.
- **Returns:**
  - The quantity of the specified item, or 0 if the item does not exist.

### remove(name, qty)
- **Arguments:**
  - `name` (string): The name of the item to remove.
  - `qty` (number): The quantity of the item to remove.
- **Throws:**
  - `Error`: If there is not enough of the specified item to remove.