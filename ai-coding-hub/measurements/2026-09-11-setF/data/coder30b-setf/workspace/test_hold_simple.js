const { Library } = require('./s1_library.js');

// Test the new methods
const library = new Library();

// Add some books
library.addBook("978-0-123456-78-9", "The Great Gatsby", 1);
library.addBook("978-0-987654-32-1", "1984", 2);

console.log("Testing basic functionality...");

// Checkout a book
library.checkout("978-0-123456-78-9", "Alice");
console.log("Alice checked out The Great Gatsby");

// Try to place a hold when book is unavailable
try {
    library.placeHold("978-0-123456-78-9", "Bob");
    console.log("Bob placed hold on The Great Gatsby (should work)");
} catch (e) {
    console.log("Error placing hold:", e.message);
}

// Check holds queue
try {
    const holds = library.holds("978-0-123456-78-9");
    console.log("Holds queue (should be Bob):", holds);
} catch (e) {
    console.log("Error getting holds:", e.message);
}

// Return the book
try {
    library.returnBook("978-0-123456-78-9", "Alice");
    console.log("Book returned, should go to Bob now");
} catch (e) {
    console.log("Error returning book:", e.message);
}

// Check Bob's loans
try {
    const bobLoans = library.getLoans("Bob");
    console.log("Bob's loans (should have The Great Gatsby):", bobLoans);
} catch (e) {
    console.log("Error getting Bob's loans:", e.message);
}

console.log("Simple test completed!");