const assert = require('assert');
const Matrix = require('./s3_matrix.js');

// Test cases will go here

function testMatrixConstructor() {
  assert.throws(() => new Matrix(), Error, "No rows provided");
  assert.throws(() => new Matrix([]), Error, "No rows provided");
  assert.throws(() => new Matrix([[]]), Error, "Empty rows provided");
  assert.throws(() => new Matrix([[1, 2], [3]]), Error, "Rows of different lengths or not arrays");
  assert.throws(() => new Matrix([[1, 2], [3, 'a']]), Error, "Non-finite number in matrix");
  assert.throws(() => new Matrix([[1, 2], [3, NaN]]), Error, "Non-finite number in matrix");
  assert.throws(() => new Matrix([[1, 2], [3, Infinity]]), Error, "Non-finite number in matrix");
  assert.throws(() => new Matrix([[1, 2], [3, -Infinity]]), Error, "Non-finite number in matrix");
  const matrix = new Matrix([[1, 2], [3, 4]]);
  assert.deepStrictEqual(matrix.rows, [[1, 2], [3, 4]]);
}

function testMatrixShape() {
  const matrix = new Matrix([[1, 2], [3, 4]]);
  assert.deepStrictEqual(matrix.shape(), [2, 2]);
}

function testMatrixGet() {
  const matrix = new Matrix([[1, 2], [3, 4]]);
  assert.strictEqual(matrix.get(0, 0), 1);
  assert.strictEqual(matrix.get(0, 1), 2);
  assert.strictEqual(matrix.get(1, 0), 3);
  assert.strictEqual(matrix.get(1, 1), 4);
  assert.throws(() => matrix.get(-1, 0), Error, "Out of bounds access");
  assert.throws(() => matrix.get(0, -1), Error, "Out of bounds access");
  assert.throws(() => matrix.get(2, 0), Error, "Out of bounds access");
  assert.throws(() => matrix.get(0, 2), Error, "Out of bounds access");
}

function testMatrixToArray() {
  const matrix = new Matrix([[1, 2], [3, 4]]);
  const array = matrix.toArray();
  assert.deepStrictEqual(array, [[1, 2], [3, 4]]);
  array[0][0] = 99;
  assert.notDeepStrictEqual(array, matrix.rows);
}

module.exports = {
  testMatrixConstructor,
  testMatrixShape,
  testMatrixGet,
  testMatrixToArray
};

function testMatrixConstructor() {
  // Test cases for constructor
}

function testMatrixShape() {
  // Test cases for shape
}

function testMatrixGet() {
  // Test cases for get
}

function testMatrixToArray() {
  // Test cases for toArray
}