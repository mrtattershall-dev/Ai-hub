const { Library } = require('./s1_library.js');
const { availability } = require('./s10_desk.js');

// Create a test library
const library = new Library();

// Add a book with 2 copies
library.addBook("978-0-123456-78-9", "The Great Gatsby", 2);

// Test availability function
console.log("Testing availability function:");
console.log("Available copies:", library.available("978-0-123456-78-9"));
console.log("Total copies:", library.copies("978-0-123456-78-9"));
console.log("Availability result:", availability(library, "978-0-123456-78-9"));

// Test with a book that has 1 available copy
library.checkout("978-0-123456-78-9", "Alice");
console.log("\nAfter checking out one copy:");
console.log("Available copies:", library.available("978-0-123456-78-9"));
console.log("Total copies:", library.copies("978-0-123456-78-9"));
console.log("Availability result:", availability(library, "978-0-123456-78-9"));