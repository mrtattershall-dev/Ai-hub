const Library = require('./s1_library.js');

// Create a test library
const library = new Library();

// Add some books
library.addBook("978-0134685991", "Effective Java", 3);
library.addBook("978-0201633610", "Design Patterns", 2);
library.addBook("978-0596009205", "JavaScript: The Good Parts", 1);

// Add some members
library.members.set("Alice", { fines: 0 });
library.members.set("Bob", { fines: 0 });

// Checkout some books
library.checkout("978-0134685991", "Alice", 1);
library.checkout("978-0201633610", "Alice", 2);
library.checkout("978-0596009205", "Bob", 3);

// Place some holds
library.placeHold("978-0134685991", "Charlie");
library.placeHold("978-0201633610", "David");

// Add some fines
library.members.get("Alice").fines = 100;
library.members.get("Bob").fines = 250;

// Test toJSON
console.log("Original library state:");
const serialized = library.toJSON();
console.log(JSON.stringify(serialized, null, 2));

// Test fromJSON
console.log("\nReconstructing library from JSON...");
const reconstructed = Library.fromJSON(serialized);

console.log("Reconstructed library state:");
const reconstructedSerialized = reconstructed.toJSON();
console.log(JSON.stringify(reconstructedSerialized, null, 2));

// Verify they match
console.log("\nSerialization/Deserialization successful:", 
    JSON.stringify(serialized) === JSON.stringify(reconstructedSerialized));