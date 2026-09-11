function mergeIntervals(intervals) {
    if (intervals.length <= 1) return intervals;

    intervals.sort((a, b) => a[0] - b[0]);

    const merged = [intervals[0]];

    for (let i = 1; i < intervals.length; i++) {
        const current = intervals[i];
        const lastMerged = merged[merged.length - 1];

        if (current[0] <= lastMerged[1]) {
            lastMerged[1] = Math.max(lastMerged[1], current[1]);
        } else {
            merged.push(current);
        }
    }

    return merged;
}

module.exports = { mergeIntervals };
const assert = require('assert');

// Test cases
assert.deepStrictEqual(mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);
assert.deepStrictEqual(mergeIntervals([[1, 4], [4, 5]]), [[1, 5]]);
assert.deepStrictEqual(mergeIntervals([[1, 4], [5, 6]]), [[1, 4], [5, 6]]);
assert.deepStrictEqual(mergeIntervals([[1, 4]]), [[1, 4]]);
assert.deepStrictEqual(mergeIntervals([]), []);
assert.deepStrictEqual(mergeIntervals([[1, 3], [6, 9]]), [[1, 3], [6, 9]]);
assert.deepStrictEqual(mergeIntervals([[2, 3], [4, 5], [6, 7], [8, 9], [1, 10]]), [[1, 10]]);

console.log("All tests passed.");
// Test case for unsorted intervals
const unsortedIntervals = [[2, 3], [1, 4], [5, 6]];
const expectedOutput = [[1, 4], [5, 6]];
assert.deepStrictEqual(mergeIntervals(unsortedIntervals), expectedOutput, 'mergeIntervals should handle unsorted intervals correctly');
