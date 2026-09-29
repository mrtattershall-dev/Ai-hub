// Test file for Library class
const { Library } = require('./s1_library.js');

// Test 1: Add a book and check copies
const library = new Library();
library.addBook("978-0-123456-78-9", "JavaScript Guide", 3);
console.assert(library.copies("978-0-123456-78-9") === 3, "Should have 3 copies");

// Test 2: Add more copies of existing book
library.addBook("978-0-123456-78-9", "JavaScript Guide", 2);
console.assert(library.copies("978-0-123456-78-9") === 5, "Should have 5 copies after adding 2 more");

// Test 3: Add a new book with different ISBN
library.addBook("978-0-987654-32-1", "Python Guide", 1);
console.assert(library.copies("978-0-987654-32-1") === 1, "Should have 1 copy");

// Test 4: Check titles are sorted alphabetically
const titles = library.titles();
console.assert(titles[0] === "JavaScript Guide" && titles[1] === "Python Guide", "Titles should be sorted alphabetically");

// Test 5: Check copies for unknown ISBN
console.assert(library.copies("unknown-isbn") === 0, "Should return 0 for unknown ISBN");

// Test 6: Error handling for invalid copies
try {
  library.addBook("978-0-111111-11-1", "Test Book", 0);
  console.assert(false, "Should have thrown an error for 0 copies");
} catch (e) {
  console.assert(e.message === "copies must be a positive integer", "Should throw correct error message");
}

try {
  library.addBook("978-0-111111-11-1", "Test Book", -1);
  console.assert(false, "Should have thrown an error for negative copies");
} catch (e) {
  console.assert(e.message === "copies must be a positive integer", "Should throw correct error message");
}

try {
  library.addBook("978-0-111111-11-1", "Test Book", 1.5);
  console.assert(false, "Should have thrown an error for fractional copies");
} catch (e) {
  console.assert(e.message === "copies must be a positive integer", "Should throw correct error message");
}

// Test 7: Test available method
console.assert(library.available("978-0-123456-78-9") === 5, "Should have 5 available copies");

// Test 8: Checkout a book
library.checkout("978-0-123456-78-9", "Alice");
console.assert(library.available("978-0-123456-78-9") === 4, "Should have 4 available copies after checkout");

// Test 9: Checkout same book to different member
library.checkout("978-0-123456-78-9", "Bob");
console.assert(library.available("978-0-123456-78-9") === 3, "Should have 3 available copies after second checkout");

// Test 10: Test checkout error - unknown ISBN
try {
  library.checkout("unknown-isbn", "Charlie");
  console.assert(false, "Should have thrown an error for unknown ISBN");
} catch (e) {
  console.assert(e.message === "Unknown ISBN", "Should throw correct error message");
}

// Test 11: Test checkout error - no copies available
const library2 = new Library();
library2.addBook("978-0-111111-11-1", "Test Book", 1);
library2.checkout("978-0-111111-11-1", "Alice");
try {
  library2.checkout("978-0-111111-11-1", "Bob");
  console.assert(false, "Should have thrown an error when no copies available");
} catch (e) {
  console.assert(e.message === "No copies available", "Should throw correct error message");
}

// Test 12: Test checkout error - member already has book
const library3 = new Library();
library3.addBook("978-0-222222-22-2", "Another Test Book", 2);
library3.checkout("978-0-222222-22-2", "Alice");
try {
  library3.checkout("978-0-222222-22-2", "Alice");
  console.assert(false, "Should have thrown an error when member already has book");
} catch (e) {
  console.assert(e.message === "Member already has this book", "Should throw correct error message");
}

// Test 13: Test available for unknown ISBN
console.assert(library.available("unknown-isbn") === 0, "Should return 0 for unknown ISBN");

console.log("All asserts passed!");