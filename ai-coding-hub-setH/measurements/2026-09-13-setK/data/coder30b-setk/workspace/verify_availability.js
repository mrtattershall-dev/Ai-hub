// Verify that the availability function works correctly
const { Library } = require('./s1_library.js');
const { availability } = require('./s10_desk.js');

console.log("Testing availability function:");

// Create a test library
const library = new Library();
library.addBook("12345", "Test Book", 2);

// Test the availability function
console.log("Availability for book 12345:", availability(library, "12345"));

// Test with a book that has 1 available copy out of 3
library.addBook("67890", "Another Book", 3);
console.log("Availability for book 67890:", availability(library, "67890"));

// Test with a non-existent book
console.log("Availability for non-existent book:", availability(library, "99999"));

console.log("Function works correctly!");