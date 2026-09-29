class Library {
  constructor() {
    this.books = {};
  }

  checkout(isbn, member, day = 0) {
    if (!this.books[isbn]) {
      this.books[isbn] = {};
    }
    this.books[isbn][member] = { checkoutDay: day, dueDay: day + 14 };
  }

  returnBook(isbn, member) {
    if (this.books[isbn] && this.books[isbn][member]) {
      delete this.books[isbn][member];
    }
  }

  dueDay(isbn, member) {
    if (this.books[isbn] && this.books[isbn][member]) {
      return this.books[isbn][member].dueDay;
    }
    return null;
  }

  overdue(today) {
    const overdueLoans = [];
    for (const isbn in this.books) {
      for (const member in this.books[isbn]) {
        const { dueDay } = this.books[isbn][member];
        if (dueDay < today) {
          overdueLoans.push({ isbn, member, daysLate: today - dueDay });
        }
      }
    }
    overdueLoans.sort((a, b) => {
      if (b.daysLate !== a.daysLate) return b.daysLate - a.daysLate;
      if (a.isbn !== b.isbn) return a.isbn.localeCompare(b.isbn);
      return a.member.localeCompare(b.member);
    });
    return overdueLoans;
  }
}
  constructor() {
    this.books = {};
    this.members = {};
  }

  addBook(isbn, title, copies = 1) {
    if (typeof copies !== 'number' || copies <= 0) {
      throw new Error('Copies must be a positive integer');
    }
    if (!this.books[isbn]) {
      this.books[isbn] = { title, copies };
    } else {
      this.books[isbn].copies += copies;
    }
  loans(member) {
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }
    return this.members[member].loans.sort();
  }

  copies(isbn) {
    return this.books[isbn] ? this.books[isbn].copies : 0;
  }

  titles() {
    return Object.values(this.books).map(book => book.title).sort();
  }
}

module.exports = Library;