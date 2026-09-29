// Final test to verify the release function works as specified
const { Warehouse } = require('./q1_stock.js');

// Create a new warehouse
const warehouse = new Warehouse();

// Add items to warehouse
warehouse.addItem('SKU001', 10);
warehouse.addItem('SKU002', 15);

// Reserve some items for order1
warehouse.reserve('SKU001', 3, 'order1');
warehouse.reserve('SKU002', 5, 'order1');

console.log("Initial state:");
console.log("Available SKU001:", warehouse.available('SKU001'));
console.log("Available SKU002:", warehouse.available('SKU002'));

// Release all reservations for order1
const freedUnits = warehouse.release('order1');
console.log("\nReleased all reservations for order1:");
console.log("Units freed:", freedUnits);

console.log("\nAfter release:");
console.log("Available SKU001:", warehouse.available('SKU001'));
console.log("Available SKU002:", warehouse.available('SKU002'));

// Test releasing a non-existent order
const freedUnits2 = warehouse.release('nonexistent');
console.log("\nReleased reservations for nonexistent order:");
console.log("Units freed:", freedUnits2);

// Test the new behavior: trying to remove more than available should throw an error
console.log("\nTesting remove() with more units than available:");
try {
  warehouse.remove('SKU001', 8); // Only 7 available (10 stock - 3 reserved)
  console.log("ERROR: Should have thrown an exception!");
} catch (error) {
  console.log("SUCCESS: Correctly threw error:", error.message);
}

// Test that removing available units still works
try {
  warehouse.remove('SKU001', 7); // 7 available units
  console.log("SUCCESS: Removed available units successfully");
  console.log("Remaining stock for SKU001:", warehouse.stock('SKU001'));
} catch (error) {
  console.log("ERROR: Should not have thrown an exception:", error.message);
}

console.log("\nTest completed successfully!");