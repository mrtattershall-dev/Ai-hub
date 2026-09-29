const { Library } = require('./s1_library.js');
const { Cache } = require('./s7_cache.js');
const { makeLookup } = require('./s10_desk.js');

// Create a test library
const library = new Library();
library.addBook('123', 'The Great Gatsby', 3);
library.addBook('456', '1984', 2);

// Create a cache
const cache = new Cache(2);

// Create the lookup function
const lookup = makeLookup(library, cache);

// Test the lookup function
console.log('Testing makeLookup function:');
console.log('Lookup for ISBN 123:', lookup('123'));
console.log('Lookup for ISBN 456:', lookup('456'));
console.log('Lookup for ISBN 123 (should be cached):', lookup('123'));

// Check cache contents
console.log('Cache size:', cache.size());
console.log('Cache keys:', cache.keys());