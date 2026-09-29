const assert = require('assert');
const Matrix = require('./s3_matrix.js');

// Test constructor
assert.throws(() => new Matrix(), Error, "No rows provided");
assert.throws(() => new Matrix([]), Error, "No rows provided");
assert.throws(() => new Matrix([[]]), Error, "Empty rows");
assert.throws(() => new Matrix([[1], [2, 3]]), Error, "Rows of different lengths");
assert.throws(() => new Matrix([[1, 'a'], [2, 3]]), Error, "Non-finite number");

// Test shape
const matrix = new Matrix([[1, 2], [3, 4]]);
assert.deepStrictEqual(matrix.shape(), [2, 2]);

// Test get
assert.strictEqual(matrix.get(0, 0), 1);
assert.strictEqual(matrix.get(1, 1), 4);
assert.throws(() => matrix.get(-1, 0), Error, "Index out of bounds");
assert.throws(() => matrix.get(0, 2), Error, "Index out of bounds");

// Test toArray
const matrixCopy = matrix.toArray();
assert.deepStrictEqual(matrixCopy, [[1, 2], [3, 4]]);
matrixCopy[0][0] = 10;
assert.notDeepStrictEqual(matrixCopy, matrix.rows);

console.log("All tests passed");
const Matrix = require('./s3_matrix.js');

describe('Matrix', () => {
  describe('add', () => {
    it('should add two matrices of the same shape', () => {
      const matrix1 = new Matrix([[1, 2], [3, 4]]);
      const matrix2 = new Matrix([[5, 6], [7, 8]]);
      const result = matrix1.add(matrix2);
      expect(result.toArray()).toEqual([[6, 8], [10, 12]]);
    });

    it('should throw an error when adding matrices of different shapes', () => {
      const matrix1 = new Matrix([[1, 2], [3, 4]]);
      const matrix2 = new Matrix([[5, 6]]);
      expect(() => matrix1.add(matrix2)).toThrow('Matrices must have the same shape');
    });
  });

  describe('sub', () => {
    it('should subtract two matrices of the same shape', () => {
      const matrix1 = new Matrix([[1, 2], [3, 4]]);
      const matrix2 = new Matrix([[5, 6], [7, 8]]);
      const result = matrix1.sub(matrix2);
      expect(result.toArray()).toEqual([[-4, -4], [-4, -4]]);
    });

    it('should throw an error when subtracting matrices of different shapes', () => {
      const matrix1 = new Matrix([[1, 2], [3, 4]]);
      const matrix2 = new Matrix([[5, 6]]);
      expect(() => matrix1.sub(matrix2)).toThrow('Matrices must have the same shape');
    });
  });
});
