# Inventory Class Methods

## constructor()
- No arguments
- Initializes an empty inventory with `this.items` as an empty object

## add(name, qty)
- Arguments: 
  - `name` (string): The name of the item to add
  - `qty` (number): The quantity to add
- Throws:
  - `Error`: If `name` is undefined or null
  - `Error`: If `qty` is not a number, or is not positive

## remove(name, qty)
- Arguments:
  - `name` (string): The name of the item to remove
  - `qty` (number): The quantity to remove
- Throws:
  - `Error`: If `name` is undefined or null
  - `Error`: If `qty` is not a number, or is not positive
  - `Error`: If the item does not exist in inventory
  - `Error`: If there are insufficient items to remove

## count(name)
- Arguments:
  - `name` (string): The name of the item to count
- Throws:
  - `Error`: If `name` is undefined or null