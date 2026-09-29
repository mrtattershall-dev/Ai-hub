const Matrix = require('./s3_matrix.js');

// Test basic functionality
const matrix1 = new Matrix([[1, 2], [3, 4]]);
const matrix2 = new Matrix([[1, 2], [3, 4]]);
const matrix3 = new Matrix([[1, 2], [3, 5]]);
const matrix4 = new Matrix([[1, 2, 3], [4, 5, 6]]);

console.log("Testing equals method:");
console.log("Equal matrices:", matrix1.equals(matrix2));
console.log("Unequal matrices:", matrix1.equals(matrix3));
console.log("Different shapes:", matrix1.equals(matrix4));

// Test with custom epsilon - let's use a case where it should be true
const matrix5 = new Matrix([[1, 2], [3, 4.000000001]]);
console.log("Close values with epsilon 1e-6:", matrix1.equals(matrix5, 1e-6));
console.log("Close values with epsilon 1e-10:", matrix1.equals(matrix5, 1e-10));

// Test with non-matrix object
console.log("Equals with non-matrix:", matrix1.equals("not a matrix"));

console.log("Test completed");