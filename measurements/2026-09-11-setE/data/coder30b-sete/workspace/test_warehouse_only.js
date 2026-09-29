// Test file for Warehouse class only
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

// Test addItem with invalid quantity (should throw error)
try {
  warehouse.addItem('SKU003', -1);
  console.assert(false, 'addItem should throw error for negative quantity');
} catch (e) {
  console.assert(e.message === "Quantity must be a positive integer", 'addItem should throw correct error for negative quantity');
}

try {
  warehouse.addItem('SKU004', 0);
  console.assert(false, 'addItem should throw error for zero quantity');
} catch (e) {
  console.assert(e.message === "Quantity must be a positive integer", 'addItem should throw correct error for zero quantity');
}

try {
  warehouse.addItem('SKU005', 1.5);
  console.assert(false, 'addItem should throw error for non-integer quantity');
} catch (e) {
  console.assert(e.message === "Quantity must be a positive integer", 'addItem should throw correct error for non-integer quantity');
}

// Test remove with valid input
warehouse.remove('SKU001', 3);
console.assert(warehouse.stock('SKU001') === 10, 'remove should reduce stock correctly');

// Test remove with unknown SKU (should throw error)
try {
  warehouse.remove('SKU999', 1);
  console.assert(false, 'remove should throw error for unknown SKU');
} catch (e) {
  console.assert(e.message === "Not enough available stock or SKU does not exist", 'remove should throw correct error for unknown SKU');
}

// Test remove with insufficient stock (should throw error)
try {
  warehouse.remove('SKU002', 10);
  console.assert(false, 'remove should throw error for insufficient stock');
} catch (e) {
  console.assert(e.message === "Not enough available stock or SKU does not exist", 'remove should throw correct error for insufficient stock');
}

// Test remove with invalid quantity (should throw error)
try {
  warehouse.remove('SKU002', -1);
  console.assert(false, 'remove should throw error for negative quantity');
} catch (e) {
  console.assert(e.message === "Quantity must be a positive integer", 'remove should throw correct error for negative quantity');
}

// Test available method
warehouse.addItem('SKU003', 10);
warehouse.reserve('SKU003', 3, 'order1');
console.assert(warehouse.available('SKU003') === 7, 'available should account for reservations');

// Test reserve with valid input
warehouse.reserve('SKU002', 2, 'order2');
console.assert(warehouse.available('SKU002') === 3, 'available should account for reservations');

// Test reserve with unknown SKU (should throw error)
try {
  warehouse.reserve('SKU999', 1, 'order3');
  console.assert(false, 'reserve should throw error for unknown SKU');
} catch (e) {
  console.assert(e.message === "Not enough stock or SKU does not exist", 'reserve should throw correct error for unknown SKU');
}

// Test reserve with insufficient stock (should throw error)
try {
  warehouse.reserve('SKU002', 10, 'order4');
  console.assert(false, 'reserve should throw error for insufficient stock');
} catch (e) {
  console.assert(e.message === "Not enough stock or SKU does not exist", 'reserve should throw correct error for insufficient stock');
}

// Test reserve with invalid quantity (should throw error)
try {
  warehouse.reserve('SKU002', -1, 'order5');
  console.assert(false, 'reserve should throw error for negative quantity');
} catch (e) {
  console.assert(e.message === "Quantity must be a positive integer", 'reserve should throw correct error for negative quantity');
}

// Test reserve with duplicate order reservation (should throw error)
try {
  warehouse.reserve('SKU002', 1, 'order2');
  console.assert(false, 'reserve should throw error for duplicate order reservation');
} catch (e) {
  console.assert(e.message === "Order already has a reservation for this SKU", 'reserve should throw correct error for duplicate order reservation');
}

// Test release method
console.log("Testing release method...");

// Test release with valid reservations
warehouse.addItem('SKU004', 10);
warehouse.reserve('SKU004', 3, 'order1');
warehouse.reserve('SKU004', 2, 'order2');
console.assert(warehouse.release('order1') === 3, 'release should return correct count of freed units');

