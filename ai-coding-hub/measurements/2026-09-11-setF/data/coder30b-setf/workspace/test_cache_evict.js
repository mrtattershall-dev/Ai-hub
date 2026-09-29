// Test for onEvict functionality in Cache
const Cache = require('./s7_cache.js');

console.log('Testing Cache onEvict functionality...');

// Test 1: LRU eviction
console.log('\n1. Testing LRU eviction:');
let lruCalls = [];
const cache1 = new Cache(2, {
  onEvict: (key, value, reason) => {
    lruCalls.push({ key, value, reason });
  }
});

cache1.set('a', 'value_a');
cache1.set('b', 'value_b');
cache1.set('c', 'value_c'); // This should evict 'a'

console.log('Expected: 1 LRU call');
console.log('Actual LRU calls:', lruCalls.length);
if (lruCalls.length === 1 && lruCalls[0].key === 'a' && lruCalls[0].reason === 'lru') {
  console.log('✓ LRU eviction test passed');
} else {
  console.log('✗ LRU eviction test failed');
  console.log('Details:', lruCalls);
}

// Test 2: Expiration
console.log('\n2. Testing expiration:');
let expireCalls = [];
const cache2 = new Cache(2, {
  onEvict: (key, value, reason) => {
    expireCalls.push({ key, value, reason });
  },
  ttl: 100 // 100ms TTL
});

cache2.set('expired_key', 'expired_value');
setTimeout(() => {
  const value = cache2.get('expired_key'); // Should trigger expiration
  console.log('Expected: 1 expiration call');
  console.log('Actual expiration calls:', expireCalls.length);
  if (expireCalls.length === 1 && expireCalls[0].key === 'expired_key' && expireCalls[0].reason === 'expired') {
    console.log('✓ Expiration test passed');
  } else {
    console.log('✗ Expiration test failed');
    console.log('Details:', expireCalls);
  }
}, 150);

// Test 3: Deletion
console.log('\n3. Testing deletion:');
let deleteCalls = [];
const cache3 = new Cache(2, {
  onEvict: (key, value, reason) => {
    deleteCalls.push({ key, value, reason });
  }
});

cache3.set('to_delete', 'delete_value');
cache3.delete('to_delete');

console.log('Expected: 1 delete call');
console.log('Actual delete calls:', deleteCalls.length);
if (deleteCalls.length === 1 && deleteCalls[0].key === 'to_delete' && deleteCalls[0].reason === 'deleted') {
  console.log('✓ Deletion test passed');
} else {
  console.log('✗ Deletion test failed');
  console.log('Details:', deleteCalls);
}

// Test 4: Clear
console.log('\n4. Testing clear:');
let clearCalls = [];
const cache4 = new Cache(2, {
  onEvict: (key, value, reason) => {
    clearCalls.push({ key, value, reason });
  }
});

cache4.set('key1', 'value1');
cache4.set('key2', 'value2');
cache4.clear();

console.log('Expected: 2 clear calls (for both entries)');
console.log('Actual clear calls:', clearCalls.length);
if (clearCalls.length === 2) {
  console.log('✓ Clear test passed');
} else {
  console.log('✗ Clear test failed');
  console.log('Details:', clearCalls);
}

console.log('\nAll tests completed.');
// Test 5: toJSON and fromJSON
console.log('\n5. Testing toJSON and fromJSON:');
const cache5 = new Cache(3);
cache5.set('a', 'value_a');
cache5.set('b', 'value_b');
cache5.set('c', 'value_c');

// Test toJSON
const serialized = cache5.toJSON();
console.log('Serialized data:', JSON.stringify(serialized, null, 2));

// Check if the serialized data has the correct structure
const expectedCapacity = 3;
const expectedEntries = [['a', 'value_a'], ['b', 'value_b'], ['c', 'value_c']];

if (serialized.capacity === expectedCapacity && 
    JSON.stringify(serialized.entries) === JSON.stringify(expectedEntries)) {
  console.log('✓ toJSON test passed');
} else {
  console.log('✗ toJSON test failed');
  console.log('Expected capacity:', expectedCapacity);
  console.log('Actual capacity:', serialized.capacity);
  console.log('Expected entries:', expectedEntries);
  console.log('Actual entries:', serialized.entries);
}

// Test fromJSON
const cache6 = Cache.fromJSON(serialized);
const deserializedEntries = cache6.toJSON().entries;

if (JSON.stringify(deserializedEntries) === JSON.stringify(expectedEntries)) {
  console.log('✓ fromJSON test passed');
} else {
  console.log('✗ fromJSON test failed');
  console.log('Expected entries:', expectedEntries);
  console.log('Deserialized entries:', deserializedEntries);
}

// Test 6: toJSON with expired entries
console.log('\n6. Testing toJSON with expired entries:');
const cache7 = new Cache(2, { ttl: 100 });
cache7.set('expired', 'expired_value');
cache7.set('valid', 'valid_value');

// Manually expire one entry by manipulating the internal structure
// This is a more reliable way to test expiration filtering
const now = Date.now();
const expiredEntry = cache7.map.get('expired');
expiredEntry.expiry = now - 1000; // Make it expired

const serialized7 = cache7.toJSON();
console.log('Serialized data with expired entries:', JSON.stringify(serialized7, null, 2));

// Should only contain valid entries
if (serialized7.entries.length === 1 && serialized7.entries[0][0] === 'valid') {
  console.log('✓ toJSON with expired entries test passed');
} else {
  console.log('✗ toJSON with expired entries test failed');
  console.log('Expected: only valid entry');
  console.log('Actual entries:', serialized7.entries);
}

console.log('\nAll tests completed.');
