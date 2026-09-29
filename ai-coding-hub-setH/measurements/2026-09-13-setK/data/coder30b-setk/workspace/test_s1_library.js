const { Library } = require('./s1_library.js');
const assert = require('assert');

console.log("Testing returnBook and loans methods...");

// Create a new library for testing
const library = new Library();

// Add some test books
library.addBook("978-0134685991", "Effective Java", 3);
library.addBook("978-0596009205", "Head First Design Patterns", 2);
library.addBook("978-0201633610", "Design Patterns", 1);

// Test 1: loans() with no books checked out
let result = library.loans("Alice");
assert.deepStrictEqual(result, [], "Alice should have no loans initially");

// Test 2: Checkout some books
library.checkout("978-0134685991", "Alice");
library.checkout("978-0596009205", "Alice");

// Test 3: loans() with some books checked out
result = library.loans("Alice");
assert.deepStrictEqual(result, ["978-0134685991", "978-0596009205"], "Alice should have two books checked out");

// Test 4: Checkout another book for Bob
library.checkout("978-0201633610", "Bob");

// Test 5: loans() for Bob
result = library.loans("Bob");
assert.deepStrictEqual(result, ["978-0201633610"], "Bob should have one book checked out");

// Test 6: loans() for someone with no books
result = library.loans("Charlie");
assert.deepStrictEqual(result, [], "Charlie should have no loans");

// Test 7: returnBook() with valid parameters
library.returnBook("978-0134685991", "Alice");
result = library.loans("Alice");
assert.deepStrictEqual(result, ["978-0596009205"], "Alice should have one book checked out after returning one");

// Test 8: returnBook() with unknown member
assert.throws(() => {
  library.returnBook("978-0134685991", "Unknown");
}, Error, "Should throw error when returning book from unknown member");

// Test 9: returnBook() with member who doesn't have the book
assert.throws(() => {
  library.returnBook("978-0201633610", "Alice");
}, Error, "Should throw error when member doesn't have the book");

// Test 10: returnBook() with unknown ISBN
assert.throws(() => {
  library.returnBook("unknown", "Alice");
}, Error, "Should throw error when returning unknown ISBN");

// Test 11: Verify that after returning all books, loans() returns empty array
library.returnBook("978-0596009205", "Alice");
result = library.loans("Alice");
assert.deepStrictEqual(result, [], "Alice should have no loans after returning all books");

console.log("All tests passed!");
console.log("Testing hold functionality...");

// Test 1: placeHold with available book - first check out all copies to make it unavailable
library.checkout("978-0134685991", "Alice");
library.checkout("978-0134685991", "Bob");
library.checkout("978-0134685991", "Charlie");
assert.throws(() => {
  library.placeHold("978-0134685991", "David");
}, Error, "Should throw error when trying to place hold on available book");

// Test 2: placeHold with unknown ISBN
assert.throws(() => {
  library.placeHold("unknown", "Charlie");
}, Error, "Should throw error when placing hold on unknown ISBN");

// Test 3: placeHold with member who already has the book
library.checkout("978-0134685991", "Charlie");
assert.throws(() => {
  library.placeHold("978-0134685991", "Charlie");
}, Error, "Should throw error when member already has the book");

// Test 4: placeHold with member who already has a hold on the book
assert.throws(() => {
  library.placeHold("978-0134685991", "Charlie");
}, Error, "Should throw error when member already holds the book");

// Test 5: placeHold with no available copies
library.returnBook("978-0134685991", "Charlie");
library.placeHold("978-0134685991", "Charlie");
result = library.holds("978-0134685991");
assert.deepStrictEqual(result, ["Charlie"], "Charlie should be in hold queue");

// Test 6: placeHold with multiple members
library.placeHold("978-0134685991", "Alice");
result = library.holds("978-0134685991");
assert.deepStrictEqual(result, ["Charlie", "Alice"], "Queue should be in order");

// Test 7: holds with no holds
result = library.holds("978-0201633610");
assert.deepStrictEqual(result, [], "Book with no holds should return empty array");

// Test 8: Integration test - returnBook should give book to first in hold queue
library.checkout("978-0134685991", "Bob");
library.returnBook("978-0134685991", "Bob");
result = library.loans("Charlie");
assert.deepStrictEqual(result, ["978-0134685991"], "Charlie should get the book after Bob returns it");

// Test 9: Verify Alice still has no books
result = library.loans("Alice");
assert.deepStrictEqual(result, [], "Alice should still have no books");

// Test 10: Test that holds queue is properly managed when multiple books are involved
library.addBook("978-0596009205", "Head First Design Patterns", 1);
library.checkout("978-0596009205", "David");
library.placeHold("978-0596009205", "Eve");
result = library.holds("978-0596009205");
assert.deepStrictEqual(result, ["Eve"], "Eve should be in hold queue for second book");

console.log("All hold tests passed!");
