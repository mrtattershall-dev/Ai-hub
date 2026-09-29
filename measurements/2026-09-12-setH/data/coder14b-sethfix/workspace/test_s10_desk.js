const { expect } = require('chai');
const { shelfLine } = require('./s10_desk.js');
const Library = require('./s1_library.js');

describe('shelfLine', function() {
  it('should return titles joined by ", " when there are books', function() {
    const library = new Library();
    library.addBook('Book 1');
    library.addBook('Book 2');
    assert.strictEqual(shelfLine(library), 'Book 1, Book 2');
  });

  it('should return "(empty)" when there are no books', function() {
    const library = new Library();
    assert.strictEqual(shelfLine(library), '(empty)');
  });
});