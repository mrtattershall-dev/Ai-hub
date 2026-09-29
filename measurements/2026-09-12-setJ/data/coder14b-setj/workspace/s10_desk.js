const Library = require('./s1_library.js');
const Cache = require('./s7_cache.js');

function shelfLine(library) {
  const titles = library.titles();
  return titles.length > 0 ? titles.join(', ') : '(empty)';
}

module.exports = { shelfLine };
const assert = require('assert');

// Test cases
const library = new Library();
library.addBook('123', 'Book One');
library.addBook('456', 'Book Two');

assert.strictEqual(shelfLine(library), 'Book One, Book Two');
library.addBook('789', 'Book Three');
assert.strictEqual(shelfLine(library), 'Book One, Book Two, Book Three');

library = new Library();
assert.strictEqual(shelfLine(library), '(empty)');

console.log('All tests passed!');
