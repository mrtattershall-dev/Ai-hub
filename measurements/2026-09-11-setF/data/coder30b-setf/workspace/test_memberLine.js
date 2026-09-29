const { Library } = require('./s1_library.js');
const { memberLine } = require('./s10_desk.js');

// Create a test library
const library = new Library();

// Add some books
library.addBook("978-0-123456-78-9", "The Great Gatsby", 3);
library.addBook("978-0-987654-32-1", "1984");
library.addBook("978-0-111111-11-1", "Animal Farm", 1);

// Test member with no loans
console.log(memberLine(library, "Alice"));

// Test member with loans
library.checkout("Alice", "978-0-123456-78-9");
library.checkout("Alice", "978-0-987654-32-1");
console.log(memberLine(library, "Alice"));

// Test another member with no loans
console.log(memberLine(library, "Bob"));