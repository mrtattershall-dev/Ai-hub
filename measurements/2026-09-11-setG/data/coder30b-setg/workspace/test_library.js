const { Library } = require('./s1_library.js');

console.log("Testing Library class methods...");

const library = new Library();

// Add some books
library.addBook('978-0134685991', 'Effective Java', 3);
library.addBook('978-0201633610', 'Design Patterns', 1);
library.addBook('978-0596009205', 'JavaScript: The Good Parts', 2);

console.log("=== Testing loans() method ===");
// Test loans with no loans
console.log("Loans for Bob (no loans):", library.loans('Bob'));

// Test checkout and loans
library.checkout('978-0134685991', 'Alice');
library.checkout('978-0201633610', 'Alice');
library.checkout('978-0596009205', 'Charlie');

console.log("Loans for Alice:", library.loans('Alice'));
console.log("Loans for Charlie:", library.loans('Charlie'));

console.log("\n=== Testing returnBook() method ===");

// Test returnBook
try {
    library.returnBook('978-0134685991', 'Alice');
    console.log("Successfully returned book to Alice");
    console.log("Alice's loans after return:", library.loans('Alice'));
    console.log("Available copies after return:", library.available('978-0134685991'));
} catch (error) {
    console.error("Error returning book:", error.message);
}

// Test returnBook with invalid member
try {
    library.returnBook('978-0134685991', 'Unknown');
    console.log("This should not happen - should have thrown error");
} catch (error) {
    console.log("Correctly threw error for unknown member:", error.message);
}

// Test returnBook with invalid ISBN
try {
    library.returnBook('978-0000000000', 'Alice');
    console.log("This should not happen - should have thrown error");
} catch (error) {
    console.log("Correctly threw error for unknown ISBN:", error.message);
}

console.log("\n=== Testing placeHold() method ===");

// Test placeHold with available book
try {
    library.placeHold('978-0134685991', 'Bob');
    console.log("This should not happen - should have thrown error for available book");
} catch (error) {
    console.log("Correctly threw error for available book:", error.message);
}

// Test placeHold with unavailable book
try {
    library.placeHold('978-0201633610', 'Bob');
    console.log("Successfully placed hold for Bob on Design Patterns");
    console.log("Holds for Design Patterns:", library.holds('978-0201633610'));
} catch (error) {
    console.error("Error placing hold:", error.message);
}

// Test placeHold with unknown ISBN
try {
    library.placeHold('978-0000000000', 'Bob');
    console.log("This should not happen - should have thrown error for unknown ISBN");
} catch (error) {
    console.log("Correctly threw error for unknown ISBN:", error.message);
}

// Test placeHold with member already having the book
try {
    library.placeHold('978-0134685991', 'Alice');
    console.log("This should not happen - should have thrown error for member with book");
} catch (error) {
    console.log("Correctly threw error for member with book:", error.message);
}

// Test placeHold with member already having a hold
try {
    library.placeHold('978-0201633610', 'Bob');
    console.log("This should not happen - should have thrown error for member with hold");
} catch (error) {
    console.log("Correctly threw error for member with hold:", error.message);
}

console.log("\n=== Testing holds() method ===");

// Test holds with no holds
console.log("Holds for Effective Java:", library.holds('978-0134685991'));

// Test holds with existing holds
console.log("Holds for Design Patterns:", library.holds('978-0201633610'));

console.log("\n=== Testing hold queue behavior ===");

// Return a book and see if hold is fulfilled
try {
    library.returnBook('978-0201633610', 'Alice');
    console.log("Successfully returned book to Alice");
    console.log("Alice's loans after return:", library.loans('Alice'));
    console.log("Bob's loans after return:", library.loans('Bob'));
    console.log("Available copies after return:", library.available('978-0201633610'));
    console.log("Holds after return:", library.holds('978-0201633610'));
} catch (error) {
    console.error("Error returning book:", error.message);
}

console.log("\n=== All tests completed ===");
console.log("\n=== Testing fines() and pay() methods ===");

// Test fines with no fines
console.log("Fines for Alice (no fines):", library.fines('Alice'));

// Test returnBook with fines (we'll need to simulate a late return)
// First, let's checkout a book and then return it to see the fine
try {
    library.checkout('978-0134685991', 'David');
    console.log("Successfully checked out book to David");
    
    // Return the book (this should return the fine amount)
    const fine = library.returnBook('978-0134685991', 'David');
    console.log("Fine for David:", fine);
    
    // Check that the fine was added to David's account
    console.log("David's total fines after return:", library.fines('David'));
    
} catch (error) {
    console.error("Error testing fines:", error.message);
}

// Test pay method
try {
    // Pay some fines
    library.pay('David', 25);
    console.log("Successfully paid 25 cents");
    console.log("David's remaining fines:", library.fines('David'));
    
    // Try to pay more than owed
    library.pay('David', 100);
    console.log("This should not happen - should have thrown error");
} catch (error) {
    console.log("Correctly threw error for overpayment:", error.message);
}

// Test pay with invalid amount
try {
    library.pay('David', -10);
    console.log("This should not happen - should have thrown error");
} catch (error) {
    console.log("Correctly threw error for negative payment:", error.message);
}

// Test pay with non-existent member
try {
    library.pay('NonExistent', 25);
    console.log("This should not happen - should have thrown error");
} catch (error) {
    console.log("Correctly threw error for non-existent member:", error.message);
}

console.log("\n=== All tests completed ===");
console.log("\n=== Testing toJSON() and fromJSON() methods ===");

// Create a library with some data
const originalLibrary = new Library();
originalLibrary.addBook('978-0134685991', 'Effective Java', 3);
originalLibrary.addBook('978-0201633610', 'Design Patterns', 1);
originalLibrary.addBook('978-0596009205', 'JavaScript: The Good Parts', 2);

originalLibrary.checkout('978-0134685991', 'Alice');
originalLibrary.checkout('978-0201633610', 'Alice');
originalLibrary.checkout('978-0596009205', 'Charlie');

originalLibrary.placeHold('978-0201633610', 'Bob');
originalLibrary.placeHold('978-0201633610', 'David');

originalLibrary.pay('Alice', 50); // Alice owes 50 cents
originalLibrary.pay('Charlie', 25); // Charlie owes 25 cents

// Test toJSON
const serializedData = originalLibrary.toJSON();
console.log("Serialized data:", JSON.stringify(serializedData, null, 2));

// Test fromJSON
const reconstructedLibrary = Library.fromJSON(serializedData);

// Verify that the reconstructed library has the same state
console.log("Original books count:", originalLibrary.books.size);
console.log("Reconstructed books count:", reconstructedLibrary.books.size);

console.log("Original Alice's loans:", originalLibrary.loans('Alice'));
console.log("Reconstructed Alice's loans:", reconstructedLibrary.loans('Alice'));

console.log("Original holds for Design Patterns:", originalLibrary.holds('978-0201633610'));
console.log("Reconstructed holds for Design Patterns:", reconstructedLibrary.holds('978-0201633610'));

console.log("Original Alice's fines:", originalLibrary.fines('Alice'));
console.log("Reconstructed Alice's fines:", reconstructedLibrary.fines('Alice'));

console.log("Original Charlie's fines:", originalLibrary.fines('Charlie'));
console.log("Reconstructed Charlie's fines:", reconstructedLibrary.fines('Charlie'));

console.log("\n=== Test completed ===");
