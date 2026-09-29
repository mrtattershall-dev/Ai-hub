// Test the reservedLine function
const { Warehouse } = require('./q1_stock.js');
const { reservedLine } = require('./q10_report.js');

// Create a warehouse and add some items
const warehouse = new Warehouse();
warehouse.addItem('apple', 10);
warehouse.addItem('banana', 5);

// Test reservedLine function
console.log("Testing reservedLine function:");
console.log(reservedLine(warehouse, 'apple'));
console.log(reservedLine(warehouse, 'banana'));
console.log(reservedLine(warehouse, 'orange'));