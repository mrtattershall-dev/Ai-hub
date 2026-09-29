// Simple test to debug checkout functionality
const { Library } = require('./s1_library.js');

const library = new Library();
library.addBook("978-0134685991", "Effective Java", 3);
console.log("After adding 3 copies:", library.copies("978-0134685991"));

library.addBook("978-0134685991", "Effective Java", 2);
console.log("After adding 2 more copies:", library.copies("978-0134685991"));

library.addBook("978-0596009205", "Head First Design Patterns", 1);
console.log("Added second book with 1 copy:", library.copies("978-0596009205"));

console.log("Available for first book:", library.available("978-0134685991"));
console.log("Available for second book:", library.available("978-0596009205"));

// Try to checkout
try {
    library.checkout("978-0134685991", "Alice");
    console.log("Checkout successful");
    console.log("Available after checkout:", library.available("978-0134685991"));
} catch (e) {
    console.log("Checkout failed:", e.message);
}
// Test the new delete and clear methods
const { Cache } = require('./s7_cache.js');

console.log("\nTesting new delete and clear methods...");

// Test delete method
const cache = new Cache(3);

// Add some items
cache.set('a', 1);
cache.set('b', 2);
cache.set('c', 3);

console.log("Cache size before delete:", cache.size());

// Test deleting existing key
const deletedA = cache.delete('a');
console.log("Delete existing key 'a':", deletedA); // Should be true

console.log("Cache size after delete:", cache.size());

// Test deleting non-existing key
const deletedD = cache.delete('d');
console.log("Delete non-existing key 'd':", deletedD); // Should be false

console.log("Cache size after trying to delete non-existing key:", cache.size());

// Test clear method
cache.clear();
console.log("Cache size after clear:", cache.size()); // Should be 0

console.log("All tests completed.");
