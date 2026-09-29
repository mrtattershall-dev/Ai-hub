const { Library } = require('./s1_library.js');
const { overdueLines } = require('./s10_desk.js');

// Create a test library
const library = new Library();

// Add some test books
library.addBook('1234567890', 'Book Title 1', 'Author 1');
library.addBook('0987654321', 'Book Title 2', 'Author 2');

// Add some loans
library.loanBook('member1', '1234567890');
library.loanBook('member2', '0987654321');

// Simulate some overdue books (15 days late)
const today = 100; // arbitrary date
const overdue = library.overdue(today);
console.log('Overdue items:', overdue);

// Test the overdueLines function
const result = overdueLines(library, today);
console.log('Overdue lines:');
console.log(result);