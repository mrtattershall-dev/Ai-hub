function mergeIntervals(intervals) {
    if (intervals.length === 0) return [];

    // Sort intervals based on the start time
    intervals.sort((a, b) => a[0] - b[0]);

    let merged = [intervals[0]];

    for (let i = 1; i < intervals.length; i++) {
        let currentInterval = intervals[i];
        let lastMergedInterval = merged[merged.length - 1];
if (currentInterval[0] <= lastMergedInterval[1]) {
    // Overlapping intervals, merge them
    lastMergedInterval[1] = Math.max(lastMergedInterval[1], currentInterval[1]);
} else {
    // Non-overlapping intervals, add to merged list
    merged.push(currentInterval);
}
    }

    return merged;
}

module.exports = { mergeIntervals };
const assert = require('assert');

function testMergeIntervals() {
    assert.deepStrictEqual(mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);
    assert.deepStrictEqual(mergeIntervals([[1, 4], [4, 5]]), [[1, 5]]);
    assert.deepStrictEqual(mergeIntervals([[1, 2], [3, 4], [5, 6]]), [[1, 2], [3, 4], [5, 6]]);
    assert.deepStrictEqual(mergeIntervals([[1, 7], [8, 10], [12, 16], [15, 18]]), [[1, 18]]);
    assert.deepStrictEqual(mergeIntervals([]), []);
    assert.deepStrictEqual(mergeIntervals([[1, 1]]), [[1, 1]]);
    console.log("All tests passed!");
}

testMergeIntervals();
assert.deepStrictEqual(mergeIntervals([[2, 6], [1, 3], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);
assert.deepStrictEqual(mergeIntervals([[2, 6], [1, 3], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);
assert.deepStrictEqual(mergeIntervals([[2, 6], [1, 3], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);
