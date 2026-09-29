class Library {
  constructor() {
    this.books = {};
    this.members = {};
    this.holds = {};
  }

  addBook(isbn, copies) {
    if (!this.books[isbn]) {
      this.books[isbn] = { copies: copies, available: copies };
    } else {
      this.books[isbn].copies += copies;
      this.books[isbn].available += copies;
    }
  }

  addMember(memberId) {
    if (!this.members[memberId]) {
      this.members[memberId] = { books: [] };
    }
  }

  borrowBook(isbn, memberId) {
    if (this.books[isbn] && this.books[isbn].available > 0) {
      this.books[isbn].available--;
      this.members[memberId].books.push(isbn);
      return true;
    }
    return false;
  }

  returnBook(isbn, memberId) {
    if (this.books[isbn] && this.members[memberId].books.includes(isbn)) {
      this.books[isbn].available++;
      this.members[memberId].books = this.members[memberId].books.filter(book => book !== isbn);
      this._processHolds(isbn);
      return true;
    }
    return false;
  }

  placeHold(isbn, memberId) {
    if (this.books[isbn] && this.books[isbn].available > 0) {
      throw new Error("A copy is available.");
    }
    if (this.members[memberId].books.includes(isbn)) {
      throw new Error("The member already has this book.");
    }
    if (!this.holds[isbn]) {
      this.holds[isbn] = [];
    }
    if (!this.holds[isbn].includes(memberId)) {
      this.holds[isbn].push(memberId);
    } else {
      throw new Error("The member already holds this book.");
    }
  }

  holds(isbn) {
    return this.holds[isbn] || [];
  }

  _processHolds(isbn) {
    if (this.holds[isbn] && this.holds[isbn].length > 0) {
      const nextMember = this.holds[isbn].shift();
      this.borrowBook(isbn, nextMember);
      this.books[isbn].copies += copies;
    }
  }

  copies(isbn) {
    return this.books[isbn] ? this.books[isbn].copies : 0;
  }

  available(isbn) {
    if (!this.books[isbn]) {
      throw new Error('Unknown ISBN');
    }
    return this.books[isbn].copies - (this.books[isbn].onLoan || 0);
  }

  checkout(isbn, member, day = 0) {
    if (!this.books[isbn]) {
      throw new Error('Unknown ISBN');
    }
    if (this.available(isbn) === 0) {
      throw new Error('No copy available');
    }
    if (!this.books[isbn].members) {
      this.books[isbn].members = {};
    }
    if (this.books[isbn].members[member]) {
      throw new Error('Member already has this book');
    }
    if (!this.books[isbn].onLoan) {
      this.books[isbn].onLoan = 0;
    }
    this.books[isbn].onLoan++;
    this.books[isbn].members[member] = true;
  }

  titles() {
    return Object.values(this.books).map(book => book.title).sort();
  }

  loans(member) {
    return Object.keys(this.books)
      .filter(isbn => this.books[isbn].members && this.books[isbn].members[member])
      .sort();
  }

  returnBook(isbn, member, day = 0) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    const daysLate = Math.max(0, day - (checkoutDay + 14));
    const fine = daysLate * 25;
    delete this.books[isbn].members[member];
    this.books[isbn].onLoan--;
    if (!this.members[member].unpaidFines) {
      this.members[member].unpaidFines = 0;
    }
    this.members[member].unpaidFines += fine;
    return fine;
  }

module.exports = Library;
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
  dueDay(isbn, member) {
    if (!this.books[isbn] || !this.books[isbn].members || !this.books[isbn].members[member]) {
      throw new Error('Member does not have this book');
    }
    const checkoutDay = this.books[isbn].members[member].checkoutDay;
    return checkoutDay + 14;
  }
