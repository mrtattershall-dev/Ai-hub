const Library = require('./s1_library.js');
const Cache = require('./s7_cache.js');

function shelfLine(library) {
  const titles = library.titles();
  return titles.length > 0 ? titles.join(', ') : '(empty)';
}

function memberLine(library, member) {
    // memberLine implementation
}

function makeLookup(library, cache) {
    return function(isbn) {
        if (cache.has(isbn)) {
            return cache.get(isbn);
        }
        const availability = availability(library, isbn);
        cache.set(isbn, availability);
        return availability;
    };
  const loans = library.loans[member];
  if (loans && loans.length > 0) {
    return `member: ${loans.join(', ')}`;
  } else {
    return 'member: none';
  }
}

module.exports = {
  shelfLine,
  memberLine,
  overdueLines
};
function overdueLines(library, today) {
  const overdue = library.overdue(today);
  return overdue.map(entry => `${entry.member} owes ${entry.isbn} (${entry.days} days)`).join('\n');
}
