const { Cache } = require('./s7_cache.js');

function runTests() {
  console.log('Running Cache tests...');
  
  // Test 1: Basic functionality without TTL
  console.log('Test 1: Basic functionality without TTL');
  const cache1 = new Cache(2);
  cache1.set('a', 1);
  cache1.set('b', 2);
  console.log('get(a):', cache1.get('a')); // Should be 1
  console.log('get(b):', cache1.get('b')); // Should be 2
  console.log('has(a):', cache1.has('a')); // Should be true
  console.log('has(c):', cache1.has('c')); // Should be false
  console.log('size:', cache1.size()); // Should be 2
  console.log('keys:', cache1.keys()); // Should be ['a', 'b']
  
  // Test 2: TTL functionality with default TTL
  console.log('\nTest 2: TTL functionality with default TTL');
  const now = Date.now;
  const cache2 = new Cache(2, { ttl: 100, now });
  cache2.set('x', 10);
  cache2.set('y', 20);
  console.log('get(x):', cache2.get('x')); // Should be 10
  console.log('has(x):', cache2.has('x')); // Should be true
  console.log('size:', cache2.size()); // Should be 2
  console.log('keys:', cache2.keys()); // Should be ['x', 'y']
  
  // Test 3: TTL with override in set
  console.log('\nTest 3: TTL with override in set');
  const cache3 = new Cache(2, { ttl: 1000, now });
  cache3.set('p', 100, { ttl: 50 }); // Override TTL to 50ms
  console.log('get(p):', cache3.get('p')); // Should be 100
  console.log('has(p):', cache3.has('p')); // Should be true
  console.log('size:', cache3.size()); // Should be 1
  console.log('keys:', cache3.keys()); // Should be ['p']
  
  // Test 4: Expired entries should be treated as missing
  console.log('\nTest 4: Expired entries should be treated as missing');
  const cache4 = new Cache(2, { ttl: 1, now });
  cache4.set('expired', 'value');
  // Wait a bit to let it expire
  setTimeout(() => {
    console.log('get(expired):', cache4.get('expired')); // Should be undefined
    console.log('has(expired):', cache4.has('expired')); // Should be false
    console.log('size:', cache4.size()); // Should be 0
    console.log('keys:', cache4.keys()); // Should be []
    console.log('All tests completed');
  }, 10);
}

runTests();