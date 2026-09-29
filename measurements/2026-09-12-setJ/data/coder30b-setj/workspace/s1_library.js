// Library class implementation
class Library {
  constructor() {
    this.books = new Map();
    this.loans = new Map(); // Track which members have which books
  }
  
  addBook(isbn, title, copies = 1) {
    // Validate copies parameter
    if (!Number.isInteger(copies) || copies <= 0) {
      throw new Error("copies must be a positive integer");
    }
    
    // If ISBN already exists, add to existing copies
    if (this.books.has(isbn)) {
      const existingBook = this.books.get(isbn);
      existingBook.copies += copies;
    } else {
      // Add new book with given title and copies
      this.books.set(isbn, { title, copies });
    }
  }
  
  copies(isbn) {
    const book = this.books.get(isbn);
    return book ? book.copies : 0;
  }
  
  available(isbn) {
    const book = this.books.get(isbn);
    if (!book) {
      return 0;
    }
    
    // Count how many copies are currently on loan
    let onLoan = 0;
    for (const [member, loans] of this.loans.entries()) {
      if (loans.has(isbn)) {
        onLoan += loans.get(isbn);
      }
    }
    
    return book.copies - onLoan;
  }
  
  checkout(isbn, member) {
    // Check if ISBN exists
    const book = this.books.get(isbn);
    if (!book) {
      throw new Error("Unknown ISBN");
    }
    
    // Check if any copies are available
    if (this.available(isbn) <= 0) {
      throw new Error("No copies available");
    }
    
    // Check if member already has this book
    if (this.loans.has(member)) {
      const memberLoans = this.loans.get(member);
      if (memberLoans.has(isbn)) {
        throw new Error("Member already has this book");
      }
    }
    
    // Perform the checkout
    if (!this.loans.has(member)) {
      this.loans.set(member, new Map());
    }
    
    const memberLoans = this.loans.get(member);
    if (memberLoans.has(isbn)) {
      memberLoans.set(isbn, memberLoans.get(isbn) + 1);
    } else {
      memberLoans.set(isbn, 1);
    }
  }
  
  titles() {
    // Get all titles and sort alphabetically
    const titles = Array.from(this.books.values()).map(book => book.title);
    return titles.sort();
  }
}

// Export the Library class
module.exports = { Library };