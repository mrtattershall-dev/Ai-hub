const Warehouse = require('./q1_stock.js');
const assert = require('assert');

// Function to render stock information for a given SKU
function skuLine(warehouse, sku) {
  const qty = warehouse.stock(sku);
  return `{{sku}}: {{qty}}`.replace('{{sku}}', sku).replace('{{qty}}', qty);
}

// Example usage
const warehouse = new Warehouse();
warehouse.addItem('apple', 5);
warehouse.addItem('banana', 3);

console.log(skuLine(warehouse, 'apple')); // Output: apple: 5
console.log(skuLine(warehouse, 'banana')); // Output: banana: 3

// Asserts to verify the function
assert.strictEqual(skuLine(warehouse, 'apple'), 'apple: 5');
assert.strictEqual(skuLine(warehouse, 'banana'), 'banana: 3');
assert.strictEqual(skuLine(warehouse, 'orange'), 'orange: 0'); // No stock for 'orange'

console.log('All tests passed');
// Function to render item information for a given SKU
function itemLine(warehouse, sku) {
  const qty = warehouse.stock(sku);
  return `{{item.sku}} has {{item.qty}}`.replace('{{item.sku}}', sku).replace('{{item.qty}}', qty);
}

module.exports = {
  skuLine,
  itemLine
};
// Function to render reserved stock information for a given SKU
function reservedLine(warehouse, sku) {
  const available = warehouse.available(sku);
  const qty = warehouse.stock(sku);
  return `{{sku}}: {{available}} of {{qty}} free`.replace('{{sku}}', sku).replace('{{available}}', available).replace('{{qty}}', qty);
}

module.exports = {
  skuLine,
  itemLine,
  reservedLine,
  shoutLine
};
function shoutLine(warehouse, sku) {
  const qty = warehouse.stock(sku);
  return `{{sku | upper}}: {{qty}}`.replace('{{sku}}', sku.toUpperCase()).replace('{{qty}}', qty);
}
function stockTable(warehouse) {
  const skus = Object.keys(warehouse);
  const rows = skus.map(sku => `${sku}=${warehouse[sku]}`);
  return rows.join(';');
}
module.exports = { stockTable };
function emptyNote(warehouse) {
  const rows = stockTable(warehouse);
  return render('{{^rows}}no stock{{/rows}}{{#rows}}{{sku}} {{/rows}}', { rows });
}
module.exports = {
  skuLine,
  itemLine,
  reservedLine,
  shoutLine,
  stockTable,
  emptyNote
};
function lowReport(warehouse, threshold) {
  const low = warehouse.lowStock(threshold);
  return render('low: {{#low}}{{.}} {{/low}}', { low: low });
}
module.exports.lowReport = lowReport;
function jsonReport(warehouse) {
  const json = JSON.stringify(warehouse.toJSON());
  return `{{{{json}}}}`.replace('{{{{json}}}}', json);
}

module.exports.jsonReport = jsonReport;
function historyReport(warehouse, sku) {
  const events = warehouse.history(sku);
  const partial = '{{#events}}{{type}} {{qty}}, {{/events}}';
  const template = 'history: {{> events}}';
  return render(template, { events: events }, { partials: { events: partial } });
}

module.exports.historyReport = historyReport;
