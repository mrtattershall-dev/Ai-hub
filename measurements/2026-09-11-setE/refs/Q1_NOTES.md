# Warehouse (q1_stock.js)

- `addItem(sku, qty)` - adds stock. Throws unless qty is a positive integer.
- `stock(sku)` - the quantity in stock, 0 for an unknown sku.
- `skus()` - the known skus, sorted.
- `remove(sku, qty)` - takes stock out. Throws unless qty is a positive integer, or when there is not enough available stock (reserved units cannot be removed).
- `reserve(sku, qty, orderId)` - holds units for an order. Throws when there is not enough available stock or the order already holds a reservation for that sku.
- `available(sku)` - stock minus everything reserved.
- `release(orderId)` - frees the order's reservations; returns the units freed.
- `fulfil(orderId)` - takes the order's reserved units out of stock. Throws for an order with no reservations.
- `lowStock(threshold)` - skus whose available quantity is below threshold.
- `toJSON()` / `Warehouse.fromJSON(data)` - save and rebuild the state.
- `history(sku)` - the sku's events in order.
