# Inventory Class Methods

## add(name, qty)
- **Arguments**: 
  - `name`: The name of the item to add.
  - `qty`: The quantity of the item to add.
- **Throws**: None

## remove(name, qty)
- **Arguments**: 
  - `name`: The name of the item to remove.
  - `qty`: The quantity of the item to remove.
- **Throws**: 
  - `Error`: If there is not enough stock to remove the specified quantity.

## count(name)
- **Arguments**: 
  - `name`: The name of the item to count.
- **Throws**: None