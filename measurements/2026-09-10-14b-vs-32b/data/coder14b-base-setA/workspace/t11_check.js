const assert = require('assert');
const { cToF, fToC, kToC } = require('./t1_temp.js');
const { mergeIntervals } = require('./t4_intervals.js');

// Test cToF function
assert.strictEqual(cToF(0), 32);
assert.strictEqual(cToF(100), 212);

// Test fToC function
assert.strictEqual(fToC(32), 0);
assert.strictEqual(fToC(212), 100);

// Test kToC function
assert.strictEqual(kToC(273.15), 0);
assert.strictEqual(kToC(373.15), 100);

// Test mergeIntervals function
assert.deepStrictEqual(mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);
assert.deepStrictEqual(mergeIntervals([[1, 4], [4, 5]]), [[1, 5]]);
assert.deepStrictEqual(mergeIntervals([[1, 4]]), [[1, 4]]);

console.log('All tests passed!');