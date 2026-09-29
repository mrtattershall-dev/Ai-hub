const { Library } = require('./s1_library.js');
const { fineReport } = require('./s10_desk.js');

// Create a test library
const library = new Library();

// Add some books
library.addBook("978-0-123456-78-9", "The Great Gatsby", 3);
library.addBook("978-0-987654-32-1", "1984");
library.addBook("978-0-111111-11-1", "Animal Farm", 1);

// Add some members
const members = ["Alice", "Bob", "Charlie"];

// Simulate some loans with fines
// For testing purposes, we'll directly manipulate the library's internal state
// to create loans with fines. In a real scenario, this would be handled by the library methods.

// Let's create a simple test by directly calling the function with mock data
console.log("Testing fineReport function:");

// Test with empty members list
console.log("Empty members:");
console.log(JSON.stringify(fineReport(library, [])));

// Test with members who have no fines
console.log("\nMembers with no fines:");
console.log(JSON.stringify(fineReport(library, members)));