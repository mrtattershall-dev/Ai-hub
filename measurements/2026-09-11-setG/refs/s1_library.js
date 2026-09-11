// Reference solution (final state of chain s1) - used only to prove checks-F.mjs can pass.
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

class Library {
  constructor() {
    this.books = new Map();   // isbn -> { isbn, title, copies }
    this.loanList = [];       // { isbn, member, day }
    this.holdQ = new Map();   // isbn -> [member]
    this.owed = new Map();    // member -> cents
  }

  addBook(isbn, title, copies = 1) {
    if (!Number.isInteger(copies) || copies <= 0) throw new Error('copies must be a positive integer');
    const b = this.books.get(isbn);
    if (b) b.copies += copies;
    else this.books.set(isbn, { isbn, title, copies });
  }

  copies(isbn) { const b = this.books.get(isbn); return b ? b.copies : 0; }

  titles() { return [...this.books.values()].map((b) => b.title).sort(); }

  _onLoan(isbn) { return this.loanList.filter((l) => l.isbn === isbn).length; }

  available(isbn) { return this.copies(isbn) - this._onLoan(isbn); }

  _has(isbn, member) { return this.loanList.some((l) => l.isbn === isbn && l.member === member); }

  _mayBorrow(member) {
    if (this.loanList.filter((l) => l.member === member).length >= 3) throw new Error('loan limit reached for ' + member);
    if (this.fines(member) >= 500) throw new Error('unpaid fines too high for ' + member);
  }

  checkout(isbn, member, day = 0) {
    if (!this.books.has(isbn)) throw new Error('unknown isbn ' + isbn);
    if (this._has(isbn, member)) throw new Error(member + ' already has ' + isbn);
    if (this.available(isbn) <= 0) throw new Error('no copy of ' + isbn + ' is available');
    this._mayBorrow(member);
    this.loanList.push({ isbn, member, day });
  }

  returnBook(isbn, member, day = 0) {
    const i = this.loanList.findIndex((l) => l.isbn === isbn && l.member === member);
    if (i < 0) throw new Error(member + ' does not have ' + isbn);
    const [loan] = this.loanList.splice(i, 1);
    const fine = Math.max(0, day - (loan.day + 14)) * 25;
    if (fine) this.owed.set(member, this.fines(member) + fine);
    const q = this.holdQ.get(isbn);
    if (q && q.length) {
      const next = q.shift();
      if (!q.length) this.holdQ.delete(isbn);
      this.loanList.push({ isbn, member: next, day });
    }
    return fine;
  }

  loans(member) { return this.loanList.filter((l) => l.member === member).map((l) => l.isbn).sort(); }

  placeHold(isbn, member) {
    if (!this.books.has(isbn)) throw new Error('unknown isbn ' + isbn);
    if (this.available(isbn) > 0) throw new Error('a copy of ' + isbn + ' is available');
    if (this._has(isbn, member)) throw new Error(member + ' already has ' + isbn);
    const q = this.holdQ.get(isbn) || [];
    if (q.includes(member)) throw new Error(member + ' already holds ' + isbn);
    this._mayBorrow(member);
    q.push(member);
    this.holdQ.set(isbn, q);
  }

  holds(isbn) { return [...(this.holdQ.get(isbn) || [])]; }

  dueDay(isbn, member) {
    const l = this.loanList.find((x) => x.isbn === isbn && x.member === member);
    if (!l) throw new Error(member + ' does not have ' + isbn);
    return l.day + 14;
  }

  overdue(today) {
    return this.loanList.filter((l) => today > l.day + 14)
      .map((l) => ({ isbn: l.isbn, member: l.member, daysLate: today - (l.day + 14) }))
      .sort((a, b) => b.daysLate - a.daysLate || cmp(a.isbn, b.isbn) || cmp(a.member, b.member));
  }

  fines(member) { return this.owed.get(member) || 0; }

  pay(member, cents) {
    if (typeof cents !== 'number' || !(cents > 0)) throw new Error('a payment must be a positive amount');
    if (cents > this.fines(member)) throw new Error(member + ' owes only ' + this.fines(member));
    const left = this.fines(member) - cents;
    if (left) this.owed.set(member, left); else this.owed.delete(member);
  }

  toJSON() {
    const books = [...this.books.values()].map((b) => ({ isbn: b.isbn, title: b.title, copies: b.copies })).sort((a, b) => cmp(a.isbn, b.isbn));
    const loans = this.loanList.map((l) => ({ isbn: l.isbn, member: l.member, day: l.day })).sort((a, b) => cmp(a.isbn, b.isbn) || cmp(a.member, b.member));
    const holds = {};
    for (const k of [...this.holdQ.keys()].sort()) if (this.holdQ.get(k).length) holds[k] = [...this.holdQ.get(k)];
    const fines = {};
    for (const k of [...this.owed.keys()].sort()) if (this.owed.get(k) > 0) fines[k] = this.owed.get(k);
    return { books, loans, holds, fines };
  }

  static fromJSON(data) {
    const lib = new Library();
    for (const b of data.books || []) lib.books.set(b.isbn, { isbn: b.isbn, title: b.title, copies: b.copies });
    lib.loanList = (data.loans || []).map((l) => ({ isbn: l.isbn, member: l.member, day: l.day }));
    for (const [k, v] of Object.entries(data.holds || {})) lib.holdQ.set(k, [...v]);
    for (const [k, v] of Object.entries(data.fines || {})) lib.owed.set(k, v);
    return lib;
  }

  search(text) {
    const t = String(text).toLowerCase();
    return [...this.books.values()].filter((b) => b.title.toLowerCase().includes(t))
      .sort((a, b) => cmp(a.title, b.title) || cmp(a.isbn, b.isbn)).map((b) => b.isbn);
  }

  removeBook(isbn) {
    if (!this.books.has(isbn)) return false;
    if (this._onLoan(isbn) > 0) throw new Error(isbn + ' has copies on loan');
    if (this.holds(isbn).length) throw new Error(isbn + ' has holds');
    this.books.delete(isbn);
    this.holdQ.delete(isbn);
    return true;
  }
}

module.exports = { Library };
