// Simple test file for Warehouse release function
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
warehouse.addItem('SKU005', 10);
try {
  warehouse.reserve('SKU005', 5, 'order1');
  console.assert(warehouse.available('SKU005') === 5, 'available should return correct value after reservation');
} catch (e) {
  console.assert(false, 'reserve should work correctly');
}

try {
  warehouse.reserve('SKU005', 3, 'order1');
  console.assert(false, 'reserve should throw error for duplicate order reservation');
} catch (e) {
  console.assert(e.message === "Order already has a reservation for this SKU", 'reserve should throw correct error for duplicate order reservation');
}

try {
  warehouse.reserve('SKU005', 15, 'order2');
  console.assert(false, 'reserve should throw error for insufficient stock');
} catch (e) {
  console.assert(e.message === "Not enough stock or SKU does not exist", 'reserve should throw correct error for insufficient stock');
}

try {
  warehouse.reserve('SKU006', 5, 'order3');
  console.assert(false, 'reserve should throw error for unknown SKU');
} catch (e) {
  console.assert(e.message === "Not enough stock or SKU does not exist", 'reserve should throw correct error for unknown SKU');
}

// Test available method
warehouse.addItem('SKU006', 20);
warehouse.reserve('SKU006', 5, 'order1');
console.assert(warehouse.available('SKU006') === 15, 'available should return correct value for SKU with reservations');

warehouse.reserve('SKU006', 3, 'order2');
console.assert(warehouse.available('SKU006') === 12, 'available should return correct value for SKU with multiple reservations');

warehouse.removeItem('SKU006'); // Remove the item to test available with non-existent SKU
console.assert(warehouse.available('SKU006') === 0, 'available should return 0 for non-existent SKU');

// Test release method
console.log("Testing release method...");

// Test release with no reservations
console.assert(warehouse.release('order1') === 0, 'release should return 0 for order with no reservations');

// Test release with reservations
warehouse.addItem('SKU007', 10);
warehouse.reserve('SKU007', 3, 'order1');
warehouse.reserve('SKU007', 2, 'order2');
console.assert(warehouse.release('order1') === 5, 'release should return correct count of freed units');

// Verify that order1's reservations are gone
console.assert(warehouse.available('SKU007') === 5, 'available should reflect freed reservations');

// Test release with multiple reservations for same order
warehouse.addItem('SKU008', 15);
warehouse.reserve('SKU008', 4, 'order2');
warehouse.reserve('SKU008', 3, 'order2');
console.assert(warehouse.release('order2') === 7, 'release should sum all reservations for the same order');

// Verify that order2's reservations are gone
console.assert(warehouse.available('SKU008') === 15, 'available should reflect freed reservations');

console.log("All tests passed!");