const { Cache } = require('./s7_cache.js');

// Debug the exact sequence from the failing test
const cache = new Cache(2);
console.log("Initial cache:", cache.keys());

cache.set('a', 1);
console.log("After set('a', 1):", cache.keys());

cache.set('b', 2);
console.log("After set('b', 2):", cache.keys());

console.log("Peeking at 'a':", cache.peek('a'));
console.log("After peek('a'):", cache.keys());

cache.set('c', 3);
console.log("After set('c', 3):", cache.keys());

console.log("Getting 'b':", cache.get('b'));
console.log("Getting 'a':", cache.get('a'));