const Library = require('./s1_library.js');

function shelfLine(library) {
    const titles = library.titles();
    return titles.length > 0 ? titles.join(', ') : '(empty)';
}

function availability(library, isbn) {
    const book = library.getBook(isbn);
    if (book) {
        return `${book.copiesAvailable}/${book.totalCopies}`;
    }
    return '0/0';
}

module.exports = { shelfLine, availability };
const assert = require('assert');

// Test cases
const library = new Library();
assert.strictEqual(shelfLine(library), '(empty)', 'Empty library should return "(empty)"');

library.addBook('1234567890', 'The Great Gatsby');
assert.strictEqual(shelfLine(library), 'The Great Gatsby', 'Single book should return its title');

library.addBook('0987654321', '1984');
assert.strictEqual(shelfLine(library), '1984, The Great Gatsby', 'Multiple books should return titles sorted alphabetically');

console.log('All tests passed.');
