const { Matrix } = require('./s3_matrix.js');

// Test determinant for 1x1 matrix
console.log("Testing 1x1 matrix...");
const matrix1x1 = new Matrix([[5]]);
console.log("Determinant of [[5]]:", matrix1x1.determinant());
console.assert(matrix1x1.determinant() === 5, "Determinant of 1x1 matrix should work");

// Test determinant for 2x2 matrix
console.log("Testing 2x2 matrix...");
const matrix2x2 = new Matrix([[1, 2], [3, 4]]);
console.log("Determinant of [[1,2],[3,4]]:", matrix2x2.determinant());
console.assert(matrix2x2.determinant() === -2, "Determinant of 2x2 matrix should work");

// Test determinant for 3x3 matrix
console.log("Testing 3x3 matrix...");
const matrix3x3 = new Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
console.log("Determinant of [[1,2,3],[4,5,6],[7,8,9]]:", matrix3x3.determinant());
console.assert(matrix3x3.determinant() === 0, "Determinant of 3x3 matrix should work");

// Test determinant error for non-square matrix
console.log("Testing error for non-square matrix...");
try {
  const nonSquare = new Matrix([[1, 2, 3], [4, 5, 6]]);
  nonSquare.determinant();
  console.assert(false, "Should have thrown an error for non-square matrix");
} catch (e) {
  console.log("Error for non-square matrix:", e.message);
  console.assert(e.message === "Determinant can only be calculated for square matrices", "Should throw correct error for non-square matrix");
}

console.log("All determinant tests passed!");