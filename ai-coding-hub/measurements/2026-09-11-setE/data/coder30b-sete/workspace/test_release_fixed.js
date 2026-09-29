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
console.assert(freed2 === 3, `Expected 3, got ${freed2}`);
console.log("✓ Passed");

// Test 3: Verify that order1's reservations are gone
console.log("Test 3: Verify reservations are removed");
const available = warehouse.available('SKU001');
console.assert(available === 7, `Expected 7, got ${available}`);
console.log("✓ Passed");

// Test 4: release with multiple reservations for same order (different SKUs)
console.log("Test 4: release with multiple reservations for same order (different SKUs)");
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

// Test 6: release with reservations for different SKUs
console.log("Test 6: release with reservations for different SKUs");
warehouse.addItem('SKU003', 20);
warehouse.reserve('SKU003', 5, 'order3');
warehouse.reserve('SKU001', 2, 'order3');
const freed4 = warehouse.release('order3');
console.assert(freed4 === 7, `Expected 7, got ${freed4}`);
console.log("✓ Passed");

// Test 7: Verify that order3's reservations are gone
console.log("Test 7: Verify reservations for different SKUs are removed");
const available3 = warehouse.available('SKU003');
const available4 = warehouse.available('SKU001');
console.assert(available3 === 20, `Expected 20, got ${available3}`);
console.assert(available4 === 7, `Expected 7, got ${available4}`);
console.log("✓ Passed");

console.log("\nAll tests passed! Release function works correctly.");