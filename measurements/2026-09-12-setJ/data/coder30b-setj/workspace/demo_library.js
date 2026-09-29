// Demo script to show the new library functionality
const { Library } = require('./s1_library.js');

console.log("=== Library Demo ===");

// Create a new library
const library = new Library();

// Add some books
library.addBook("978-0-123456-78-9", "JavaScript Guide", 3);
library.addBook("978-0-987654-32-1", "Python Guide", 2);

console.log("Added books to library");
console.log("JavaScript Guide copies:", library.copies("978-0-123456-78-9"));
console.log("Python Guide copies:", library.copies("978-0-987654-32-1"));

// Test available method
console.log("\nAvailable copies:");
console.log("JavaScript Guide:", library.available("978-0-123456-78-9"));
console.log("Python Guide:", library.available("978-0-987654-32-1"));
console.log("Unknown book:", library.available("unknown-isbn"));

// Test checkout
console.log("\nChecking out books...");
library.checkout("978-0-123456-78-9", "Alice");
console.log("After Alice checks out JavaScript Guide:");
console.log("Available copies of JavaScript Guide:", library.available("978-0-123456-78-9"));

library.checkout("978-0-123456-78-9", "Bob");
console.log("After Bob checks out JavaScript Guide:");
console.log("Available copies of JavaScript Guide:", library.available("978-0-123456-78-9"));

// Test error handling
console.log("\nTesting error handling...");

try {
    library.checkout("unknown-isbn", "Charlie");
} catch (e) {
    console.log("Error for unknown ISBN:", e.message);
}

try {
    library.checkout("978-0-987654-32-1", "Charlie");
} catch (e) {
    console.log("Error for no copies available:", e.message);
}

try {
    library.checkout("978-0-123456-78-9", "Alice");
} catch (e) {
    console.log("Error for member already has book:", e.message);
}

console.log("\nDemo complete!");