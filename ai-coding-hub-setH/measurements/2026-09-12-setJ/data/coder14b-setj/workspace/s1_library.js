class Library {
  constructor() {
    this.books = {};
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
  }

  copies(isbn) {
    return this.books[isbn] ? this.books[isbn].copies : 0;
  }

  titles() {
    return Object.values(this.books).map(book => book.title).sort((a, b) => a.localeCompare(b));
  }
}

module.exports = Library;