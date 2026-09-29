const { Library } = require('./s1_library.js');
const { availability } = require('./s10_desk.js');

// Create a test library
const library = new Library();
library.addBook("978-0134685991", "Effective Java", 3);
library.addBook("978-0201633610", "Design Patterns", 1);

// Test the availability function
console.log("Testing availability function:");
console.log("Availability of 'Effective Java':", availability(library, "978-0134685991"));
console.log("Availability of 'Design Patterns':", availability(library, "978-0201633610"));
console.log("Availability of non-existent book:", availability(library, "978-1234567890"));