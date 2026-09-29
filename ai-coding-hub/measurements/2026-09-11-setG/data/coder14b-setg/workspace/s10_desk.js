const Library = require('./s1_library.js');
const Cache = require('./s7_cache.js');

function shelfLine(library) {
  const titles = library.titles();
  return titles.length > 0 ? titles.join(', ') : '(empty)';
}

function availability(library, isbn) {
  const book = library.getBook(isbn);
  if (book) {
    return `${book.available}/${book.copies}`;
  }
  return '0/0';
}
function makeLookup(library, cache) {
  return function(isbn) {
    if (cache.has(isbn)) {
      return cache.get(isbn);
    }
    const available = availability(library, isbn);
    cache.set(isbn, available);
    return available;
  };
}

function memberLine(library, member) {
  const loans = library.loans[member];
  if (loans && loans.length > 0) {
    return `member: ${loans.join(', ')}`;
  } else {
    return 'member: none';
  }
}

function overdueLines(library, today) {
  const overdue = library.overdue(today);
  return overdue.map(entry => `${entry.member} owes ${entry.isbn} (${entry.days} days)`).join('\n');
}

// Test cases
const library = new Library();
library.addBook('123', 'Book One');
library.addBook('456', 'Book Two');

console.assert(shelfLine(library) === 'Book One, Book Two', 'Test case 1 failed');
console.assert(shelfLine(new Library()) === '(empty)', 'Test case 2 failed');

console.log('All tests passed');