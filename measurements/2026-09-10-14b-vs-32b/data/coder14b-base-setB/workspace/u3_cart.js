class Cart {
  constructor() {
    this.items = [];
  }

  addItem(name, price, qty) {
    this.items.push({ name, price, qty });
  }

  total() {
    return parseFloat(this.items.reduce((acc, item) => acc + item.price * item.qty, 0).toFixed(2));
  }

  applyDiscount(pct) {
    if (pct < 0 || pct > 100) {
      throw new Error("Discount percentage must be between 0 and 100");
    }
    return this.total() * (1 - pct / 100);
  }
}

module.exports = Cart;
const assert = require('assert');

// Test addItem
let cart = new Cart();
cart.addItem("Apple", 1.0, 2);
assert.strictEqual(cart.total(), 2.0);

// Test total
cart.addItem("Banana", 0.5, 3);
assert.strictEqual(cart.total(), 3.5);

// Test applyDiscount
assert.strictEqual(cart.applyDiscount(10), 3.15);

// Test applyDiscount with invalid percentage
try {
  cart.applyDiscount(105);
  assert.fail("Expected an error to be thrown");
} catch (e) {
  assert.strictEqual(e.message, "Discount percentage must be between 0 and 100");
}

console.log("All tests passed!");
