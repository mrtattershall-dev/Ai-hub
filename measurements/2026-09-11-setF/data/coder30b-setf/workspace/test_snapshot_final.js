// Test the snapshot and restore functionality
const { Library } = require('./s1_library.js');
const { Cache } = require('./s7_cache.js');
const { snapshot, restore } = require('./s10_desk.js');

console.log('Testing snapshot and restore functionality...');

// Create a test library with some books
const library = new Library();
library.addBook("978-0-123456-78-9", "The Great Gatsby", 3);
library.addBook("978-0-987654-32-1", "1984");
library.addBook("978-0-111111-11-1", "Animal Farm", 1);

console.log('Original library titles:', library.titles());

// Create a cache
const cache = new Cache(10);

// Test snapshot
console.log('\n--- Testing snapshot ---');
const snapshotData = snapshot(library, cache, 'test_key');
console.log('Snapshot returned data length:', snapshotData.length);
console.log('Snapshot data type:', typeof snapshotData);

// Test restore
console.log('\n--- Testing restore ---');
const restoredLibrary = restore(cache, 'test_key');
console.log('Restored library titles:', restoredLibrary.titles());

// Test restore with non-existent key
console.log('\n--- Testing restore with non-existent key ---');
const nullResult = restore(cache, 'non_existent_key');
console.log('Null result:', nullResult);

console.log('\n--- All tests completed successfully! ---');