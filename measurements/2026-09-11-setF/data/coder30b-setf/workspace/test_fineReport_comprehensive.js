const { Library } = require('./s1_library.js');
const { fineReport } = require('./s10_desk.js');

// Create a test library
const library = new Library();

// Add some books
library.addBook("978-0-123456-78-9", "The Great Gatsby", 3);
library.addBook("978-0-987654-32-1", "1984");
library.addBook("978-0-111111-11-1", "Animal Farm", 1);

// Add some members
const members = ["Alice", "Bob", "Charlie"];

// Let's manually create some test data to verify the function works
// Since we can't easily create loans with fines through the public API,
// let's directly test the function with mock data that simulates what it would receive

// Mock library with specific getLoans and getFine methods for testing
const mockLibrary = {
  getLoans: function(member) {
    // Return mock loans for testing
    if (member === "Alice") {
      return [
        { book: "978-0-123456-78-9", dueDate: new Date("2023-01-01") },
        { book: "978-0-987654-32-1", dueDate: new Date("2023-01-01") }
      ];
    } else if (member === "Bob") {
      return [
        { book: "978-0-111111-11-1", dueDate: new Date("2023-01-01") }
      ];
    } else {
      return [];
    }
  },
  getFine: function(loan, member) {
    // Return mock fines
    if (member === "Alice" && loan.book === "978-0-123456-78-9") {
      return 5.50;
    } else if (member === "Alice" && loan.book === "978-0-987654-32-1") {
      return 3.25;
    } else if (member === "Bob" && loan.book === "978-0-111111-11-1") {
      return 7.00;
    }
    return 0;
  }
};

console.log("Testing fineReport function with mock data:");

// Test with members who have fines
const result = fineReport(mockLibrary, members);
console.log("Result:");
console.log(result);

// Test with empty members list
console.log("\nEmpty members:");
console.log(JSON.stringify(fineReport(mockLibrary, [])));

// Test with members who have no fines
console.log("\nMembers with no fines:");
console.log(JSON.stringify(fineReport(mockLibrary, ["David", "Eve"])));