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
const cart = new Cart();
cart.addItem('Apple', 1.0, 2);
assert.deepStrictEqual(cart.items, [{ name: 'Apple', price: 1.0, qty: 2 }]);

// Test total
assert.strictEqual(cart.total(), 2.0);

// Test applyDiscount
assert.strictEqual(cart.applyDiscount(10), 1.8);
assert.throws(() => cart.applyDiscount(105), { message: "Discount percentage must be between 0 and 100" });

console.log("All tests passed!");
