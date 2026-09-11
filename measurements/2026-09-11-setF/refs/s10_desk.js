// Reference solution (final state of chain s10) - used only to prove checks-F.mjs can pass.
const { Library } = require('./s1_library.js');
const { Cache } = require('./s7_cache.js');

function shelfLine(library) {
  const t = library.titles();
  return t.length ? t.join(', ') : '(empty)';
}

function availability(library, isbn) { return `${library.available(isbn)}/${library.copies(isbn)}`; }

function memberLine(library, member) {
  const l = library.loans(member);
  return `${member}: ${l.length ? l.join(', ') : 'none'}`;
}

function makeLookup(library, cache) {
  return (isbn) => {
    if (cache.has(isbn)) return cache.get(isbn);
    const v = availability(library, isbn);
    cache.set(isbn, v);
    return v;
  };
}

function overdueLines(library, today) {
  return library.overdue(today).map((o) => `${o.member} owes ${o.isbn} (${o.daysLate} days)`).join('\n');
}

function fineReport(library, members) {
  return members.filter((m) => library.fines(m) > 0)
    .sort((a, b) => library.fines(b) - library.fines(a) || (a < b ? -1 : a > b ? 1 : 0))
    .map((m) => `${m}: $${(library.fines(m) / 100).toFixed(2)}`).join('\n');
}

function canBorrow(library, member) { return library.loans(member).length < 3 && library.fines(member) < 500; }

function snapshot(library, cache, key) {
  const s = JSON.stringify(library.toJSON());
  cache.set(key, s);
  return s;
}

function restore(cache, key) {
  if (!cache.has(key)) return null;
  return Library.fromJSON(JSON.parse(cache.get(key)));
}

function searchLines(library, text) {
  const title = new Map(library.toJSON().books.map((b) => [b.isbn, b.title]));
  return library.search(text).map((i) => `${i}: ${title.get(i)}`).join('\n');
}

module.exports = { shelfLine, availability, memberLine, makeLookup, overdueLines, fineReport, canBorrow, snapshot, restore, searchLines };
