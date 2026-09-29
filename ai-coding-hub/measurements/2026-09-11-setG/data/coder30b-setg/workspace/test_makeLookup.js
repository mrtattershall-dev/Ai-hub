const { Library } = require('./s1_library.js');
const { Cache } = require('./s7_cache.js');
const { makeLookup } = require('./s10_desk.js');

// Create a library and add some books
const library = new Library();
library.addBook("978-0134685991", "Effective Java", 5);
library.addBook("978-0201633610", "Design Patterns", 3);

// Create a cache
const cache = new Cache();

// Create the lookup function
const lookup = makeLookup(library, cache);

// Test the lookup function
console.log("Testing makeLookup function:");
console.log("First call for ISBN 978-0134685991:", lookup("978-0134685991"));
console.log("Second call for ISBN 978-0134685991 (should use cache):", lookup("978-0134685991"));

// Test with a non-existent ISBN
console.log("Non-existent ISBN:", lookup("978-0000000000"));

// Check cache contents
console.log("Cache contents:", cache.entries());