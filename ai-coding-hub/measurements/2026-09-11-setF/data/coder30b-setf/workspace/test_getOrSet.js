const { Cache } = require('./s7_cache.js');

// Test the getOrSet method
const cache = new Cache(3);

// Test 1: Hit - value already exists
cache.set('existing', 'cached_value');
const result1 = cache.getOrSet('existing', () => {
    throw new Error('This should not be called for hits');
});
console.log('Test 1 - Hit:', result1 === 'cached_value' ? 'PASS' : 'FAIL');

// Test 2: Miss - value doesn't exist, should call factory
const result2 = cache.getOrSet('new_key', (key) => {
    return `computed_${key}`;
});
console.log('Test 2 - Miss:', result2 === 'computed_new_key' ? 'PASS' : 'FAIL');

// Test 3: Verify the new value was stored
const result3 = cache.get('new_key');
console.log('Test 3 - Stored value:', result3 === 'computed_new_key' ? 'PASS' : 'FAIL');

// Test 4: Error handling - factory throws
try {
    cache.getOrSet('error_key', () => {
        throw new Error('Factory error');
    });
    console.log('Test 4 - Error handling: FAIL - should have thrown');
} catch (e) {
    console.log('Test 4 - Error handling: PASS - correctly threw error');
}

// Test 5: Verify error didn't store anything
const result5 = cache.get('error_key');
console.log('Test 5 - Error cleanup:', result5 === undefined ? 'PASS' : 'FAIL');

console.log('All tests completed');