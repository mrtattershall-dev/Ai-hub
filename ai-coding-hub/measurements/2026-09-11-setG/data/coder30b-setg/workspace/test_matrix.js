// Test file for Matrix class
const Matrix = require('./s3_matrix.js');

// Test equals method
const matrix1 = new Matrix([[1, 2], [3, 4]]);
const matrix2 = new Matrix([[1, 2], [3, 4]]);
const matrix3 = new Matrix([[1, 2], [3, 5]]);
const matrix4 = new Matrix([[1, 2, 3], [4, 5, 6]]);

console.log("Testing equals method:");
console.log("Equal matrices:", matrix1.equals(matrix2));
console.log("Unequal matrices:", matrix1.equals(matrix3));
console.log("Different shapes:", matrix1.equals(matrix4));

// Test with epsilon - using values that should actually be true
const matrix5 = new Matrix([[1, 2], [3, 4.000000001]]);
console.log("Close values with epsilon 1e-6:", matrix5.equals(matrix1, 1e-6));
console.log("Close values with epsilon 1e-10:", matrix5.equals(matrix1, 1e-10));

console.log("Test completed");