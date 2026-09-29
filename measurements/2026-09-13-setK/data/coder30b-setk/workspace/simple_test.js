// Simple test for just the availability function
const { Library } = require('./s1_library.js');
const { availability } = require('./s10_desk.js');

// Create a test library
const library = new Library();
library.addBook("12345", "Test Book", 2);

// Test the availability function
console.log("Testing availability function:");
console.log("Availability:", availability(library, "12345"));

// Test with a non-existent book
console.log("Availability of non-existent book:", availability(library, "99999"));

// Test with a book that has 0 available copies
library.addBook("67890", "Another Book", 1);
library.checkout("67890", "member1");
console.log("Availability of book with no copies:", availability(library, "67890"));