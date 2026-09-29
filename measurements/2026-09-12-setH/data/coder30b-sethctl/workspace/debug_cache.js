const { Cache } = require('./s7_cache.js');

// Create a cache with capacity 2
const cache = new Cache(2);
console.log('=== Debug Cache Eviction ===');
console.log('Initial state:');
console.log('  Size:', cache.size());
console.log('  Keys:', cache.keys());

// Set first item
console.log('\nSetting a=1:');
cache.set('a', 1);
console.log('  Size:', cache.size());
console.log('  Keys:', cache.keys());

// Set second item
console.log('\nSetting b=2:');
cache.set('b', 2);
console.log('  Size:', cache.size());
console.log('  Keys:', cache.keys());

// Set third item - should evict 'a'
console.log('\nSetting c=3 (should evict a):');
cache.set('c', 3);
console.log('  Size:', cache.size());
console.log('  Keys:', cache.keys());
console.log('  Has a:', cache.has('a'));
console.log('  Has b:', cache.has('b'));
console.log('  Has c:', cache.has('c'));