const Library = require('./s1_library.js');
const Cache = require('./s7_cache.js');

function shelfLine(library) {
  const titles = library.titles();
  return titles.length > 0 ? titles.join(', ') : '(empty)';
}

// Assertions
const library = new Library();
library.addBook('123', 'Book One');
library.addBook('456', 'Book Two');

console.assert(shelfLine(library) === 'Book One, Book Two', 'Test 1 Failed');
console.assert(shelfLine(new Library()) === '(empty)', 'Test 2 Failed');

console.log('All tests passed!');
function availability(library, isbn) {
  const book = library.getBook(isbn);
  if (book) {
    return `${book.available}/${book.copies}`;
  }
  return '0/0';
}

module.exports.availability = availability;
module.exports.memberLine = memberLine;

function memberLine(library, member) {
  const loans = library.getLoans(member);
  if (loans.length > 0) {
    return `member: ${loans.join(', ')}`;
  }
  return 'member: none';
}
function makeLookup(library, cache) {
  return function(isbn) {
    if (cache.has(isbn)) {
      return cache.get(isbn);
    }
    const availabilityInfo = availability(library, isbn);
    cache.set(isbn, availabilityInfo);
    return availabilityInfo;
  };
}

module.exports.makeLookup = makeLookup;
function overdueLines(library, today) {
  return library.overdue(today).map(entry => `${entry.member} owes ${entry.isbn} (${entry.days} days)`).join('\n');
}

module.exports.overdueLines = overdueLines;
function fineReport(library, members) {
  // Filter members who owe fines
  const owingFines = members.filter(member => member.fine > 0);

  // Sort by amount owed (largest first) and then by name
  owingFines.sort((a, b) => {
    if (b.fine !== a.fine) {
      return b.fine - a.fine;
    }
    return a.name.localeCompare(b.name);
  });

  // Generate the formatted string
  return owingFines.map(member => `${member.name}: $${member.fine.toFixed(2)}`).join('\n');
}

module.exports = {
  shelfLine,
  availability,
  memberLine,
  makeLookup,
  overdueLines,
  fineReport
};
function canBorrow(library, member) {
  const loans = member.loans || 0;
  const fines = member.fines || 0;
  return loans < 3 && fines < 500;
}

module.exports.canBorrow = canBorrow;
function snapshot(library, cache, key) {
  const libraryJSON = JSON.stringify(library.toJSON());
  cache[key] = libraryJSON;
  return libraryJSON;
}
function restore(cache, key) {
  const libraryJSON = cache[key];
  if (libraryJSON) {
    return Library.fromJSON(libraryJSON);
  }
  return null;
}
function searchLines(library, text) {
  let results = [];
  for (let isbn in library) {
    if (library[isbn].title.includes(text)) {
      results.push(`${isbn}: ${library[isbn].title}`);
    }
  }
  return results.join('\n');
}

module.exports = {
  shelfLine,
  availability,
  memberLine,
  makeLookup,
  overdueLines,
  fineReport,
  canBorrow,
  snapshot,
  restore,
  searchLines
};
