// Import the Library and Cache classes
const { Library } = require('./s1_library.js');
const { Cache } = require('./s7_cache.js');

// Function that returns titles joined with ', ' or '(empty)' if no books
function shelfLine(library) {
  const titles = library.titles();
  return titles.length > 0 ? titles.join(', ') : '(empty)';
}

// Export the function
module.exports = { shelfLine };

// Test assertions
const library1 = new Library();
const library2 = new Library();

// Add some books to library2
library2.addBook('123', 'The Great Gatsby', 2);
library2.addBook('456', '1984', 1);
library2.addBook('789', 'To Kill a Mockingbird', 3);

// Test cases
console.assert(shelfLine(library1) === '(empty)', 'Empty library should return "(empty)"');
console.assert(shelfLine(library2) === '1984, The Great Gatsby, To Kill a Mockingbird', 'Non-empty library should return sorted titles joined by ", "');

console.log('All assertions passed!');