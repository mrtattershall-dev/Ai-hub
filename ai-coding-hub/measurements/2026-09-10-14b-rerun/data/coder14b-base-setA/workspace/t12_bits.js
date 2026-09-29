function countBits(n) {
  let count = 0;
  while (n > 0) {
    count += n & 1;
    n >>= 1;
  }
  return count;
}

module.exports = { countBits };
function isPowerOfTwo(n) {
  return n > 0 && (n & (n - 1)) === 0;
}

module.exports = { countBits, isPowerOfTwo };
const assert = require('assert');

// Test countBits(n)
assert.strictEqual(countBits(0), 0);
assert.strictEqual(countBits(1), 1);
assert.strictEqual(countBits(2), 1);
assert.strictEqual(countBits(3), 2);
assert.strictEqual(countBits(4), 1);
assert.strictEqual(countBits(5), 2);
assert.strictEqual(countBits(10), 2);
assert.strictEqual(countBits(15), 4);
assert.strictEqual(countBits(16), 1);
assert.strictEqual(countBits(31), 5);

// Test isPowerOfTwo(n)
assert.strictEqual(isPowerOfTwo(0), false);
assert.strictEqual(isPowerOfTwo(1), true);
assert.strictEqual(isPowerOfTwo(2), true);
assert.strictEqual(isPowerOfTwo(3), false);
assert.strictEqual(isPowerOfTwo(4), true);
assert.strictEqual(isPowerOfTwo(5), false);
assert.strictEqual(isPowerOfTwo(16), true);
assert.strictEqual(isPowerOfTwo(31), false);
assert.strictEqual(isPowerOfTwo(32), true);
assert.strictEqual(isPowerOfTwo(63), false);
