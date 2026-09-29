// Test the emptyNote function specifically
const { Warehouse } = require('./q1_stock.js');
const { emptyNote } = require('./q10_report.js');

// Create an empty warehouse
const emptyWarehouse = new Warehouse();

// Test with empty warehouse
const result = emptyNote(emptyWarehouse);
console.log('Empty warehouse result:', result);

// Create a non-empty warehouse
const filledWarehouse = new Warehouse();
filledWarehouse.addItem('apple', 5);
filledWarehouse.addItem('banana', 3);

// Test with non-empty warehouse
const result2 = emptyNote(filledWarehouse);
console.log('Non-empty warehouse result:', result2);

// Verify results
if (result === 'no stock') {
    console.log('✅ Empty warehouse test passed');
} else {
    console.log('❌ Empty warehouse test failed');
}

if (result2 === '') {
    console.log('✅ Non-empty warehouse test passed');
} else {
    console.log('❌ Non-empty warehouse test failed');
}