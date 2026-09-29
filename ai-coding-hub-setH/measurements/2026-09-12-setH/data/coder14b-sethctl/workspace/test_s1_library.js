const assert = require('assert');
const Library = require('./s1_library.js');

describe('Library', function() {
  let library;

  beforeEach(function() {
    library = new Library();
  });

  describe('addBook', function() {
    it('should add a new book', function() {
      library.addBook('12345', 'Book One');
      assert.strictEqual(library.copies('12345'), 1);
    });

    it('should add copies to an existing book', function() {
      library.addBook('12345', 'Book One');
      library.addBook('12345', 'Book One', 2);
      assert.strictEqual(library.copies('12345'), 3);
    });

    it('should throw an error for non-positive copies', function() {
      assert.throws(() => library.addBook('12345', 'Book One', -1), Error);
      assert.throws(() => library.addBook('12345', 'Book One', 0), Error);
      assert.throws(() => library.addBook('12345', 'Book One', 'a'), Error);
    });
  });

  describe('copies', function() {
    it('should return the number of copies for a known isbn', function() {
      library.addBook('12345', 'Book One', 3);
      assert.strictEqual(library.copies('12345'), 3);
    });

    it('should return 0 for an unknown isbn', function() {
      assert.strictEqual(library.copies('67890'), 0);
    });
  });

  describe('titles', function() {
    it('should return an empty array if no books are added', function() {
      assert.deepStrictEqual(library.titles(), []);
    });

    it('should return an array of titles sorted alphabetically', function() {
      library.addBook('12345', 'Book One');
      library.addBook('67890', 'Book Two');
      library.addBook('54321', 'Book Three');
      assert.deepStrictEqual(library.titles(), ['Book One', 'Book Three', 'Book Two']);
    });
  });
});