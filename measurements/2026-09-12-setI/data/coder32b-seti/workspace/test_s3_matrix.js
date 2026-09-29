const Matrix = require('./s3_matrix.js');

// Test add method
const matrix1 = new Matrix([[1, 2], [3, 4]]);
const matrix2 = new Matrix([[5, 6], [7, 8]]);
const resultAdd = matrix1.add(matrix2);
console.log('Add Result:', resultAdd.toArray()); // Expected: [[6, 8], [10, 12]]

// Test sub method
const resultSub = matrix1.sub(matrix2);
console.log('Sub Result:', resultSub.toArray()); // Expected: [[-4, -4], [-4, -4]]

// Test error for different shapes
try {
  const matrix3 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  matrix1.add(matrix3);
} catch (error) {
  console.log('Error:', error.message); // Expected: Matrices must have the same shape
}

try {
  matrix1.sub(matrix3);
} catch (error) {
  console.log('Error:', error.message); // Expected: Matrices must have the same shape
}