class Cart {
    constructor() {
        this.items = [];
    }
addItem(name, price, qty) {
    this.items.push({ name, price, qty });
}
total() {
    return parseFloat(this.items.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2));
}
applyDiscount(pct) {
    if (pct < 0 || pct > 100) {
        throw new Error("Discount percentage must be between 0 and 100.");
    }
    return this.total() * (1 - pct / 100);
}
}

module.exports = Cart;
const assert = require('assert');

// Test addItem
const cart = new Cart();
cart.addItem('Apple', 1.0, 3);
assert.strictEqual(cart.items.length, 1);
assert.deepStrictEqual(cart.items[0], { name: 'Apple', price: 1.0, qty: 3 });

// Test total
assert.strictEqual(cart.total(), 3.0);

// Test applyDiscount
assert.strictEqual(cart.applyDiscount(10), 2.7);
assert.strictEqual(cart.applyDiscount(0), 3.0);
assert.strictEqual(cart.applyDiscount(100), 0.0);

try {
    cart.applyDiscount(-5);
} catch (e) {
    assert.strictEqual(e.message, "Discount percentage must be between 0 and 100.");
}

try {
    cart.applyDiscount(105);
} catch (e) {
    assert.strictEqual(e.message, "Discount percentage must be between 0 and 100.");
}

console.log("All tests passed.");
