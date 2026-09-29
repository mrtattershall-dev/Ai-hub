// Test file for checkout and available methods
const { Library } = require('./s1_library.js');

// Create a new library instance
const library = new Library();

// Add some test books
library.addBook("978-0134685991", "Effective Java", 3);
library.addBook("978-0201633610", "Design Patterns", 1);

console.log("Testing checkout and available methods...");

// Test 1: available() with existing ISBN
console.assert(library.available("978-0134685991") === 3, "Test 1 failed: available() should return correct count");
console.log("✓ Test 1 passed: available() with existing ISBN");

// Test 2: available() with unknown ISBN
console.assert(library.available("978-0000000000") === 0, "Test 2 failed: available() should return 0 for unknown ISBN");
console.log("✓ Test 2 passed: available() with unknown ISBN");

// Test 3: checkout() with valid parameters
library.checkout("978-0134685991", "member1");
console.assert(library.available("978-0134685991") === 2, "Test 3 failed: checkout should reduce available count");
console.log("✓ Test 3 passed: checkout() with valid parameters");

// Test 4: checkout() with unknown ISBN should throw error
let errorCaught = false;
try {
    library.checkout("978-0000000000", "member1");
} catch (e) {
    errorCaught = true;
    console.assert(e.message === "Unknown ISBN", "Test 4 failed: Should throw 'Unknown ISBN' error");
}
console.assert(errorCaught, "Test 4 failed: checkout with unknown ISBN should throw error");
console.log("✓ Test 4 passed: checkout() with unknown ISBN throws error");

// Test 5: checkout() when no copies available should throw error
library.checkout("978-0134685991", "member2"); // Use up the last copy
library.checkout("978-0134685991", "member3"); // Use up the last copy
try {
    library.checkout("978-0134685991", "member4"); // Try to checkout when no copies left
} catch (e) {
    errorCaught = true;
    console.assert(e.message === "No copies available", "Test 5 failed: Should throw 'No copies available' error");
}
console.assert(errorCaught, "Test 5 failed: checkout when no copies available should throw error");
console.log("✓ Test 5 passed: checkout() when no copies available throws error");

// Test 6: checkout() when member already has the book should throw error
// First, let's make sure we have a book with 1 copy available
library.addBook("978-0201633610", "Design Patterns", 2); // Add another copy
library.checkout("978-0201633610", "member1"); // Checkout one copy to member1
try {
    library.checkout("978-0201633610", "member1"); // Try to checkout same book to same member
} catch (e) {
    errorCaught = true;
    console.assert(e.message === "Member already has this book", "Test 6 failed: Should throw 'Member already has this book' error");
}
console.assert(errorCaught, "Test 6 failed: checkout when member already has book should throw error");
console.log("✓ Test 6 passed: checkout() when member already has book throws error");

// Test 7: Multiple checkouts to same member should work for different books
library.checkout("978-0201633610", "member2"); // Checkout to different member
console.assert(library.available("978-0201633610") === 0, "Test 7 failed: available should be 0 after checkout");
console.log("✓ Test 7 passed: Multiple checkouts to same member work for different books");

console.log("All checkout and available tests passed!");
// Test 8: overdueLines function
console.log("Testing overdueLines function...");

// Create a library with some books
const testLibrary = new Library();
testLibrary.addBook("978-0134685991", "Effective Java", 1);
testLibrary.addBook("978-0201633610", "Design Patterns", 1);

// Checkout books to members
testLibrary.checkout("978-0134685991", "member1");
testLibrary.checkout("978-0201633610", "member2");

// Set a date in the past to make books overdue
const today = new Date("2023-01-01");
const yesterday = new Date("2022-12-31");

// Test overdueLines function
const overdueResult = overdueLines(testLibrary, yesterday);
const expected = "member1 owes 978-0134685991 (1 days)\nmember2 owes 978-0201633610 (1 days)";
console.assert(overdueResult === expected, `Test 8 failed: overdueLines should return formatted string. Got: "${overdueResult}", Expected: "${expected}"`);
console.log("✓ Test 8 passed: overdueLines function works correctly");

console.log("All checkout and available tests passed!");
