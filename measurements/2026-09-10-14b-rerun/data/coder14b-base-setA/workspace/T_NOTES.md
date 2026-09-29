# Inventory Class Methods

## add(name, qty)
- **Arguments**: 
  - `name` (string): The name of the item.
  - `qty` (number): The quantity of the item to add.
- **Throws**: None

## remove(name, qty)
- **Arguments**: 
  - `name` (string): The name of the item.
  - `qty` (number): The quantity of the item to remove.
- **Throws**: 
  - `Error("Not enough stock to remove")` if the item does not exist or the quantity to remove is greater than the available stock.

## count(name)
- **Arguments**: 
  - `name` (string): The name of the item.
- **Throws**: None
- **Returns**: 
  - The quantity of the item in the inventory, or 0 if the item does not exist.