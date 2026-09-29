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
  const copies = library.copies(isbn);
  return `${available}/${copies}`;
}

function memberLine(library, member) {
  const loans = library.getLoans(member);
  if (loans.length === 0) {
    return `${member}: none`;
  }
  return `${member}: ${loans.join(', ')}`;
}

function makeLookup(library, cache) {
  return function(isbn) {
    if (cache.has(isbn)) {
      return cache.get(isbn);
    }
    const result = availability(library, isbn);
    cache.set(isbn, result);
    return result;
  };
}

function overdueLines(library, today) {
  const overdue = library.overdue(today);
  if (overdue.length === 0) {
    return '';
  }
  return overdue.map(item => `${item.member} owes ${item.isbn} (${item.daysLate} days)`).join('\n');
}

function fineReport(library, members) {
  // Get all loans with fines for the given members
  const fines = [];
  
  for (const member of members) {
    const loans = library.getLoans(member);
    for (const loan of loans) {
      const fine = library.getFine(loan, member);
      if (fine > 0) {
        fines.push({ member, fine });
      }
    }
  }
  
  // Sort by fine amount (descending) then by member name (ascending)
  fines.sort((a, b) => {
    if (b.fine !== a.fine) {
      return b.fine - a.fine; // Descending by fine amount
    }
    return a.member.localeCompare(b.member); // Ascending by member name
  });
  
  // Format the output
  return fines.map(item => `member: ${item.fine.toFixed(2)}`).join('\n');
}

function canBorrow(library, member) {
  const loans = library.getLoans(member);
  const fines = library.getFine(member);
  
  return loans.length < 3 && fines < 500;
}

function searchLines(library, text) {
  const isbnList = library.search(text);
  return isbnList.map(isbn => {
    const book = library.books.get(isbn);
    return `${isbn}: ${book.title}`;
  }).join('\n');
}

// Export the functions
module.exports = { shelfLine, availability, memberLine, makeLookup, overdueLines, fineReport, canBorrow, searchLines };