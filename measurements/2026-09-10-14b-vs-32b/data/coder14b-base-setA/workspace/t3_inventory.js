class Inventory {
  constructor() {
    this.items = {};
  }

  add(name, qty) {
    if (this.items[name]) {
      this.items[name] += qty;
    } else {
      this.items[name] = qty;
    }
  }

  remove(name, qty) {
    if (this.items[name] && this.items[name] >= qty) {
      if (this.items[name] > qty) {
  this.items[name] -= qty;
} else {
  delete this.items[name];
}
      if (this.items[name] === 0) {
        delete this.items[name];
      }
    } else {
      throw new Error(`Cannot remove ${qty} of ${name}. Not enough stock.`);
    }
  }

  count(name) {
    return this.items[name] || 0;
  }
}

module.exports = Inventory;
const assert = require('assert');

const inventory = new Inventory();

// Test add
inventory.add('apple', 10);
assert.strictEqual(inventory.count('apple'), 10);

// Test remove
inventory.remove('apple', 5);
assert.strictEqual(inventory.count('apple'), 5);

// Test remove with error
try {
  inventory.remove('apple', 10);
} catch (e) {
  assert.strictEqual(e.message, 'Cannot remove 10 of apple. Not enough stock.');
}

// Test count
assert.strictEqual(inventory.count('apple'), 5);
assert.strictEqual(inventory.count('banana'), 0);

console.log('All tests passed!');
