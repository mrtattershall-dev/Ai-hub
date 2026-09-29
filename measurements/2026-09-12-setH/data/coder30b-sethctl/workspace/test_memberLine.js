const { Library } = require('./s1_library.js');
const { memberLine } = require('./s10_desk.js');

// Create a test library
const library = new Library();

// Add some books
library.addBook('978-0134685991', 'Effective Java', 3);
library.addBook('978-0201633610', 'Design Patterns', 1);

// Test memberLine function with a member who has no loans
console.log('Testing memberLine function with no loans:');
console.log(memberLine(library, 'Alice')); // Should be "Alice: none"

// Test memberLine function with a member who has loans
library.checkout('978-0134685991', 'Alice');
console.log('Testing memberLine function with loans:');
console.log(memberLine(library, 'Alice')); // Should be "Alice: 978-0134685991"

// Test with another member
library.checkout('978-0201633610', 'Bob');
console.log('Testing memberLine function with another member:');
console.log(memberLine(library, 'Bob')); // Should be "Bob: 978-0201633610"