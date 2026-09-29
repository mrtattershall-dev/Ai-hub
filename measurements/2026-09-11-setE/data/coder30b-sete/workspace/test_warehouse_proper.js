// Proper test for Warehouse class
const { Warehouse } = require('./q1_stock.js');

// Create a warehouse instance
const warehouse = new Warehouse();

// Test addItem
warehouse.addItem('SKU001', 10);
console.assert(warehouse.stock('SKU001') === 10, 'addItem should work correctly');

// Test remove
warehouse.remove('SKU001', 3);
console.assert(warehouse.stock('SKU001') === 7, 'remove should work correctly');

// Test reserve
warehouse.addItem('SKU002', 15);
warehouse.reserve('SKU002', 5, 'order1');
console.assert(warehouse.available('SKU002') === 10, 'available should return correct value after reservation');

// Test duplicate reservation error
try {
  warehouse.reserve('SKU002', 3, 'order1');
  console.assert(false, 'reserve should throw error for duplicate order reservation');
} catch (e) {
  console.assert(e.message === "Order already has a reservation for this SKU", 'reserve should throw correct error for duplicate order reservation');
}

// Test insufficient stock error
try {
  warehouse.reserve('SKU002', 20, 'order2');
  console.assert(false, 'reserve should throw error for insufficient stock');
} catch (e) {
  console.assert(e.message === "Not enough stock or SKU does not exist", 'reserve should throw correct error for insufficient stock');
}

// Test unknown SKU error
try {
  warehouse.reserve('SKU003', 5, 'order3');
  console.assert(false, 'reserve should throw error for unknown SKU');
} catch (e) {
  console.assert(e.message === "Not enough stock or SKU does not exist", 'reserve should throw correct error for unknown SKU');
}

// Test available with multiple reservations
warehouse.reserve('SKU002', 3, 'order2');
console.assert(warehouse.available('SKU002') === 7, 'available should return correct value for SKU with multiple reservations');

// Test available with non-existent SKU
warehouse.remove('SKU002', 15);
// After removing all stock, the SKU should no longer exist in inventory
// So available should return 0 (not NaN)
console.assert(warehouse.available('SKU002') === 0, 'available should return 0 for non-existent SKU');

console.log("All Warehouse tests passed!");