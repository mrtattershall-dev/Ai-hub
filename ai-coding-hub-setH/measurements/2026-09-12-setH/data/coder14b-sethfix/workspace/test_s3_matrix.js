const { Matrix } = require('./s3_matrix.js');

// Test cases
const matrix1 = new Matrix([[1, 2], [3, 4]]);
const matrix2 = new Matrix([[1, 2], [3, 4]]);
const matrix3 = new Matrix([[1, 2], [3, 5]]);
const matrix4 = new Matrix([[1, 2], [3, 4, 5]]);

console.log(matrix1.equals(matrix2)); // true
console.log(matrix1.equals(matrix3)); // false
console.log(matrix1.equals(matrix4)); // false