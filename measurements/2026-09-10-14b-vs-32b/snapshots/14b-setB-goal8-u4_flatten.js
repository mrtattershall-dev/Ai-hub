module.exports = {
  flatten: function(obj, parentKey = '', result = {}) {
    for (const key in obj) {
      const newKey = parentKey ? `${parentKey}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        flatten(obj[key], newKey, result);
      } else {
        result[newKey] = obj[key];
      }
    }
    return result;
  }
};
// Remove duplicate declaration
const { flatten } = require('./u4_flatten');

// Test cases
const testCases = [
  { input: { a: { b: 1 } }, expected: { 'a.b': 1 } },
  { input: { a: { b: { c: 2 } } }, expected: { 'a.b.c': 2 } },
  { input: { a: 1, b: { c: 2 } }, expected: { a: 1, 'b.c': 2 } },
  { input: { a: { b: 1 }, c: 2 }, expected: { 'a.b': 1, c: 2 } },
  { input: { a: { b: { c: { d: 3 } } } }, expected: { 'a.b.c.d': 3 } }
];

// Run tests
testCases.forEach(({ input, expected }, index) => {
  const result = flatten(input);
  assert.deepStrictEqual(result, expected, `Test case ${index + 1} failed`);
});

console.log('All tests passed!');
const assert = require('assert');

// Test case for { a: [1, 2] }
const input = { a: [1, 2] };
const expectedOutput = { a0: 1, a1: 2 };
const result = flatten(input);

assert.deepStrictEqual(result, expectedOutput, 'Flatten function did not produce the expected output');
