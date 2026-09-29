const { Library } = require('./s1_library.js');

const library = new Library();
library.addBook("978-0134685991", "Effective Java", 3);
library.addBook("978-0134685991", "Effective Java", 2); // Now 5 copies

console.log("Initial copies:", library.copies("978-0134685991"));
console.log("Available before checkout:", library.available("978-0134685991"));

// First checkout
library.checkout("978-0134685991", "Alice");
console.log("Available after first checkout:", library.available("978-0134685991"));

// Try to checkout again - should fail
try {
    library.checkout("978-0134685991", "Bob");
    console.log("ERROR: Second checkout should have failed but didn't");
} catch (e) {
    console.log("SUCCESS: Second checkout failed as expected:", e.message);
}