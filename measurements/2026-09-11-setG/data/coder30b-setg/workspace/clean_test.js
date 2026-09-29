// Create a simple test for overdueLines without loading the problematic library tests
const { Library } = require('./s1_library.js');

// Create a mock library class with just the methods we need
class MockLibrary {
  constructor() {
    this.books = new Map();
    this.members = new Map();
    this.loans = new Map();
  }
  
  addBook(isbn, title, copies) {
    this.books.set(isbn, { title, copies, loans: new Set() });
  }
  
  addMember(member) {
    this.members.set(member, true);
  }
  
  checkout(member, isbn) {
    if (!this.books.has(isbn)) {
      throw new Error(`Book ${isbn} not found`);
    }
    const book = this.books.get(isbn);
    if (book.loans.size >= book.copies) {
      throw new Error(`No copies available for ${isbn}`);
    }
    book.loans.add(member);
    if (!this.loans.has(member)) {
      this.loans.set(member, new Set());
    }
    this.loans.get(member).add(isbn);
  }
  
  overdue(today) {
    // Return mock overdue items for testing
    const result = [];
    // Add some mock overdue items
    if (this.books.has("978-0134685991")) {
      result.push({ member: "Alice", isbn: "978-0134685991", days: 15 });
    }
    if (this.books.has("978-0201633610")) {
      result.push({ member: "Bob", isbn: "978-0201633610", days: 20 });
    }
    return result;
  }
}

// Import our function
const { overdueLines } = require('./s10_desk.js');

// Test with mock data
const mockLibrary = new MockLibrary();
mockLibrary.addBook("978-0134685991", "Effective Java", 3);
mockLibrary.addBook("978-0201633610", "Design Patterns", 1);
mockLibrary.addMember("Alice");
mockLibrary.addMember("Bob");

// Test the overdueLines function
const today = new Date("2023-01-01");
const lines = overdueLines(mockLibrary, today);
console.log("Test result:");
console.log(lines);