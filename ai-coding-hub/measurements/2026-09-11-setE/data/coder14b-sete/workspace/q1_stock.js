class Warehouse {
  constructor() {
    this.items = {};
  }

  addItem(sku, qty) {
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error('Quantity must be a positive integer');
    }
    if (!this.items[sku]) {
      this.items[sku] = 0;
    }
    this.items[sku] += qty;
  }

  stock(sku) {
    return this.items[sku] || 0;
  }

  skus() {
    return Object.keys(this.items).sort();
  }
}

module.exports = Warehouse;
const assert = require('assert');

// Test addItem
const warehouse = new Warehouse();
warehouse.addItem('SKU1', 10);
assert.strictEqual(warehouse.stock('SKU1'), 10);

// Test addItem with invalid quantity
try {
  warehouse.addItem('SKU2', -5);
} catch (e) {
  assert.strictEqual(e.message, 'Quantity must be a positive integer');
}

// Test stock for unknown SKU
assert.strictEqual(warehouse.stock('SKU2'), 0);

// Test skus
warehouse.addItem('SKU3', 5);
assert.deepStrictEqual(warehouse.skus(), ['SKU1', 'SKU3']);

console.log('All tests passed');
