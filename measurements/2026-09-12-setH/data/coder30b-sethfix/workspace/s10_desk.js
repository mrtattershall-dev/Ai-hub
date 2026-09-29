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
  const book = library.books.get(isbn);
  if (!book) {
    return 'not found';
  }
  // Get available copies using the library's available method
  const availableCopies = library.available(isbn);
  return `${availableCopies}/${book.copies}`;
}

function memberLine(library, member) {
  const loans = library.loans(member);
  if (loans.length === 0) {
    return `${member}: none`;
  }
  return `${member}: ${loans.join(', ')}`;
}

function makeLookup(library, cache) {
  return function(isbn) {
    // Check if result is already in cache
    if (cache.has(isbn)) {
      return cache.get(isbn);
    }
    
    // Calculate availability and cache it
    const result = availability(library, isbn);
    cache.set(isbn, result);
    return result;
  };
}

function overdueLines(library, today) {
  const overdueItems = library.overdue(today);
  if (overdueItems.length === 0) {
    return '';
  }
  
  return overdueItems.map(item => `${item.member} owes ${item.isbn} (${item.daysLate} days)`).join('\n');
}

module.exports = { shelfLine, availability, memberLine, makeLookup, overdueLines };
// Add assertions to test the implementation
function runTests() {
  console.log('Running shelfLine tests...');
  
  // Test 1: Empty library
  const emptyLibrary = new Library();
  const result1 = shelfLine(emptyLibrary);
  if (result1 === '(empty)') {
    console.log('PASS: Empty library returns "(empty)"');
  } else {
    console.log('FAIL: Empty library should return "(empty)", got "' + result1 + '"');
  }
  
  // Test 2: Library with one book
  const singleLibrary = new Library();
  singleLibrary.addBook('123', 'The Great Gatsby');
  const result2 = shelfLine(singleLibrary);
  if (result2 === 'The Great Gatsby') {
    console.log('PASS: Single book library returns title');
  } else {
    console.log('FAIL: Single book library should return title, got "' + result2 + '"');
  }
  
  // Test 3: Library with multiple books
  const multiLibrary = new Library();
  multiLibrary.addBook('123', 'The Great Gatsby');
  multiLibrary.addBook('456', '1984');
  multiLibrary.addBook('789', 'To Kill a Mockingbird');
  const result3 = shelfLine(multiLibrary);
  // Titles should be sorted alphabetically
  if (result3 === '1984, The Great Gatsby, To Kill a Mockingbird') {
    console.log('PASS: Multiple books are sorted and joined correctly');
  } else {
    console.log('FAIL: Multiple books should be sorted and joined, got "' + result3 + '"');
  }
  
  console.log('All tests completed');
}

runTests();
