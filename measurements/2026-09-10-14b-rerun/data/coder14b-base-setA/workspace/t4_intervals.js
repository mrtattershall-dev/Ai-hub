function mergeIntervals(intervals) {
    if (intervals.length === 0) return [];

    intervals.sort((a, b) => a[0] - b[0]);

    let merged = [intervals[0]];

    for (let i = 1; i < intervals.length; i++) {
        let current = intervals[i];
        let lastMerged = merged[merged.length - 1];

        if (current[0] <= lastMerged[1]) {
            lastMerged[1] = Math.max(lastMerged[1], current[1]);
        } else {
            merged.push(current);
        }
    }

    return merged;
}

// Assertions
const assert = require('assert');

assert.deepStrictEqual(mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);
assert.deepStrictEqual(mergeIntervals([[1, 4], [4, 5]]), [[1, 5]]);
assert.deepStrictEqual(mergeIntervals([[1, 2], [3, 4], [5, 6]]), [[1, 2], [3, 4], [5, 6]]);
assert.deepStrictEqual(mergeIntervals([]), []);
assert.deepStrictEqual(mergeIntervals([[1, 1]]), [[1, 1]]);

console.log("All tests passed!");
function testMergeIntervals() {
    let intervals = [[1, 3], [2, 6], [8, 10], [15, 18]];
    let expected = [[1, 6], [8, 10], [15, 18]];
    let result = mergeIntervals(intervals);
    console.assert(JSON.stringify(result) === JSON.stringify(expected), `Test failed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`);
}

testMergeIntervals();
