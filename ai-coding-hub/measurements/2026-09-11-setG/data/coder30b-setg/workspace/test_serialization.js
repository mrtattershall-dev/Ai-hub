const Library = require('./s1_library.js');

// Create a test library
const library = new Library();

// Add some books
library.addBook("978-0134685991", "Effective Java", 3);
library.addBook("978-0201633610", "Design Patterns", 2);

// Add some members
library.registerMember("Alice");
library.registerMember("Bob");

// Checkout some books
library.checkout("978-0134685991", "Alice");
library.checkout("978-0201633610", "Bob");

// Add some holds
library.placeHold("978-0134685991", "Bob");
library.placeHold("978-0134685991", "Charlie");

// Add some fines
library.addFine("Alice", 100);
library.addFine("Bob", 50);

// Test toJSON
const serialized = library.toJSON();
console.log("Serialized data:");
console.log(JSON.stringify(serialized, null, 2));

// Test fromJSON
const library2 = Library.fromJSON(serialized);
console.log("\nReconstructed library:");
console.log("Books:", library2.books.size);

// Test that the reconstructed library has the same data
console.log("Alice's books:", Array.from(library2.books.entries()).filter(([isbn, book]) => book.loans.has("Alice")).map(([isbn, book]) => isbn));
console.log("Bob's books:", Array.from(library2.books.entries()).filter(([isbn, book]) => book.loans.has("Bob")).map(([isbn, book]) => isbn));

console.log("Bob's holds:", library2.books.get("978-0134685991")?.holds || []);
console.log("Alice's fine:", library2.members.get("Alice")?.fines || 0);
console.log("Bob's fine:", library2.members.get("Bob")?.fines || 0);