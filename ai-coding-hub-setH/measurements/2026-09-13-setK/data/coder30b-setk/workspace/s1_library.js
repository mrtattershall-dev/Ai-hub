// Library class implementation
class Library {
  constructor() {
    this.books = new Map();
    this.checkedOut = new Map(); // Track which member has which book
    this.holds = new Map(); // Track holds: isbn -> array of members waiting
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
      // Add new book
      this.books.set(isbn, { title, copies });
    }
  }
  
  copies(isbn) {
    const book = this.books.get(isbn);
    return book ? book.copies : 0;
  }
  
  titles() {
    // Get all titles and sort alphabetically
    const titles = Array.from(this.books.values()).map(book => book.title);
    return titles.sort();
  }
  
  available(isbn) {
    const book = this.books.get(isbn);
    if (!book) return 0;
    
    // Count how many copies are currently checked out
    let checkedOutCount = 0;
    for (const [member, books] of this.checkedOut.entries()) {
      if (books.has(isbn)) {
        checkedOutCount += books.get(isbn) || 0;
      }
    }
    return book.copies - checkedOutCount;
  }
  
    checkout(isbn, member) {
      // Validate ISBN exists
      const book = this.books.get(isbn);
      if (!book) {
        throw new Error(`Book with ISBN ${isbn} not found`);
      }
    
      // Check if any copies are available
      if (this.available(isbn) <= 0) {
        throw new Error(`No copies of book ${isbn} available`);
      }
    
      // Check if member already has this book
      if (this.checkedOut.has(member)) {
        const memberBooks = this.checkedOut.get(member);
        if (memberBooks.has(isbn)) {
          throw new Error(`Member ${member} already has book ${isbn}`);
        }
      }
    
      // Perform checkout
      if (!this.checkedOut.has(member)) {
        this.checkedOut.set(member, new Map());
      }
      const memberBooks = this.checkedOut.get(member);
      if (memberBooks.has(isbn)) {
        memberBooks.set(isbn, memberBooks.get(isbn) + 1);
      } else {
        memberBooks.set(isbn, 1);
      }
    }
  
        returnBook(isbn, member) {
      // Check if member has this book
      if (!this.checkedOut.has(member)) {
        throw new Error(`Member ${member} has no books checked out`);
      }
    
      const memberBooks = this.checkedOut.get(member);
      if (!memberBooks.has(isbn)) {
        throw new Error(`Member ${member} does not have book ${isbn} checked out`);
      }
    
      // Return the book (remove from checkedOut)
      memberBooks.delete(isbn);
    
      // If member has no books checked out anymore, remove them from checkedOut
      if (memberBooks.size === 0) {
        this.checkedOut.delete(member);
      }
      
      // Check if there are members waiting in the hold queue
      if (this.holds.has(isbn) && this.holds.get(isbn).length > 0) {
        // Get the first member in the hold queue
        const nextMember = this.holds.get(isbn).shift();
        
        // Check if this member already has this book (shouldn't happen, but just in case)
        if (!this.checkedOut.has(nextMember)) {
          this.checkedOut.set(nextMember, new Map());
        }
        const nextMemberBooks = this.checkedOut.get(nextMember);
        nextMemberBooks.set(isbn, 1);
      }
    }
  
        loans(member) {
      // Check if member exists in checkedOut
      if (!this.checkedOut.has(member)) {
        return [];
      }
    
      // Return sorted list of ISBNs that this member has checked out
      const memberBooks = this.checkedOut.get(member);
      return Array.from(memberBooks.keys()).sort();
    }
    
    placeHold(isbn, member) {
      // Validate ISBN exists
      const book = this.books.get(isbn);
      if (!book) {
        throw new Error(`Book with ISBN ${isbn} not found`);
      }
      
      // Check if any copies are available
      if (this.available(isbn) > 0) {
        throw new Error(`Book ${isbn} has available copies`);
      }
      
      // Check if member already has this book
      if (this.checkedOut.has(member)) {
        const memberBooks = this.checkedOut.get(member);
        if (memberBooks.has(isbn)) {
          throw new Error(`Member ${member} already has book ${isbn}`);
        }
      }
      
      // Check if member already has a hold on this book
      if (this.holds.has(isbn)) {
        const holdQueue = this.holds.get(isbn);
        if (holdQueue.includes(member)) {
          throw new Error(`Member ${member} already holds book ${isbn}`);
        }
      }
      
      // Add member to hold queue
      if (!this.holds.has(isbn)) {
        this.holds.set(isbn, []);
      }
      this.holds.get(isbn).push(member);
    }
    
    holds(isbn) {
      // Return the queue of members waiting for this book
      if (!this.holds.has(isbn)) {
        return [];
      }
      return [...this.holds.get(isbn)]; // Return a copy of the array
    }
  }

// Export the Library class
module.exports = { Library };
