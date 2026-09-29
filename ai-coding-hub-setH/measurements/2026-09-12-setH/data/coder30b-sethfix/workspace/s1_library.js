// Library class implementation
class Library {
  constructor() {
    this.books = new Map();
    this._loans = new Map(); // Track which members have which books
    this._holds = new Map(); // Track hold queues for each ISBN
    this._fines = new Map(); // Track unpaid fines per member
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
  
  checkout(isbn, member, day = 0) {
    // Check if ISBN exists
    if (!this.books.has(isbn)) {
      throw new Error("Unknown ISBN");
    }
    
    const book = this.books.get(isbn);
    
    // Check if any copies are available
    if (book.copies <= 0) {
      throw new Error("No copies available");
    }
    
    // Check if member already has this book
    if (!this._loans.has(member)) {
      this._loans.set(member, new Set());
    }
    
    const memberLoans = this._loans.get(member);
    if (memberLoans.has(isbn)) {
      throw new Error("Member already has this book");
    }
    
    // All validations passed - checkout the book
    book.copies -= 1;
    memberLoans.add(isbn);
    
    // Store the checkout day for due date calculation
    if (!this._loanDays) {
      this._loanDays = new Map();
    }
    this._loanDays.set(`${member}-${isbn}`, day);
  }
  
  available(isbn) {
    const book = this.books.get(isbn);
    if (!book) {
      return 0;
    }
    // Available copies = total copies - copies on loan
    // We need to track the original copies count separately
    // Let's store the original copies count in a separate property
    const totalCopies = book.copies + this._getCopiesOnLoan(isbn);
    const copiesOnLoan = this._getCopiesOnLoan(isbn);
    return totalCopies - copiesOnLoan;
  }
  
  _getCopiesOnLoan(isbn) {
    let copiesOnLoan = 0;
    for (const [member, loans] of this._loans.entries()) {
      if (loans.has(isbn)) {
        copiesOnLoan += 1;
      }
    }
    return copiesOnLoan;
  }
  
  titles() {
    // Get all titles and sort alphabetically
    const titles = Array.from(this.books.values()).map(book => book.title);
    return titles.sort();
  }
  
  returnBook(isbn, member, day = 0) {
    // Check if member has this book on loan
    if (!this._loans.has(member)) {
      throw new Error("Member has no loans");
    }
    
    const memberLoans = this._loans.get(member);
    if (!memberLoans.has(isbn)) {
      throw new Error("Member does not have this book");
    }
    
    // Calculate fine
    let fine = 0;
    if (this._loanDays) {
      const loanDay = this._loanDays.get(`${member}-${isbn}`);
      if (loanDay !== undefined) {
        const dueDay = loanDay + 14;
        const daysLate = day - dueDay;
        if (daysLate > 0) {
          fine = daysLate * 25; // 25 cents per day late
        }
      }
    }
    
    // Remove the book from member's loans
    memberLoans.delete(isbn);
    
    // Return the book copy to the library
    const book = this.books.get(isbn);
    if (book) {
      book.copies += 1;
    }
    
    // Add fine to member's unpaid fines
    if (!this._fines.has(member)) {
      this._fines.set(member, 0);
    }
    const currentFines = this._fines.get(member);
    this._fines.set(member, currentFines + fine);
    
    // Check if there are members waiting in the hold queue
    if (this._holds.has(isbn) && this._holds.get(isbn).length > 0) {
      // Get the first member in the hold queue
      const firstMember = this._holds.get(isbn).shift();
      
      // Loan the book to the first member in the queue
      if (!this._loans.has(firstMember)) {
        this._loans.set(firstMember, new Set());
      }
      
      const firstMemberLoans = this._loans.get(firstMember);
      firstMemberLoans.add(isbn);
      
      // Store the checkout day for due date calculation (hold becomes loan on return day)
      if (!this._loanDays) {
        this._loanDays = new Map();
      }
      this._loanDays.set(`${firstMember}-${isbn}`, day);
      
      // Decrease the available copies count
      book.copies -= 1;
    }
    
    // Return the fine in cents
    return fine;
  }
  
  loans(member) {
    // Check if member has any loans
    if (!this._loans.has(member)) {
      return [];
    }
    
    // Return sorted list of ISBNs
    const memberLoans = this._loans.get(member);
    return Array.from(memberLoans).sort();
  }

  placeHold(isbn, member) {
    // Check if ISBN exists
    if (!this.books.has(isbn)) {
      throw new Error("Unknown ISBN");
    }

    const book = this.books.get(isbn);
    
    // Check if any copies are available
    if (book.copies > 0) {
      throw new Error("Book is available");
    }
    
    // Check if member already has this book
    if (!this._loans.has(member)) {
      this._loans.set(member, new Set());
    }
    
    const memberLoans = this._loans.get(member);
    if (memberLoans.has(isbn)) {
      throw new Error("Member already has this book");
    }
    
    // Check if member already holds this book
    if (!this._holds.has(isbn)) {
      this._holds.set(isbn, []);
    }
    
    const holdQueue = this._holds.get(isbn);
    if (holdQueue.includes(member)) {
      throw new Error("Member already holds this book");
    }
    
    // Add member to hold queue
    holdQueue.push(member);
  }

  holds(isbn) {
    // Check if ISBN exists
    if (!this.books.has(isbn)) {
      throw new Error("Unknown ISBN");
    }
    
    // Return the hold queue for this ISBN
    if (!this._holds.has(isbn)) {
      return [];
    }
    
    return [...this._holds.get(isbn)];
  }

  dueDay(isbn, member) {
    if (!this._loanDays) {
      return null;
    }
    
    const loanDay = this._loanDays.get(`${member}-${isbn}`);
    if (loanDay === undefined) {
      return null;
    }
    
    return loanDay + 14;
  }

  overdue(today) {
    if (!this._loanDays) {
      return [];
    }
    
    const result = [];
    
    for (const [key, loanDay] of this._loanDays.entries()) {
      const [member, isbn] = key.split('-');
      // Skip if member or isbn is malformed
      if (!member || !isbn) continue;
      
      const dueDay = loanDay + 14;
      const daysLate = today - dueDay;
      
      if (daysLate > 0) {
        result.push({
          isbn: isbn,
          member: member,
          daysLate: daysLate
        });
      }
    }
    
    // Sort by daysLate (largest first), then isbn, then member
    result.sort((a, b) => {
      if (b.daysLate !== a.daysLate) {
        return b.daysLate - a.daysLate;
      }
      if (a.isbn !== b.isbn) {
        return a.isbn.localeCompare(b.isbn);
      }
      return a.member.localeCompare(b.member);
    });
    
    return result;
  }

  fines(member) {
    if (!this._fines.has(member)) {
      return 0;
    }
    return this._fines.get(member);
  }

  pay(member, cents) {
    if (cents <= 0) {
      throw new Error("Payment must be positive");
    }
    
    if (!this._fines.has(member)) {
      throw new Error("No fines to pay");
    }
    
    const currentFines = this._fines.get(member);
    if (cents > currentFines) {
      throw new Error("Payment exceeds outstanding fines");
    }
    
    this._fines.set(member, currentFines - cents);
  }
}

// Export the Library class
module.exports = { Library };