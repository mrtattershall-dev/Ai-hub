// CANONICAL REFERENCE - cumulative correct state after setH goals 1-60 for this file.
// Goals 61+ are HELD OUT and deliberately not implemented.
//
//   goal  1  addBook(isbn, title, copies = 1), copies(isbn), titles()
//   goal 11  checkout(isbn, member), available(isbn)
//   goal 21  returnBook(isbn, member), loans(member)
//   goal 31  placeHold(isbn, member), holds(isbn); a returned copy goes to the queue head
//   goal 41  checkout/returnBook take a day number; a loan is due 14 days after it starts; a hold
//            that becomes a loan starts on the day of that return; dueDay(isbn, member);
//            overdue(today) sorted by daysLate desc, then isbn, then member
//   goal 51  returnBook returns the fine in cents (25/day late, 0 when on time) and adds it to the
//            member's unpaid total; fines(member); pay(member, cents)
const LOAN_DAYS = 14;
const FINE_PER_DAY_CENTS = 25;

class Library {
  constructor() {
    this.books = new Map();        // isbn -> { title, copies }
    this.loansByIsbn = new Map();  // isbn -> Map(member -> startDay)
    this.queues = new Map();       // isbn -> [member]
    this.unpaid = new Map();       // member -> cents
  }

  addBook(isbn, title, copies = 1) {
    if (!Number.isInteger(copies) || copies <= 0) throw new Error('copies must be a positive integer');
    const existing = this.books.get(isbn);
    if (existing) existing.copies += copies;
    else this.books.set(isbn, { title, copies });
  }

  copies(isbn) {
    const b = this.books.get(isbn);
    return b ? b.copies : 0;
  }

  titles() {
    return [...this.books.values()].map((b) => b.title).sort();
  }

  available(isbn) {
    const out = this.loansByIsbn.get(isbn);
    return this.copies(isbn) - (out ? out.size : 0);
  }

  checkout(isbn, member, day = 0) {
    if (!Number.isInteger(day)) throw new Error('day must be an integer');
    if (!this.books.has(isbn)) throw new Error('unknown isbn');
    const out = this.loansByIsbn.get(isbn) || new Map();
    if (out.has(member)) throw new Error('member already has that book');
    if (this.available(isbn) <= 0) throw new Error('no copy available');
    out.set(member, day);
    this.loansByIsbn.set(isbn, out);
  }

  // goal 51: returns the fine in cents for this loan, and records it as unpaid.
  returnBook(isbn, member, day = 0) {
    if (!Number.isInteger(day)) throw new Error('day must be an integer');
    const out = this.loansByIsbn.get(isbn);
    if (!out || !out.has(member)) throw new Error('member does not have that book');
    const started = out.get(member);
    const late = Math.max(0, day - (started + LOAN_DAYS));
    const fine = late * FINE_PER_DAY_CENTS;
    if (fine > 0) this.unpaid.set(member, (this.unpaid.get(member) || 0) + fine);
    out.delete(member);
    // goal 31 + 41: the queue head becomes a loan starting on the day of this return.
    const q = this.queues.get(isbn);
    if (q && q.length) out.set(q.shift(), day);
    this.loansByIsbn.set(isbn, out);
    return fine;
  }

  loans(member) {
    const out = [];
    for (const [isbn, members] of this.loansByIsbn) if (members.has(member)) out.push(isbn);
    return out.sort();
  }

  placeHold(isbn, member) {
    if (!this.books.has(isbn)) throw new Error('unknown isbn');
    if (this.available(isbn) > 0) throw new Error('a copy is available');
    const out = this.loansByIsbn.get(isbn);
    if (out && out.has(member)) throw new Error('member already has that book');
    const q = this.queues.get(isbn) || [];
    if (q.includes(member)) throw new Error('member already holds that book');
    q.push(member);
    this.queues.set(isbn, q);
  }

  holds(isbn) {
    return [...(this.queues.get(isbn) || [])];
  }

  dueDay(isbn, member) {
    const out = this.loansByIsbn.get(isbn);
    if (!out || !out.has(member)) throw new Error('member does not have that book');
    return out.get(member) + LOAN_DAYS;
  }

  overdue(today) {
    if (!Number.isInteger(today)) throw new Error('today must be an integer');
    const rows = [];
    for (const [isbn, members] of this.loansByIsbn) {
      for (const [member, started] of members) {
        const daysLate = today - (started + LOAN_DAYS);
        if (daysLate > 0) rows.push({ isbn, member, daysLate });
      }
    }
    rows.sort((a, b) => (b.daysLate - a.daysLate)
      || (a.isbn < b.isbn ? -1 : a.isbn > b.isbn ? 1 : 0)
      || (a.member < b.member ? -1 : a.member > b.member ? 1 : 0));
    return rows;
  }

  fines(member) {
    return this.unpaid.get(member) || 0;
  }

  pay(member, cents) {
    if (!Number.isInteger(cents) || cents <= 0) throw new Error('amount must be a positive integer');
    const owed = this.fines(member);
    if (cents > owed) throw new Error('more than is owed');
    this.unpaid.set(member, owed - cents);
    return owed - cents;
  }
}

module.exports = { Library };
