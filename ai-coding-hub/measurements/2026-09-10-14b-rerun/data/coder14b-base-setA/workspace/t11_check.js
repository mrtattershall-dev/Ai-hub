const assert = require('assert');
const t1_temp = require('./t1_temp.js');
const t4_intervals = require('./t4_intervals.js');

// Test functions from t1_temp.js
assert.strictEqual(t1_temp.cToF(0), 32);
assert.strictEqual(t1_temp.cToF(100), 212);
assert.strictEqual(t1_temp.cToF(-40), -40);

assert.strictEqual(t1_temp.fToC(32), 0);
assert.strictEqual(t1_temp.fToC(212), 100);
assert.strictEqual(t1_temp.fToC(-40), -40);

// Test functions from t4_intervals.js
assert.deepStrictEqual(t4_intervals.mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);
assert.deepStrictEqual(t4_intervals.mergeIntervals([[1, 4], [4, 5]]), [[1, 5]]);
assert.deepStrictEqual(t4_intervals.mergeIntervals([[1, 2], [3, 4], [5, 6]]), [[1, 2], [3, 4], [5, 6]]);
assert.deepStrictEqual(t4_intervals.mergeIntervals([]), []);
assert.deepStrictEqual(t4_intervals.mergeIntervals([[1, 1]]), [[1, 1]]);

console.log("All tests passed!");