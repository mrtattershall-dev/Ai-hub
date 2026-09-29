const { Library } = require('./s1_library.js');
const { Cache } = require('./s7_cache.js');
const { snapshot, restore } = require('./s10_desk.js');

// Create a test library
const library = new Library();
library.addBook("978-0-123456-78-9", "The Great Gatsby", 3);
library.addBook("978-0-987654-32-1", "1984");
library.addBook("978-0-111111-11-1", "Animal Farm", 1);

// Create a cache
const cache = new Cache(10);

// Test snapshot
console.log('Testing snapshot...');
const snapshotData = snapshot(library, cache, 'test_key');
console.log('Snapshot data:', snapshotData);

// Test restore
console.log('Testing restore...');
const restoredLibrary = restore(cache, 'test_key');
console.log('Restored library titles:', restoredLibrary.titles());

// Test restore with non-existent key
console.log('Testing restore with non-existent key...');
const nullResult = restore(cache, 'non_existent_key');
console.log('Null result:', nullResult);

console.log('All tests completed successfully!');