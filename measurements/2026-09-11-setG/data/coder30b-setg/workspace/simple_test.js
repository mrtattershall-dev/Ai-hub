const { Library } = require('./s1_library.js');
const { Cache } = require('./s7_cache.js');
const { makeLookup } = require('./s10_desk.js');

// Create a simple test without triggering the library tests
console.log("Creating library and cache...");
const library = new Library();
library.addBook("978-0134685991", "Effective Java", 5);
library.addBook("978-0201633610", "Design Patterns", 3);

const cache = new Cache();
const lookup = makeLookup(library, cache);

console.log("Testing makeLookup function:");
console.log("First call:", lookup("978-0134685991"));
console.log("Second call (should use cache):", lookup("978-0134685991"));

// Test cache contents
console.log("Cache entries:", cache.entries());

console.log("Test completed successfully!");