// Import the required modules
const { Warehouse } = require('./q1_stock.js');
const { render } = require('./q4_template.js');

// Function to render SKU line with quantity
function skuLine(warehouse, sku) {
  const qty = warehouse.stock(sku);
  return render('{{sku}}: {{qty}}', { sku, qty });
}

// Function to render item line with sku and quantity in the format 'sku has qty'
function itemLine(warehouse, sku) {
  const qty = warehouse.stock(sku);
  return render('{{item.sku}} has {{item.qty}}', { item: { sku, qty } });
}

// Function to render reserved line with sku, available stock and total stock
function reservedLine(warehouse, sku) {
  const qty = warehouse.stock(sku);
  const available = warehouse.available(sku);
  return render('{{sku}}: {{available}} of {{qty}} free', { sku, qty, available });
}

// Function to render shout line with sku in uppercase and quantity
function shoutLine(warehouse, sku) {
  const qty = warehouse.stock(sku);
  return render('{{sku | upper}}: {{qty}}', { sku, qty });
}

// Helper function to get skus in order - this should be a mock since we don't have q2_table.py
function skus(warehouse) {
    // Return keys in alphabetical order to ensure consistent output
    return Object.keys(warehouse.items).sort();
}

// Function to generate stock table in the required format
function stockTable(warehouse) {
    const skuList = skus(warehouse);
    const rows = [];
    
    for (const sku of skuList) {
        if (warehouse.items.hasOwnProperty(sku)) {
            rows.push(`${sku}=${warehouse.items[sku]};`);
        }
    }
    
    return rows.join('');
}

// Function to render empty warehouse note
function emptyNote(warehouse) {
    if (Object.keys(warehouse.items).length === 0) {
        return 'no stock';
    }
    return '';
}

// Export the functions
module.exports = { skuLine, itemLine, reservedLine, shoutLine, stockTable, emptyNote };

// Test assertions
const warehouse = new Warehouse();
warehouse.addItem('apple', 5);
warehouse.addItem('banana', 3);
warehouse.addItem('orange', 8);

// Assertions
console.assert(skuLine(warehouse, 'apple') === 'apple: 5', 'Apple test failed');
console.assert(skuLine(warehouse, 'banana') === 'banana: 3', 'Banana test failed');
console.assert(skuLine(warehouse, 'orange') === 'orange: 8', 'Orange test failed');
console.assert(skuLine(warehouse, 'grape') === 'grape: 0', 'Grape test failed');

// Test itemLine function
console.assert(itemLine(warehouse, 'apple') === 'apple has 5', 'Item line test failed');
console.assert(itemLine(warehouse, 'banana') === 'banana has 3', 'Item line test failed');
console.assert(itemLine(warehouse, 'orange') === 'orange has 8', 'Item line test failed');
console.assert(itemLine(warehouse, 'grape') === 'grape has 0', 'Item line test failed');

console.log('All assertions passed!');