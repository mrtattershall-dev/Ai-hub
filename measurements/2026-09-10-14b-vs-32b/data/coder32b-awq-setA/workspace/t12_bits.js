function countBits(n) {
    if (n < 0) throw new Error("Input must be a non-negative integer");
    let count = 0;
    while (n) {
        count += n & 1;
        n >>= 1;
    }
    return count;
}

module.exports = { countBits };
function isPowerOfTwo(n) {
    if (n < 0) throw new Error("Input must be a non-negative integer");
    return n !== 0 && (n & (n - 1)) === 0;
}

module.exports = { countBits, isPowerOfTwo };
const assert = require('assert');

// Test countBits
assert.strictEqual(countBits(0), 0, 'countBits(0) should be 0');
assert.strictEqual(countBits(1), 1, 'countBits(1) should be 1');
assert.strictEqual(countBits(2), 1, 'countBits(2) should be 1');
assert.strictEqual(countBits(3), 2, 'countBits(3) should be 2');
assert.strictEqual(countBits(4), 1, 'countBits(4) should be 1');
assert.strictEqual(countBits(5), 2, 'countBits(5) should be 2');
assert.strictEqual(countBits(6), 2, 'countBits(6) should be 2');
assert.strictEqual(countBits(7), 3, 'countBits(7) should be 3');
assert.strictEqual(countBits(8), 1, 'countBits(8) should be 1');
assert.strictEqual(countBits(9), 2, 'countBits(9) should be 2');
assert.strictEqual(countBits(10), 2, 'countBits(10) should be 2');
assert.strictEqual(countBits(15), 4, 'countBits(15) should be 4');
assert.strictEqual(countBits(16), 1, 'countBits(16) should be 1');
assert.strictEqual(countBits(31), 5, 'countBits(31) should be 5');
assert.strictEqual(countBits(32), 1, 'countBits(32) should be 1');
assert.strictEqual(countBits(64), 1, 'countBits(64) should be 1');
assert.strictEqual(countBits(128), 1, 'countBits(128) should be 1');
assert.strictEqual(countBits(255), 8, 'countBits(255) should be 8');
assert.strictEqual(countBits(256), 1, 'countBits(256) should be 1');
// Test isPowerOfTwo
assert.strictEqual(isPowerOfTwo(0), false, 'isPowerOfTwo(0) should be false');
assert.strictEqual(isPowerOfTwo(1), true, 'isPowerOfTwo(1) should be true');
assert.strictEqual(isPowerOfTwo(2), true, 'isPowerOfTwo(2) should be true');
assert.strictEqual(isPowerOfTwo(3), false, 'isPowerOfTwo(3) should be false');
assert.strictEqual(isPowerOfTwo(4), true, 'isPowerOfTwo(4) should be true');
assert.strictEqual(isPowerOfTwo(5), false, 'isPowerOfTwo(5) should be false');
assert.strictEqual(isPowerOfTwo(6), false, 'isPowerOfTwo(6) should be false');
assert.strictEqual(isPowerOfTwo(7), false, 'isPowerOfTwo(7) should be false');
assert.strictEqual(isPowerOfTwo(8), true, 'isPowerOfTwo(8) should be true');
assert.strictEqual(isPowerOfTwo(9), false, 'isPowerOfTwo(9) should be false');
assert.strictEqual(isPowerOfTwo(10), false, 'isPowerOfTwo(10) should be false');
assert.strictEqual(isPowerOfTwo(16), true, 'isPowerOfTwo(16) should be true');
assert.strictEqual(isPowerOfTwo(31), false, 'isPowerOfTwo(31) should be false');
assert.strictEqual(isPowerOfTwo(32), true, 'isPowerOfTwo(32) should be true');
assert.strictEqual(isPowerOfTwo(64), true, 'isPowerOfTwo(64) should be true');
assert.strictEqual(isPowerOfTwo(128), true, 'isPowerOfTwo(128) should be true');
assert.strictEqual(isPowerOfTwo(255), false, 'isPowerOfTwo(255) should be false');
assert.strictEqual(isPowerOfTwo(256), true, 'isPowerOfTwo(256) should be true');
