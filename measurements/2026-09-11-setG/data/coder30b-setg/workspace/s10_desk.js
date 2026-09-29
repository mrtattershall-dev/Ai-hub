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
  return `${book.copies - book.loans.size}/${book.copies}`;
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
    
    // Calculate availability and cache the result
    const result = availability(library, isbn);
    cache.set(isbn, result);
    return result;
  };
}

function overdueLines(library, today) {
  const overdue = library.overdue(today);
  return overdue.map(item => `${item.member} owes ${item.isbn} (${item.days} days)`).join('\n');
}

function fineReport(library, members) {
  // Collect members with fines
  const membersWithFines = [];
  
  for (const member of members) {
    const fines = library.fines(member);
    if (fines > 0) {
      membersWithFines.push({ member, fines });
    }
  }
  
  // Sort by fines (descending) then by member name (ascending)
  membersWithFines.sort((a, b) => {
    if (b.fines !== a.fines) {
      return b.fines - a.fines; // Descending by fines
    }
    return a.member.localeCompare(b.member); // Ascending by name
  });
  
  // Format the output
  return membersWithFines.map(item => `${item.member}: $${(item.fines / 100).toFixed(2)}`).join('\n');
}

function canBorrow(library, member) {
  const loans = library.loans(member);
  const fines = library.fines(member);
  return loans.length < 3 && fines < 500;
}

module.exports = { shelfLine, availability, memberLine, makeLookup, overdueLines, fineReport, canBorrow };