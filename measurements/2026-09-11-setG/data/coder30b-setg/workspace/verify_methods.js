// Simple verification that the methods work correctly
const { Library } = require('./s1_library.js');

console.log("=== Verifying Library methods ===");

const library = new Library();

// Add some books
library.addBook('978-0134685991', 'Effective Java', 3);
library.addBook('978-0201633610', 'Design Patterns', 1);

console.log("1. Testing loans() method with no loans:");
console.log("   Loans for Bob (no loans):", library.loans('Bob'));

console.log("\n2. Testing checkout and loans:");
library.checkout('978-0134685991', 'Alice');
library.checkout('978-0201633610', 'Alice');
console.log("   Loans for Alice:", library.loans('Alice'));

console.log("\n3. Testing returnBook method:");
try {
    library.returnBook('978-0134685991', 'Alice');
    console.log("   Successfully returned book to Alice");
    console.log("   Alice's loans after return:", library.loans('Alice'));
    console.log("   Available copies after return:", library.available('978-0134685991'));
} catch (error) {
    console.error("   Error returning book:", error.message);
}

console.log("\n4. Testing error cases:");
try {
    library.returnBook('978-0134685991', 'Unknown');
    console.log("   ERROR: Should have thrown an error");
} catch (error) {
    console.log("   Correctly threw error for unknown member:", error.message);
}

try {
    library.returnBook('978-0000000000', 'Alice');
    console.log("   ERROR: Should have thrown an error");
} catch (error) {
    console.log("   Correctly threw error for unknown ISBN:", error.message);
}

console.log("\n=== All verification tests completed ===");