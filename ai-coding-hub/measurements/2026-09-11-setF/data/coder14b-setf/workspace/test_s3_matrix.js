const Matrix = require('./s3_matrix.js');

// Test scalar multiplication
const matrix1 = new Matrix([[1, 2], [3, 4]]);
const scalar = 2;
const result1 = matrix1.mul(scalar);
console.assert(result1.rows[0][0] === 2, 'Test 1 failed');
console.assert(result1.rows[0][1] === 4, 'Test 2 failed');
console.assert(result1.rows[1][0] === 6, 'Test 3 failed');
console.assert(result1.rows[1][1] === 8, 'Test 4 failed');

// Test matrix multiplication
const matrix2 = new Matrix([[2, 0], [1, 2]]);
const result2 = matrix1.mul(matrix2);
console.assert(result2.rows[0][0] === 4, 'Test 5 failed');
console.assert(result2.rows[0][1] === 4, 'Test 6 failed');
console.assert(result2.rows[1][0] === 10, 'Test 7 failed');
console.assert(result2.rows[1][1] === 8, 'Test 8 failed');

// Test error for inner dimensions not matching
try {
  const matrix3 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  const matrix4 = new Matrix([[1, 2], [3, 4]]);
  matrix3.mul(matrix4);
  console.assert(false, 'Test 9 failed');
} catch (e) {
  console.assert(e.message === 'Inner dimensions do not match', 'Test 9 failed');
}

console.log('All tests passed');