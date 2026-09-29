// Test file for Matrix determinant method
const { Matrix } = require('./s3_matrix.js');

// Test 1x1 matrix
try {
  const m1 = new Matrix([[5]]);
  console.log("1x1 matrix determinant:", m1.determinant());
} catch (e) {
  console.log("Error with 1x1 matrix:", e.message);
}

// Test 2x2 matrix
try {
  const m2 = new Matrix([[1, 2], [3, 4]]);
  console.log("2x2 matrix determinant:", m2.determinant());
} catch (e) {
  console.log("Error with 2x2 matrix:", e.message);
}

// Test 3x3 matrix
try {
  const m3 = new Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
  console.log("3x3 matrix determinant:", m3.determinant());
} catch (e) {
  console.log("Error with 3x3 matrix:", e.message);
}

// Test non-square matrix (should throw error)
try {
  const m4 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  console.log("Non-square matrix determinant:", m4.determinant());
} catch (e) {
  console.log("Error with non-square matrix (expected):", e.message);
}

// Test 4x4 matrix
try {
  const m5 = new Matrix([[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]);
  console.log("4x4 matrix determinant:", m5.determinant());
} catch (e) {
  console.log("Error with 4x4 matrix:", e.message);
}