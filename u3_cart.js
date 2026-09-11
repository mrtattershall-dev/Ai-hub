class Cart {
  constructor() {
    this.items = [];
  }
  
  addItem(name, price, qty) {
    this.items.push({ name, price, qty });
  }
  
  total() {
    return this.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  }
  
  applyDiscount(pct) {
    if (pct < 0 || pct > 100) {
      throw new Error("Discount percentage must be between 0 and 100");
    }
    const originalTotal = this.total();
    return originalTotal * (1 - pct / 100);
  }
}

module.exports = Cart;
// Test asserts
const Cart = require('./u3_cart.js');

// Test 1: Basic addItem and total
const cart = new Cart();
cart.addItem("Apple", 1.50, 3);
cart.addItem("Banana", 0.75, 2);
console.assert(cart.total() === 6.00, "Total should be 6.00");

// Test 2: applyDiscount with valid percentage
const discountedTotal = cart.applyDiscount(10);
console.assert(discountedTotal === 5.40, "Discounted total should be 5.40");

// Test 3: applyDiscount with 0% discount
const noDiscountTotal = cart.applyDiscount(0);
console.assert(noDiscountTotal === 6.00, "0% discount should return original total");

// Test 4: applyDiscount with 100% discount
const freeTotal = cart.applyDiscount(100);
console.assert(freeTotal === 0, "100% discount should return 0");

// Test 5: applyDiscount with invalid percentage (should throw)
let errorCaught = false;
try {
  cart.applyDiscount(101);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Should throw error for discount > 100");

errorCaught = false;
try {
  cart.applyDiscount(-1);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Should throw error for discount < 0");

console.log("All asserts passed!");
