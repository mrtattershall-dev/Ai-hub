const { Library } = require('./s1_library.js');
const { overdueLines } = require('./s10_desk.js');

// Create a test library
const library = new Library();
library.addBook("978-0134685991", "Effective Java", 3);
library.addBook("978-0201633610", "Design Patterns", 1);

// Add a member and checkout a book
library.addMember("Alice");
library.checkout("Alice", "978-0134685991");

// Test the overdueLines function with a date in the past to make books overdue
const today = new Date("2023-01-01");
const overdue = library.overdue(today);
console.log("Overdue items:", overdue);

// Test the overdueLines function
const lines = overdueLines(library, today);
console.log("Overdue lines:", lines);

// Test with no overdue items
const today2 = new Date("2023-12-01");
const overdue2 = library.overdue(today2);
console.log("Overdue items (no overdue):", overdue2);

const lines2 = overdueLines(library, today2);
console.log("Overdue lines (no overdue):", lines2);