const { Library } = require('./s1_library.js');
const { Cache } = require('./s7_cache.js');

function shelfLine(library) {
  const titles = library.titles();
  if (titles.length === 0) {
    return '(empty)';
  }
  return titles.join(', ');
}

function availability(library, isbn) {
  const available = library.available(isbn);
  const total = library.copies(isbn);
  return `${available}/${total}`;
}

function memberLine(library, member) {
  const loans = library.loans(member);
  if (loans.length === 0) {
    return `${member}: none`;
  }
  return `${member}: ${loans.join(', ')}`;
}

function overdueLines(library, today) {
  const overdue = library.overdue(today);
  return overdue.map(entry => `${entry.member} owes ${entry.isbn} (${entry.days} days)`).join('\n');
}

// Test asserts
const library = new Library();
console.assert(shelfLine(library) === '(empty)', 'Empty library test failed');

library.addBook('1', 'Book A', 1);
console.assert(shelfLine(library) === 'Book A', 'Single book test failed');

library.addBook('2', 'Book B', 1);
console.assert(shelfLine(library) === 'Book A, Book B', 'Two books test failed');

library.addBook('3', 'Book C', 1);
console.assert(shelfLine(library) === 'Book A, Book B, Book C', 'Three books test failed');

// Test sorting
library.addBook('4', 'Alpha', 1);
library.addBook('5', 'Beta', 1);
const result = shelfLine(library);
const expected = 'Alpha, Beta, Book A, Book B, Book C';
console.assert(result === expected, `Sorting test failed: got "${result}", expected "${expected}"`);

console.log('All asserts passed!');

module.exports = { shelfLine, availability, memberLine, overdueLines };