const { Library } = require('./s1_library.js');
const { overdueLines } = require('./s10_desk.js');

// Create a test library
const library = new Library();

// Add some books
library.addBook("978-0-123456-78-9", "The Great Gatsby", 3);
library.addBook("978-0-987654-32-1", "1984");
library.addBook("978-0-111111-11-1", "Animal Farm", 1);

// Test with no overdue items
console.log("Test 1 - No overdue items:");
console.log('Result: "' + overdueLines(library, 0) + '"');
console.log('Expected: ""');

// Test with overdue items
console.log("\nTest 2 - With overdue items:");
// Checkout books to members
library.checkout("978-0-123456-78-9", "Alice", 0);
library.checkout("978-0-987654-32-1", "Bob", 0);
library.checkout("978-0-111111-11-1", "Charlie", 0);

// Set due dates to make some overdue (15 days late)
// Alice's book due day 0 + 14 = 14, so day 15 is 1 day late
// Bob's book due day 0 + 14 = 14, so day 15 is 1 day late  
// Charlie's book due day 0 + 14 = 14, so day 15 is 1 day late
console.log('Result: "' + overdueLines(library, 15) + '"');

// Test with multiple overdue items with different lateness
console.log("\nTest 3 - Multiple overdue items:");
// Make one book 5 days late and another 3 days late
console.log('Result: "' + overdueLines(library, 20) + '"');