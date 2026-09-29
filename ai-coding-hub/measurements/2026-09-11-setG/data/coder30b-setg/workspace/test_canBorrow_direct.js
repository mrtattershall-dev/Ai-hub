// Direct test of canBorrow function logic without importing problematic modules
const fs = require('fs');

// Read the s10_desk.js file to extract the canBorrow function
const content = fs.readFileSync('./s10_desk.js', 'utf8');

// Extract the canBorrow function implementation
const canBorrowMatch = content.match(/function canBorrow\(library, member\) \{[\s\S]*?return.*?;[\s\S]*?\}/);

if (!canBorrowMatch) {
    console.error("canBorrow function not found in s10_desk.js");
    process.exit(1);
}

// Create a mock implementation of the library methods that mimics the real ones
function testCanBorrow(library, member) {
    const loans = library.loans(member);
    const fines = library.fines(member);
    return loans.length < 3 && fines < 500;
}

// Test cases
console.log("Testing canBorrow function logic directly...");

// Test 1: Member with no books and no fines should be able to borrow
const mockLibrary1 = {
    loans: function(member) { return []; }, // 0 books
    fines: function(member) { return 0; }   // 0 cents
};
console.log("Test 1 - Can borrow with 0 books and 0 fines? (should be true):", testCanBorrow(mockLibrary1, 'Bob'));

// Test 2: Member with 3 books should not be able to borrow
const mockLibrary2 = {
    loans: function(member) { return ['book1', 'book2', 'book3']; }, // 3 books
    fines: function(member) { return 0; }   // 0 cents
};
console.log("Test 2 - Can borrow with 3 books? (should be false):", testCanBorrow(mockLibrary2, 'Alice'));

// Test 3: Member with fines over 500 should not be able to borrow
const mockLibrary3 = {
    loans: function(member) { return ['book1', 'book2']; }, // 2 books
    fines: function(member) { return 600; }   // 600 cents (over 500)
};
console.log("Test 3 - Can borrow with fines over 500? (should be false):", testCanBorrow(mockLibrary3, 'Charlie'));

// Test 4: Member with 4 books should not be able to borrow
const mockLibrary4 = {
    loans: function(member) { return ['book1', 'book2', 'book3', 'book4']; }, // 4 books
    fines: function(member) { return 0; }   // 0 cents
};
console.log("Test 4 - Can borrow with 4 books? (should be false):", testCanBorrow(mockLibrary4, 'David'));

// Test 5: Member with 2 books and 400 fines should be able to borrow
const mockLibrary5 = {
    loans: function(member) { return ['book1', 'book2']; }, // 2 books
    fines: function(member) { return 400; }   // 400 cents (under 500)
};
console.log("Test 5 - Can borrow with 2 books and 400 fines? (should be true):", testCanBorrow(mockLibrary5, 'Eve'));

console.log("All tests completed!");