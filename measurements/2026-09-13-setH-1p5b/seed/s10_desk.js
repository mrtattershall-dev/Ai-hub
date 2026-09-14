// CANONICAL REFERENCE - cumulative correct state after setH goals 10, 20, 30, 40.
// Goal 50 onward (overdueLines, fineReport) is HELD OUT and deliberately not implemented.
//
//   goal 10  shelfLine(library)  - titles() joined with ', ', or '(empty)'
//   goal 20  availability(library, isbn) - 'available/copies'
//   goal 30  memberLine(library, member) - 'member: isbn1, isbn2' or 'member: none'
//   goal 40  makeLookup(library, cache) - memoises availability in the given Cache
//
// s1_library.js and s7_cache.js are required for their real exports. Both are local artifacts that
// exist in the workspace, so the dependency firewall classifies them NEW_DEP_OK.
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

module.exports = { shelfLine, availability, memberLine, makeLookup, Library, Cache };
