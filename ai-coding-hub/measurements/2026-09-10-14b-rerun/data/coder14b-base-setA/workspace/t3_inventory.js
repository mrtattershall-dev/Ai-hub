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
    if (!this.items[name] || this.items[name] < qty) {
      throw new Error("Not enough stock to remove");
    }
    this.items[name] -= qty;
if (this.items[name] <= 0) {
  delete this.items[name];
}
  }

  count(name) {
    return this.items[name] || 0;
  }
}

module.exports = Inventory;
const assert = require('assert');

const inventory = new Inventory();

// Test add method
inventory.add('apple', 10);
assert.strictEqual(inventory.count('apple'), 10);

// Test remove method
inventory.remove('apple', 5);
assert.strictEqual(inventory.count('apple'), 5);

// Test remove method with error handling
try {
  inventory.remove('apple', 10);
} catch (e) {
  assert.strictEqual(e.message, "Not enough stock to remove");
}

// Test count method
assert.strictEqual(inventory.count('banana'), 0);

console.log("All tests passed!");