// Verify that order1's reservations are gone
console.assert(warehouse.available('SKU004') === 10, 'available should reflect freed reservations');

// Test release with multiple reservations for same order (different SKUs)
warehouse.addItem('SKU005', 15);
warehouse.reserve('SKU005', 4, 'order3');
warehouse.reserve('SKU005', 3, 'order3');
console.assert(warehouse.release('order3') === 7, 'release should sum all reservations for the same order');

// Verify that order3's reservations are gone
console.assert(warehouse.available('SKU005') === 15, 'available should reflect freed reservations');

// Test fulfil method
console.log("Testing fulfil method...");

// Test fulfil with valid reservations
warehouse.addItem('SKU006', 10);
warehouse.reserve('SKU006', 3, 'order1');
warehouse.reserve('SKU006', 2, 'order2');
console.assert(warehouse.fulfil('order1') === 3, 'fulfil should return correct count of freed units');

// Verify that order1's reservations are gone and available stock is updated
console.assert(warehouse.available('SKU006') === 9, 'available should reflect freed reservations after fulfil');

// Test fulfil with multiple reservations for same order (different SKUs)
warehouse.addItem('SKU007', 15);
warehouse.reserve('SKU007', 4, 'order3');
warehouse.reserve('SKU007', 3, 'order3');
console.assert(warehouse.fulfil('order3') === 7, 'fulfil should sum all reservations for the same order');

// Verify that order3's reservations are gone
console.assert(warehouse.available('SKU007') === 15, 'available should reflect freed reservations after fulfil');

// Test fulfil with no reservations (should throw error)
try {
  warehouse.fulfil('order4');
  console.assert(false, 'fulfil should throw error for order with no reservations');
} catch (e) {
  console.assert(e.message === "Order has no reservations to fulfil", 'fulfil should throw correct error for order with no reservations');
}

// Test lowStock method
console.log("Testing lowStock method...");

// Test lowStock with empty warehouse
console.assert(JSON.stringify(warehouse.lowStock(1)) === JSON.stringify([]), 'lowStock should return empty array for empty warehouse');

// Test lowStock with items above threshold
warehouse.addItem('SKU008', 10);
warehouse.addItem('SKU009', 5);
warehouse.addItem('SKU010', 3);
console.assert(JSON.stringify(warehouse.lowStock(15)) === JSON.stringify([]), 'lowStock should return empty array when all items are above threshold');

// Test lowStock with items below threshold
warehouse.addItem('SKU011', 2);
warehouse.addItem('SKU012', 1);
warehouse.addItem('SKU013', 8);
console.assert(JSON.stringify(warehouse.lowStock(5)) === JSON.stringify(['SKU011', 'SKU012']), 'lowStock should return items below threshold sorted alphabetically');

// Test lowStock with exact threshold match (should not include)
warehouse.addItem('SKU014', 5);
console.assert(JSON.stringify(warehouse.lowStock(5)) === JSON.stringify(['SKU011', 'SKU012']), 'lowStock should not include items at exact threshold');

// Test lowStock with reservation affecting availability
warehouse.reserve('SKU013', 3, 'order1');
console.assert(JSON.stringify(warehouse.lowStock(5)) === JSON.stringify(['SKU011', 'SKU012', 'SKU013']), 'lowStock should consider reservations when calculating available stock');

// Test lowStock with invalid threshold (should throw error)
try {
  warehouse.lowStock(-1);
  console.assert(false, 'lowStock should throw error for negative threshold');
} catch (e) {
  console.assert(e.message === "Threshold must be a positive integer", 'lowStock should throw correct error for negative threshold');
}

try {
  warehouse.lowStock(0);
  console.assert(false, 'lowStock should throw error for zero threshold');
} catch (e) {
  console.assert(e.message === "Threshold must be a positive integer", 'lowStock should throw correct error for zero threshold');
}

try {
  warehouse.lowStock(1.5);
  console.assert(false, 'lowStock should throw error for non-integer threshold');
} catch (e) {
  console.assert(e.message === "Threshold must be a positive integer", 'lowStock should throw correct error for non-integer threshold');
}

console.log("All tests completed successfully");