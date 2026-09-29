const { Library } = require('./s1_library.js');
const { availability } = require('./s10_desk.js');

// Create a test library
const library = new Library();

// Add some books
library.addBook('978-0134685991', 'Effective Java', 3);
library.addBook('978-0201633610', 'Design Patterns', 1);

// Test availability function
console.log('Testing availability function:');
console.log('Effective Java:', availability(library, '978-0134685991')); // Should be "3/3"
console.log('Design Patterns:', availability(library, '978-0201633610')); // Should be "1/1"

// Test with a non-existent book
console.log('Non-existent book:', availability(library, '978-0000000000')); // Should be "0/0"