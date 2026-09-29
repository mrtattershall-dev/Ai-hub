# Public Methods of Warehouse Class

## addItem(sku, qty)
- **Arguments**: 
  - `sku`: The stock keeping unit identifier.
  - `qty`: The quantity to add.
- **Throws**: 
  - Throws an error if `qty` is not a positive integer.

## stock(sku)
- **Arguments**: 
  - `sku`: The stock keeping unit identifier.
- **Returns**: 
  - The quantity of the specified SKU.

## skus()
- **Returns**: 
  - A sorted array of known SKUs.