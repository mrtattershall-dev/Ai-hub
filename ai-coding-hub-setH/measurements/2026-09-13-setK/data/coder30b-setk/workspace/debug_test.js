const { Library } = require('./s1_library.js');

// Create a new library for testing
const library = new Library();

// Add some test books
library.addBook("978-0134685991", "Effective Java", 3);

console.log("Initial state:");
console.log("Available copies:", library.available("978-0134685991"));

// Checkout all copies
library.checkout("978-0134685991", "Alice");
console.log("After Alice checks out one:");
console.log("Available copies:", library.available("978-0134685991"));

library.checkout("978-0134685991", "Bob");
console.log("After Bob checks out one:");
console.log("Available copies:", library.available("978-0134685991"));

library.checkout("978-0134685991", "Charlie");
console.log("After Charlie checks out one:");
console.log("Available copies:", library.available("978-0134685991"));

// Now try to place a hold - this should NOT throw an error because there are no available copies
try {
    library.placeHold("978-0134685991", "David");
    console.log("Place hold succeeded - no error thrown");
} catch (e) {
    console.log("Place hold failed with error:", e.message);
}