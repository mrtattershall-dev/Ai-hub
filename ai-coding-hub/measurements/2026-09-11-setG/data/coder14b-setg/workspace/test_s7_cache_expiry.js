const Cache = require('./s7_cache.js');

const cache = new Cache(2, { ttl: 1000, now: Date.now });

cache.set('key1', 'value1', { ttl: 2000 });
cache.set('key2', 'value2');

console.log('Initial cache:', cache.peek('key1'), cache.peek('key2')); // Should print: value1 value2

setTimeout(() => {
  console.log('After 1 second:', cache.peek('key1'), cache.peek('key2')); // Should print: value1 value2
}, 1000);

setTimeout(() => {
  console.log('After 2 seconds:', cache.peek('key1'), cache.peek('key2')); // Should print: undefined value2
}, 2000);

setTimeout(() => {
  console.log('After 3 seconds:', cache.peek('key1'), cache.peek('key2')); // Should print: undefined value2
}, 3000);