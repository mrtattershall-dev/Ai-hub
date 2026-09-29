// Test file for s10_desk.js memberLine function
const { Library } = require('./s1_library.js');
const { memberLine } = require('./s10_desk.js');

// Create a mock library with some test data
const library = new Library();

// Add some test books
library.addBook('1234567890', 'Book One', 2);
library.addBook('0987654321', 'Book Two', 1);

// Add some loans for testing
library.checkout('1234567890', 'member1');
library.checkout('0987654321', 'member1');
library.checkout('1234567890', 'member2');

console.log('Testing memberLine function:');
console.log('member1 with loans:', memberLine(library, 'member1'));
console.log('member2 with loans:', memberLine(library, 'member2'));
console.log('member3 with no loans:', memberLine(library, 'member3'));