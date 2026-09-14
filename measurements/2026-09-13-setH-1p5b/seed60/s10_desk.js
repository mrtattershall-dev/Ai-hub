// CANONICAL REFERENCE - cumulative correct state after setH goals 1-60 for this file.
// Goals 61+ are HELD OUT and deliberately not implemented.
//
//   goal 10  shelfLine(library)
//   goal 20  availability(library, isbn)
//   goal 30  memberLine(library, member)
//   goal 40  makeLookup(library, cache)
//   goal 50  overdueLines(library, today) - one line per library.overdue(today) entry IN THAT ORDER,
//            'member owes isbn (N days)', joined with newlines, '' when there are none
//   goal 60  fineReport(library, members) - 'member: $X.XX' for each member who OWES, sorted by
//            amount descending then by name
const { Library } = require('./s1_library.js');
const { Cache } = require('./s7_cache.js');

function shelfLine(library) {
  const t = library.titles();
  return t.length ? t.join(', ') : '(empty)';
}

function availability(library, isbn) {
  return library.available(isbn) + '/' + library.copies(isbn);
}

function memberLine(library, member) {
  const l = library.loans(member);
  return member + ': ' + (l.length ? l.join(', ') : 'none');
}

function makeLookup(library, cache) {
  return function lookup(isbn) {
    if (cache.has(isbn)) return cache.get(isbn);
    const answer = availability(library, isbn);
    cache.set(isbn, answer);
    return answer;
  };
}

// The order of library.overdue(today) is preserved exactly - it is already sorted by daysLate
// descending, then isbn, then member (goal 41), and this must not re-sort it.
function overdueLines(library, today) {
  return library.overdue(today)
    .map((r) => r.member + ' owes ' + r.isbn + ' (' + r.daysLate + ' days)')
    .join('\n');
}

function fineReport(library, members) {
  const owed = (members || [])
    .map((m) => ({ member: m, cents: library.fines(m) }))
    .filter((r) => r.cents > 0);
  owed.sort((a, b) => (b.cents - a.cents) || (a.member < b.member ? -1 : a.member > b.member ? 1 : 0));
  return owed.map((r) => r.member + ': $' + (r.cents / 100).toFixed(2)).join('\n');
}

module.exports = { shelfLine, availability, memberLine, makeLookup, overdueLines, fineReport, Library, Cache };
