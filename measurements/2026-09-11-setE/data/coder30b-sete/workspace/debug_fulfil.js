// Debug the fulfil method step by step
const { Warehouse } = require('./q1_stock.js');

// Create a new warehouse
const warehouse = new Warehouse();

// Add some items
warehouse.addItem('SKU005', 15);
console.log("Added 15 units of SKU005");

// Reserve some units for order2
warehouse.reserve('SKU005', 4, 'order2');
console.log("Reserved 4 units for order2");
console.log("Available after reservation:", warehouse.available('SKU005'));

// Reserve some units for order3
warehouse.reserve('SKU005', 3, 'order3');
console.log("Reserved 3 units for order3");
console.log("Available after second reservation:", warehouse.available('SKU005'));

// Check what reservations exist
console.log("Reservations for SKU005:", warehouse.reservations['SKU005']);

// Now call fulfil for order2
console.log("Calling fulfil for order2...");
const freed = warehouse.fulfil('order2');
console.log("Freed units:", freed);
console.log("Available after fulfil:", warehouse.available('SKU005'));

// Check reservations after fulfil
console.log("Reservations for SKU005 after fulfil:", warehouse.reservations['SKU005']);