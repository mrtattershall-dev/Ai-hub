const assert = require('assert');
const Matrix = require('./s3_matrix.js');

// Test constructor
assert.throws(() => new Matrix(), Error, "No rows provided");
assert.throws(() => new Matrix([]), Error, "No rows provided");
assert.throws(() => new Matrix([[]]), Error, "Empty rows");
assert.throws(() => new Matrix([[1], [2, 3]]), Error, "Rows of different lengths");
assert.throws(() => new Matrix([[1, 'a'], [2, 3]]), Error, "Non-finite number");
assert.throws(() => new Matrix([[1, 2], [3, NaN]]), Error, "Non-finite number");
assert.throws(() => new Matrix([[1, 2], [3, Infinity]]), Error, "Non-finite number");
assert.throws(() => new Matrix([[1, 2], [3, -Infinity]]), Error, "Non-finite number");

// Test valid matrix
const matrix = new Matrix([[1, 2], [3, 4]]);
assert.deepStrictEqual(matrix.rows, [[1, 2], [3, 4]]);

console.log("All tests passed");