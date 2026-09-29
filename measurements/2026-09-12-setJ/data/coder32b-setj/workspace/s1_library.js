class Library {
    constructor() {
        this.books = {};
    }

    addBook(isbn, title, copies = 1) {
        if (typeof copies !== 'number' || copies <= 0) {
            throw new Error('Copies must be a positive integer');
        }
        if (this.books[isbn]) {
            this.books[isbn].copies += copies;
        } else {
            this.books[isbn] = { title, copies };
        }
    }

    copies(isbn) {
        return this.books[isbn] ? this.books[isbn].copies : 0;
    }

    titles() {
        return Object.values(this.books).map(book => book.title).sort();
    }

    available(isbn) {
        const book = this.books[isbn];
        if (!book) {
            return 0;
        }
        return book.copies - (book.onLoan || 0);
    }

    checkout(isbn, member) {
        const book = this.books[isbn];
        if (!book) {
            throw new Error('Unknown ISBN');
        }
        if (this.available(isbn) <= 0) {
            throw new Error('No copies available');
        }
        if (!book.loanedTo) {
            book.loanedTo = {};
        }
        if (book.loanedTo[member]) {
            throw new Error('Member already has this book');
        }
        if (!book.onLoan) {
            book.onLoan = 0;
        }
        book.onLoan++;
        book.loanedTo[member] = true;
    }
}

module.exports = Library;