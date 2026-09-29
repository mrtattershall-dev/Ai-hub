const { Library } = require('./s1_library.js');
const { searchLines } = require('./s10_desk.js');

// Create a test library
const library = new Library();

// Add some test books
library.addBook("978-0-123456-78-9", "The Great Gatsby", 3);
library.addBook("978-0-987654-32-1", "1984", 2);
library.addBook("978-0-111111-11-1", "Animal Farm", 1);
library.addBook("978-0-222222-22-2", "Brave New World", 2);

// Test searchLines function
console.log("Testing searchLines with 'Great':");
console.log(searchLines(library, "Great"));

console.log("\nTesting searchLines with '1984':");
console.log(searchLines(library, "1984"));

console.log("\nTesting searchLines with 'nonexistent':");
console.log(searchLines(library, "nonexistent"));