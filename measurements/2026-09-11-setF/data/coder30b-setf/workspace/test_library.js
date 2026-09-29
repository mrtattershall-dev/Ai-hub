const { Library } = require('./s1_library');

// Test search method
console.log("Testing search method...");

const library = new Library();

// Add some test books
library.addBook("978-0-123456-78-9", "The Great Gatsby", 2);
library.addBook("978-0-987654-32-1", "To Kill a Mockingbird", 1);
library.addBook("978-0-111111-22-3", "1984", 3);
library.addBook("978-0-333333-44-5", "Pride and Prejudice", 1);
library.addBook("978-0-555555-66-7", "The Catcher in the Rye", 2);

// Test search for "the" (case insensitive)
let results = library.search("the");
console.log("Search results for 'the':", results);
console.assert(results.length === 3, "Should find 3 books with 'the' in title");
console.assert(results[0] === "978-0-123456-78-9", "First should be The Great Gatsby");
console.assert(results[1] === "978-0-555555-66-7", "Second should be The Catcher in the Rye");
console.assert(results[2] === "978-0-987654-32-1", "Third should be To Kill a Mockingbird");

// Test search for "pride"
results = library.search("pride");
console.log("Search results for 'pride':", results);
console.assert(results.length === 1, "Should find 1 book with 'pride' in title");
console.assert(results[0] === "978-0-333333-44-5", "Should be Pride and Prejudice");

// Test search for non-existent term
results = library.search("xyz");
console.log("Search results for 'xyz':", results);
console.assert(results.length === 0, "Should find 0 books with 'xyz' in title");

// Test removeBook method
console.log("\nTesting removeBook method...");

// Test removing a book that doesn't exist
let result = library.removeBook("978-0-999999-99-9");
console.log("Remove non-existent book result:", result);
console.assert(result === false, "Should return false for non-existent book");

// Test removing a book with copies on loan (should fail)
try {
  library.checkout("978-0-123456-78-9", "member1");
  result = library.removeBook("978-0-123456-78-9");
  console.assert(false, "Should have thrown an error when trying to remove book with copies on loan");
} catch (e) {
  console.log("Correctly threw error when removing book with copies on loan:", e.message);
  console.assert(e.message.includes("copies are currently on loan"), "Should mention copies on loan");
}

// Test removing a book with holds (should fail)
try {
  library.placeHold("978-0-111111-22-3", "member2");
  result = library.removeBook("978-0-111111-22-3");
  console.assert(false, "Should have thrown an error when trying to remove book with holds");
} catch (e) {
  console.log("Correctly threw error when removing book with holds:", e.message);
  console.assert(e.message.includes("book has holds"), "Should mention book has holds");
}

// Test removing a book that's available (should succeed)
library.returnBook("978-0-123456-78-9", "member1"); // Return the book
library.removeBook("978-0-123456-78-9");
console.log("Successfully removed book with ISBN 978-0-123456-78-9");
console.assert(!library.books.has("978-0-123456-78-9"), "Book should be removed from library");

// Test that the book is actually removed from the library
results = library.search("gatsby");
console.log("Search results after removing Gatsby:", results);
console.assert(results.length === 0, "Should find 0 books after removing Gatsby");

console.log("\nAll tests passed!");