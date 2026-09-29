const { makeLookup } = require('./s10_desk.js');
const { Library } = require('./s1_library.js');
const { Cache } = require('./s7_cache.js');

// Test that makeLookup is exported
console.log('Testing makeLookup export...');
console.log('makeLookup is:', typeof makeLookup);

// Test that it creates a function
const library = new Library();
const cache = new Cache(10);
const lookup = makeLookup(library, cache);

console.log('lookup is:', typeof lookup);
console.log('Test completed successfully');