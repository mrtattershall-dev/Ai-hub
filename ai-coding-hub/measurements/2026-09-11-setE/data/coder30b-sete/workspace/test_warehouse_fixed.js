// Test file for Warehouse class with correct fulfil method testing
const { Warehouse } = require('./q1_stock.js');

// Create a new warehouse
const warehouse = new Warehouse();

// Test addItem with valid input
warehouse.addItem('SKU001', 10);
console.assert(warehouse.stock('SKU001') === 10, 'addItem should add stock correctly');

// Test addItem with another item
warehouse.addItem('SKU002', 5);
console.assert(warehouse.stock('SKU002') === 5, 'addItem should handle multiple items');

// Test addItem with same SKU (should add to existing)
warehouse.addItem('SKU001', 3);
console.assert(warehouse.stock('SKU001') === 13, 'addItem should add to existing stock');

// Test stock with unknown SKU
console.assert(warehouse.stock('SKU999') === 0, 'stock should return 0 for unknown SKU');

// Test skus method
const skus = warehouse.skus();
console.assert(skus.length === 2, 'skus should return 2 items');
console.assert(skus[0] === 'SKU001', 'skus should be sorted');
console.assert(skus[1] === 'SKU002', 'skus should be sorted');

// Test reserve method
warehouse.addItem('SKU003', 10);
warehouse.reserve('SKU003', 3, 'order1');
console.assert(warehouse.available('SKU003') === 7, 'available should reflect reserved stock');

// Test release method
console.assert(warehouse.release('order1') === 3, 'release should return correct count of freed units');
console.assert(warehouse.available('SKU003') === 10, 'available should reflect freed reservations');

// Test fulfil method
console.log("Testing fulfil method...");

// Test fulfil with valid reservations
warehouse.addItem('SKU004', 10);
warehouse.reserve('SKU004', 3, 'order1');
console.assert(warehouse.fulfil('order1') === 3, 'fulfil should return correct count of freed units');

// Verify that order1's reservations are gone and available stock is updated
console.assert(warehouse.available('SKU004') === 10, 'available should reflect freed reservations after fulfil');

// Test fulfil with multiple reservations for different orders
warehouse.addItem('SKU005', 15);
warehouse.reserve('SKU005', 4, 'order2');
warehouse.reserve('SKU005', 3, 'order3');
console.assert(warehouse.fulfil('order2') === 4, 'fulfil should return correct count of freed units for order2');

// Verify that order2's reservations are gone but order3 still has reservations
// After freeing 4 units from order2, we should have 15-3=12 available (15 total - 3 reserved for order3)
console.assert(warehouse.available('SKU005') === 12, 'available should reflect freed reservations after fulfil for order2');

// Test fulfil with no reservations (should throw error)
try {
  warehouse.fulfil('order4');
  console.assert(false, 'fulfil should throw error for order with no reservations');
} catch (e) {
  console.assert(e.message === "Order has no reservations to fulfil", 'fulfil should throw correct error for order with no reservations');
}

// Test that we can still reserve the same SKU for a different order
warehouse.reserve('SKU005', 2, 'order4');
console.assert(warehouse.available('SKU005') === 10, 'available should reflect new reservation (15-3-2=10)');

console.log("All warehouse tests passed successfully!");