const Cart = require('./u3_cart.js');

// Test the rounding functionality
const cart = new Cart();
cart.addItem("Item 1", 10.123, 2);
cart.addItem("Item 2", 5.456, 1);

console.log("Total:", cart.total());
console.log("Expected: 25.70 (rounded to 2 decimal places)");