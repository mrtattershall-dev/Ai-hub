// Test file for Warehouse release function
const { Warehouse } = require('./q1_stock.js');

// Create a new warehouse
const warehouse = new Warehouse();

console.log("Testing Warehouse release function...");

// Test 1: release with no reservations
console.log("Test 1: release with no reservations");
const freed1 = warehouse.release('order1');
console.assert(freed1 === 0, `Expected 0, got ${freed1}`);
console.log("✓ Passed");

// Test 2: release with reservations
console.log("Test 2: release with reservations");
warehouse.addItem('SKU001', 10);
warehouse.reserve('SKU001', 3, 'order1');
warehouse.reserve('SKU001', 2, 'order2');
const freed2 = warehouse.release('order1');
console.assert(freed2 === 5, `Expected 5, got ${freed2}`);
console.log("✓ Passed");

// Test 3: Verify that order1's reservations are gone
console.log("Test 3: Verify reservations are removed");
const available = warehouse.available('SKU001');
console.assert(available === 5, `Expected 5, got ${available}`);
console.log("✓ Passed");

// Test 4: release with multiple reservations for same order
console.log("Test 4: release with multiple reservations for same order");
warehouse.addItem('SKU002', 15);
warehouse.reserve('SKU002', 4, 'order2');
warehouse.reserve('SKU002', 3, 'order2');
const freed3 = warehouse.release('order2');
console.assert(freed3 === 7, `Expected 7, got ${freed3}`);
console.log("✓ Passed");

// Test 5: Verify that order2's reservations are gone
console.log("Test 5: Verify multiple reservations are removed");
const available2 = warehouse.available('SKU002');
console.assert(available2 === 15, `Expected 15, got ${available2}`);
console.log("✓ Passed");

console.log("\nAll tests passed! Release function works correctly.");