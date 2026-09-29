// Simple test for canBorrow function
const fs = require('fs');

// Read s10_desk.js to get the canBorrow function
const content = fs.readFileSync('./s10_desk.js', 'utf8');

// Extract just the canBorrow function
const canBorrowMatch = content.match(/function canBorrow\(library, member\) \{[\s\S]*?return.*?;[\s\S]*?\}/);

if (!canBorrowMatch) {
    console.error("canBorrow function not found in s10_desk.js");
    process.exit(1);
}

// Create a mock library object for testing
const mockLibrary = {
    loans: function(member) {
        // Mock implementation for testing
        const memberLoans = {
            'Bob': [], // 0 books
            'Alice': ['book1', 'book2', 'book3'], // 3 books
            'Charlie': ['book1', 'book2'], // 2 books
            'David': ['book1', 'book2', 'book3', 'book4'] // 4 books
        };
        return memberLoans[member] || [];
    },
    fines: function(member) {
        // Mock implementation for testing
        const memberFines = {
            'Bob': 0, // 0 cents
            'Alice': 0, // 0 cents
            'Charlie': 600, // 600 cents (over 500)
            'David': 0 // 0 cents
        };
        return memberFines[member] || 0;
    }
};

// Test the canBorrow function directly
console.log("Testing canBorrow function directly...");

// Test 1: Member with no books and no fines should be able to borrow
console.log("Test 1 - Can Bob borrow? (should be true):", canBorrow(mockLibrary, 'Bob'));

// Test 2: Member with 3 books should not be able to borrow
console.log("Test 2 - Can Alice borrow after 3 books? (should be false):", canBorrow(mockLibrary, 'Alice'));

// Test 3: Member with fines over 500 should not be able to borrow
console.log("Test 3 - Can Charlie borrow with fines? (should be false):", canBorrow(mockLibrary, 'Charlie'));

// Test 4: Member with 4 books should not be able to borrow
console.log("Test 4 - Can David borrow with 4 books? (should be false):", canBorrow(mockLibrary, 'David'));

console.log("All tests completed!");