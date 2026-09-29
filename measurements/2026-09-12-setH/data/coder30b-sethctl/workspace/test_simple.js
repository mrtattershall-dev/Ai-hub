const { Library } = require('./s1_library.js');

// Test the implementation
const library = new Library();

// Add a book
library.addBook("978-0201633610", "Design Patterns", 2);

console.log("Initial copies:", library.copies("978-0201633610"));
console.log("Initial available:", library.available("978-0201633610"));

// Checkout one copy
library.checkout("978-0201633610", "member1");
console.log("After checkout 1:", library.available("978-0201633610"));

// Checkout second copy
library.checkout("978-0201633610", "member2");
console.log("After checkout 2:", library.available("978-0201633610"));

// Try to checkout when no copies left
try {
    library.checkout("978-0201633610", "member3");
    console.log("ERROR: Should have thrown an exception");
} catch (e) {
    console.log("Correctly threw error when no copies available:", e.message);
}

console.log("Final available:", library.available("978-0201633610"));