// Test the availability function directly
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