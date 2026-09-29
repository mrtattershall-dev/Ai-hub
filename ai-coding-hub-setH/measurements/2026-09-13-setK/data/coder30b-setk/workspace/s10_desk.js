// Import the Library class from s1_library.js
const { Library } = require('./s1_library.js');
// Import the Cache class from s7_cache.js
const { Cache } = require('./s7_cache.js');

// Function that returns library titles joined with ', ' or '(empty)' when no books
function shelfLine(library) {
  const titles = library.titles();
  return titles.length > 0 ? titles.join(', ') : '(empty)';
}

// Function that returns availability information for a book in the format 'available/copies'
function availability(library, isbn) {
  const totalCopies = library.copies(isbn);
  const availableCopies = library.available(isbn);
  return `${availableCopies}/${totalCopies}`;
}

// Function that returns member loan information in the format 'member: isbn1, isbn2' or 'member: none'
function memberLine(library, member) {
  const loans = library.loans(member);
  return loans.length > 0 ? `${member}: ${loans.join(', ')}` : `${member}: none`;
}

// Export the functions
module.exports = { shelfLine, availability, memberLine };
