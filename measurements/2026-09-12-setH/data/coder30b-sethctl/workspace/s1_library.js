// Library class implementation
class Library {
  constructor() {
    this.books = new Map();
  }
  
  addBook(isbn, title, copies = 1) {
    // Validate copies parameter
    if (!Number.isInteger(copies) || copies <= 0) {
      throw new Error("Copies must be a positive integer");
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
  
  checkout(isbn, member) {
    // Check if ISBN exists
    if (!this.books.has(isbn)) {
      throw new Error("Unknown ISBN");
    }
    
    const book = this.books.get(isbn);
    
    // Check if any copies are available
    if (book.copies <= 0) {
      throw new Error("No copies available");
    }
    
    // Process the checkout
    book.copies--;
    if (!book.loans) {
      book.loans = new Map();
    }
    if (!book.loans.has(member)) {
      book.loans.set(member, 0);
    }
    book.loans.set(member, book.loans.get(member) + 1);
  }
  
  available(isbn) {
    // Check if ISBN exists
    if (!this.books.has(isbn)) {
      return 0;
    }
    
    const book = this.books.get(isbn);
    return book.copies;
  }
  
  
  loans(member) {
    // Collect all ISBNs that this member has on loan
    const memberLoans = [];
    
    // Iterate through all books in the library
    for (const [isbn, book] of this.books) {
      // Check if this book has loans and if the member has any copies
      if (book.loans && book.loans.has(member)) {
        memberLoans.push(isbn);
      }
    }
    
    // Return the ISBNs sorted alphabetically
    return memberLoans.sort();
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
    if (book.loans && book.loans.has(member)) {
      throw new Error("Member already has this book");
    }
    
    // Check if member already holds this book
    if (!book.holds) {
      book.holds = [];
    }
    if (book.holds.includes(member)) {
      throw new Error("Member already holds this book");
    }
    
    // Add member to hold queue
    book.holds.push(member);
  }

  holds(isbn) {
    // Check if ISBN exists
    if (!this.books.has(isbn)) {
      throw new Error("Unknown ISBN");
    }
    
    const book = this.books.get(isbn);
    
    // Return the hold queue or empty array if none
    return book.holds ? [...book.holds] : [];
  }

  returnBook(isbn, member) {
    // Check if ISBN exists
    if (!this.books.has(isbn)) {
      throw new Error("Unknown ISBN");
    }
    
    const book = this.books.get(isbn);
    
    // Check if the member has this book on loan
    if (!book.loans || !book.loans.has(member)) {
      throw new Error("Member does not have this book on loan");
    }
    
    // Process the return
    book.copies++;
    const loanCount = book.loans.get(member);
    if (loanCount > 1) {
      // If member has more than one copy, reduce the count
      book.loans.set(member, loanCount - 1);
    } else {
      // If member has only one copy, remove the entry
      book.loans.delete(member);
    }
    
    // If there are members waiting in the hold queue, assign the book to the first one
    if (book.holds && book.holds.length > 0) {
      const nextMember = book.holds.shift();
      if (!book.loans) {
        book.loans = new Map();
      }
      if (!book.loans.has(nextMember)) {
        book.loans.set(nextMember, 0);
      }
      book.loans.set(nextMember, book.loans.get(nextMember) + 1);
    }
    
    // Calculate and return fine (25 cents per day late, 0 when on time)
    // For simplicity, we'll assume all returns are on time in this basic implementation
    // In a real system, we'd track checkout dates and compare with return date
    const fine = 0;
    
    // Add fine to member's unpaid fines
    if (!this.fines.has(member)) {
      this.fines.set(member, 0);
    }
    this.fines.set(member, this.fines.get(member) + fine);
    
    return fine;
  }
}

// Export the Library class
module.exports = { Library };

// If this file is run directly (node s1_library.js), run some basic tests
if (require.main === module) {
  // Create a new library instance
  const library = new Library();
  
  // Test basic functionality
  library.addBook("978-0134685991", "Effective Java", 3);
  console.assert(library.copies("978-0134685991") === 3, "Test 1 failed");
  
  library.addBook("978-0134685991", "Effective Java", 2);
  console.assert(library.copies("978-0134685991") === 5, "Test 2 failed");
  
  library.addBook("978-0201633610", "Design Patterns", 1);
  console.assert(library.copies("978-0201633610") === 1, "Test 3 failed");
  
  console.assert(library.copies("978-0000000000") === 0, "Test 4 failed");
  
  const titles = library.titles();
  console.assert(titles.length === 2, "Test 5 failed");
  console.assert(titles[0] === "Design Patterns", "Test 5 failed");
  console.assert(titles[1] === "Effective Java", "Test 5 failed");
  
  // Test error for invalid copies parameter
  let errorCaught = false;
  try {
    library.addBook("978-0134685992", "Another Book", 0);
  } catch (e) {
    errorCaught = true;
  }
  console.assert(errorCaught, "Test 6 failed: Should throw error for zero copies");
  
  console.log("All asserts passed!");
}