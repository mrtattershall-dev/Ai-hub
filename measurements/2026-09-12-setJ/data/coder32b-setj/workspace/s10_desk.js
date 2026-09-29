const Library = require('./s1_library.js');

function shelfLine(library) {
    const titles = library.titles();
    return titles.length > 0 ? titles.join(', ') : '(empty)';
}

// Tests
const assert = require('assert');

// Test with an empty library
const emptyLibrary = new Library();
assert.strictEqual(shelfLine(emptyLibrary), '(empty)');

// Test with a library with one book
const singleBookLibrary = new Library();
singleBookLibrary.addBook('1234567890', 'The Great Gatsby');
assert.strictEqual(shelfLine(singleBookLibrary), 'The Great Gatsby');

// Test with a library with multiple books
const multiBookLibrary = new Library();
multiBookLibrary.addBook('1234567891', '1984');
multiBookLibrary.addBook('1234567892', 'To Kill a Mockingbird');
multiBookLibrary.addBook('1234567893', 'The Catcher in the Rye');
assert.strictEqual(shelfLine(multiBookLibrary), '1984, The Catcher in the Rye, To Kill a Mockingbird');

console.log('All tests passed.');