const assert = require('assert');
const sort = require('./s14_sort.js');

const testCases = [
  { input: [3, 1, 2], expected: [1, 2, 3] },
  { input: [5, 3, 8, 4, 6], expected: [3, 4, 5, 6, 8] },
  { input: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1], expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { input: [1, 2, 3, 4, 5], expected: [1, 2, 3, 4, 5] },
  { input: [], expected: [] }
];

testCases.forEach(({ input, expected }, index) => {
  assert.deepStrictEqual(sort.mergeSort(input), expected, `Test case ${index + 1} failed for mergeSort`);
  assert.deepStrictEqual(sort.quickSort(input), expected, `Test case ${index + 1} failed for quickSort`);
  assert.deepStrictEqual(input.sort((a, b) => a - b), expected, `Test case ${index + 1} failed for Array.prototype.sort`);
});

console.log('All test cases passed!');