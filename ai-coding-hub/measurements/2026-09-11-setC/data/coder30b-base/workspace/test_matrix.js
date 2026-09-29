// Test file for matrix module
const { add, multiply, transpose, identity, determinant, inverse } = require('./s4_matrix.js');

console.log("Running matrix module tests...");

// Test cases for matrix addition
console.log("Testing matrix addition...");

// Test 1: Valid addition
try {
  const a = [[1, 2], [3, 4]];
  const b = [[5, 6], [7, 8]];
  const result = add(a, b);
  console.log("Test 1 - Valid addition:", result);
  console.assert(JSON.stringify(result) === JSON.stringify([[6, 8], [10, 12]]), "Test 1 failed");
  console.log("Test 1 - PASSED");
} catch (e) {
  console.error("Test 1 failed with error:", e.message);
}

// Test 2: Addition with different dimensions (should throw error)
try {
  const a = [[1, 2, 3], [4, 5, 6]];
  const b = [[1, 2], [3, 4]];
  add(a, b);
  console.error("Test 2 failed - should have thrown an error");
} catch (e) {
  console.log("Test 2 - Correctly threw error for mismatched dimensions:", e.message);
  console.assert(e.message === "Matrix dimensions do not match for addition", "Test 2 failed with wrong error message");
  console.log("Test 2 - PASSED");
}

// Test 3: Addition with empty matrices (should throw error)
try {
  const a = [];
  const b = [[1, 2], [3, 4]];
  add(a, b);
  console.error("Test 3 failed - should have thrown an error");
} catch (e) {
  console.log("Test 3 - Correctly threw error for empty matrix:", e.message);
  console.assert(e.message === "Cannot add empty matrices", "Test 3 failed with wrong error message");
  console.log("Test 3 - PASSED");
}

// Test cases for matrix multiplication
console.log("\nTesting matrix multiplication...");

// Test 4: Valid multiplication
try {
  const a = [[1, 2], [3, 4]];
  const b = [[5, 6], [7, 8]];
  const result = multiply(a, b);
  console.log("Test 4 - Valid multiplication:", result);
  console.assert(JSON.stringify(result) === JSON.stringify([[19, 22], [43, 50]]), "Test 4 failed");
  console.log("Test 4 - PASSED");
} catch (e) {
  console.error("Test 4 failed with error:", e.message);
}

// Test 5: Multiplication with incompatible dimensions (should throw error)
try {
  const a = [[1, 2, 3], [4, 5, 6]];
  const b = [[1, 2], [3, 4]];
  multiply(a, b);
  console.error("Test 5 failed - should have thrown an error");
} catch (e) {
  console.log("Test 5 - Correctly threw error for incompatible dimensions:", e.message);
  console.assert(e.message === "Matrix dimensions are incompatible for multiplication", "Test 5 failed with wrong error message");
  console.log("Test 5 - PASSED");
}

// Test 6: Multiplication with empty matrices (should throw error)
try {
  const a = [];
  const b = [[1, 2], [3, 4]];
  multiply(a, b);
  console.error("Test 6 failed - should have thrown an error");
} catch (e) {
  console.log("Test 6 - Correctly threw error for empty matrix:", e.message);
  console.assert(e.message === "Cannot multiply empty matrices", "Test 6 failed with wrong error message");
  console.log("Test 6 - PASSED");
}

// Test 7: Valid multiplication with 3x3 matrices
try {
  const a = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  const b = [[9, 8, 7], [6, 5, 4], [3, 2, 1]];
  const result = multiply(a, b);
  console.log("Test 7 - Valid 3x3 multiplication:", result);
  console.assert(JSON.stringify(result) === JSON.stringify([[30, 24, 18], [84, 69, 54], [138, 114, 90]]), "Test 7 failed");
  console.log("Test 7 - PASSED");
} catch (e) {
  console.error("Test 7 failed with error:", e.message);
}

console.log("\nAll tests completed successfully!");
// Test cases for matrix transpose
console.log("\nTesting matrix transpose...");

// Test 8: Valid transpose
try {
  const m = [[1, 2, 3], [4, 5, 6]];
  const result = transpose(m);
  console.log("Test 8 - Valid transpose:", result);
  console.assert(JSON.stringify(result) === JSON.stringify([[1, 4], [2, 5], [3, 6]]), "Test 8 failed");
  console.log("Test 8 - PASSED");
} catch (e) {
  console.error("Test 8 failed with error:", e.message);
}

// Test 9: Transpose of square matrix
try {
  const m = [[1, 2], [3, 4]];
  const result = transpose(m);
  console.log("Test 9 - Transpose of square matrix:", result);
  console.assert(JSON.stringify(result) === JSON.stringify([[1, 3], [2, 4]]), "Test 9 failed");
  console.log("Test 9 - PASSED");
} catch (e) {
  console.error("Test 9 failed with error:", e.message);
}

// Test 10: Transpose of single row matrix
try {
  const m = [[1, 2, 3, 4]];
  const result = transpose(m);
  console.log("Test 10 - Transpose of single row matrix:", result);
  console.assert(JSON.stringify(result) === JSON.stringify([[1], [2], [3], [4]]), "Test 10 failed");
  console.log("Test 10 - PASSED");
} catch (e) {
  console.error("Test 10 failed with error:", e.message);
}

// Test 11: Transpose of single column matrix
try {
  const m = [[1], [2], [3], [4]];
  const result = transpose(m);
  console.log("Test 11 - Transpose of single column matrix:", result);
  console.assert(JSON.stringify(result) === JSON.stringify([[1, 2, 3, 4]]), "Test 11 failed");
  console.log("Test 11 - PASSED");
} catch (e) {
  console.error("Test 11 failed with error:", e.message);
}

// Test 12: Transpose with empty matrix (should throw error)
try {
  const m = [];
  transpose(m);
  console.error("Test 12 failed - should have thrown an error");
} catch (e) {
  console.log("Test 12 - Correctly threw error for empty matrix:", e.message);
  console.assert(e.message === "Cannot transpose empty matrix", "Test 12 failed with wrong error message");
  console.log("Test 12 - PASSED");
}

// Test cases for identity matrix
console.log("\nTesting identity matrix...");

// Test 13: Valid identity matrix 2x2
try {
  const result = identity(2);
  console.log("Test 13 - 2x2 identity matrix:", result);
  console.assert(JSON.stringify(result) === JSON.stringify([[1, 0], [0, 1]]), "Test 13 failed");
  console.log("Test 13 - PASSED");
} catch (e) {
  console.error("Test 13 failed with error:", e.message);
}

// Test 14: Valid identity matrix 3x3
try {
  const result = identity(3);
  console.log("Test 14 - 3x3 identity matrix:", result);
  console.assert(JSON.stringify(result) === JSON.stringify([[1, 0, 0], [0, 1, 0], [0, 0, 1]]), "Test 14 failed");
  console.log("Test 14 - PASSED");
} catch (e) {
  console.error("Test 14 failed with error:", e.message);
}

// Test 15: Identity matrix with invalid size (should throw error)
try {
  identity(0);
  console.error("Test 15 failed - should have thrown an error");
} catch (e) {
  console.log("Test 15 - Correctly threw error for invalid size:", e.message);
  console.assert(e.message === "Matrix size must be a positive integer", "Test 15 failed with wrong error message");
  console.log("Test 15 - PASSED");
}

// Test 16: Identity matrix with negative size (should throw error)
try {
  identity(-1);
  console.error("Test 16 failed - should have thrown an error");
} catch (e) {
  console.log("Test 16 - Correctly threw error for negative size:", e.message);
  console.assert(e.message === "Matrix size must be a positive integer", "Test 16 failed with wrong error message");
  console.log("Test 16 - PASSED");
}

console.log("\nAll tests completed successfully!");
// Test cases for determinant
console.log("\nTesting determinant...");

// Test 17: Valid determinant of 1x1 matrix
try {
  const m = [[5]];
  const result = determinant(m);
  console.log("Test 17 - Determinant of 1x1 matrix:", result);
  console.assert(result === 5, "Test 17 failed");
  console.log("Test 17 - PASSED");
} catch (e) {
  console.error("Test 17 failed with error:", e.message);
}

// Test 18: Valid determinant of 2x2 matrix
try {
  const m = [[1, 2], [3, 4]];
  const result = determinant(m);
  console.log("Test 18 - Determinant of 2x2 matrix:", result);
  console.assert(result === -2, "Test 18 failed");
  console.log("Test 18 - PASSED");
} catch (e) {
  console.error("Test 18 failed with error:", e.message);
}

// Test 19: Valid determinant of 3x3 matrix
try {
  const m = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
  const result = determinant(m);
  console.log("Test 19 - Determinant of 3x3 matrix:", result);
  console.assert(result === 0, "Test 19 failed");
  console.log("Test 19 - PASSED");
} catch (e) {
  console.error("Test 19 failed with error:", e.message);
}

// Test 20: Valid determinant of 3x3 matrix with non-zero result
try {
  const m = [[2, -3, 1], [2, 0, -1], [1, 4, 5]];
  const result = determinant(m);
  console.log("Test 20 - Determinant of 3x3 matrix with non-zero result:", result);
  console.assert(result === 49, "Test 20 failed");
  console.log("Test 20 - PASSED");
} catch (e) {
  console.error("Test 20 failed with error:", e.message);
}

// Test 21: Determinant of non-square matrix (should throw error)
try {
  const m = [[1, 2, 3], [4, 5, 6]];
  determinant(m);
  console.error("Test 21 failed - should have thrown an error");
} catch (e) {
  console.log("Test 21 - Correctly threw error for non-square matrix:", e.message);
  console.assert(e.message === "Matrix must be square to calculate determinant", "Test 21 failed with wrong error message");
  console.log("Test 21 - PASSED");
}

// Test 22: Determinant of empty matrix (should throw error)
try {
  const m = [];
  determinant(m);
  console.error("Test 22 failed - should have thrown an error");
} catch (e) {
  console.log("Test 22 - Correctly threw error for empty matrix:", e.message);
  console.assert(e.message === "Cannot calculate determinant of empty matrix", "Test 22 failed with wrong error message");
  console.log("Test 22 - PASSED");
}

console.log("\nAll tests completed successfully!");
console.log("\nTesting inverse...");

// Test 23: Valid inverse of 1x1 matrix
try {
  const m = [[4]];
  const result = inverse(m);
  console.log("Test 23 - Inverse of 1x1 matrix:", result);
  // Check if multiplying matrix with its inverse gives identity
  const identityCheck = multiply(m, result);
  console.log("Test 23 - Matrix * Inverse:", identityCheck);
  console.assert(Math.abs(identityCheck[0][0] - 1) < 1e-10, "Test 23 failed - inverse not correct");
  console.log("Test 23 - PASSED");
} catch (e) {
  console.error("Test 23 failed with error:", e.message);
}

// Test 24: Valid inverse of 2x2 matrix
try {
  const m = [[2, 1], [1, 1]];
  const result = inverse(m);
  console.log("Test 24 - Inverse of 2x2 matrix:", result);
  // Check if multiplying matrix with its inverse gives identity
  const identityCheck = multiply(m, result);
  console.log("Test 24 - Matrix * Inverse:", identityCheck);
  console.assert(Math.abs(identityCheck[0][0] - 1) < 1e-10 && 
                 Math.abs(identityCheck[0][1]) < 1e-10 && 
                 Math.abs(identityCheck[1][0]) < 1e-10 && 
                 Math.abs(identityCheck[1][1] - 1) < 1e-10, 
                 "Test 24 failed - inverse not correct");
  console.log("Test 24 - PASSED");
} catch (e) {
  console.error("Test 24 failed with error:", e.message);
}

// Test 25: Valid inverse of 3x3 matrix
try {
  const m = [[2, -3, 1], [2, 0, -1], [1, 4, 5]];
  const result = inverse(m);
  console.log("Test 25 - Inverse of 3x3 matrix:", result);
  // Check if multiplying matrix with its inverse gives identity
  const identityCheck = multiply(m, result);
  console.log("Test 25 - Matrix * Inverse:", identityCheck);
  // Check each element against identity matrix (allowing for small floating point errors)
  console.assert(Math.abs(identityCheck[0][0] - 1) < 1e-10 && 
                 Math.abs(identityCheck[0][1]) < 1e-10 && 
                 Math.abs(identityCheck[0][2]) < 1e-10 && 
                 Math.abs(identityCheck[1][0]) < 1e-10 && 
                 Math.abs(identityCheck[1][1] - 1) < 1e-10 && 
                 Math.abs(identityCheck[1][2]) < 1e-10 && 
                 Math.abs(identityCheck[2][0]) < 1e-10 && 
                 Math.abs(identityCheck[2][1]) < 1e-10 && 
                 Math.abs(identityCheck[2][2] - 1) < 1e-10, 
                 "Test 25 failed - inverse not correct");
  console.log("Test 25 - PASSED");
} catch (e) {
  console.error("Test 25 failed with error:", e.message);
}

// Test 26: Inverse of singular matrix (should throw error)
try {
  const m = [[1, 2], [2, 4]]; // This matrix has determinant 0
  inverse(m);
  console.error("Test 26 failed - should have thrown an error");
} catch (e) {
  console.log("Test 26 - Correctly threw error for singular matrix:", e.message);
  console.assert(e.message === "Matrix is singular (determinant is zero) and has no inverse", "Test 26 failed with wrong error message");
  console.log("Test 26 - PASSED");
}

// Test 27: Inverse of non-square matrix (should throw error)
try {
  const m = [[1, 2, 3], [4, 5, 6]];
  inverse(m);
  console.error("Test 27 failed - should have thrown an error");
} catch (e) {
  console.log("Test 27 - Correctly threw error for non-square matrix:", e.message);
  console.assert(e.message === "Matrix must be square to calculate inverse", "Test 27 failed with wrong error message");
  console.log("Test 27 - PASSED");
}

// Test 28: Inverse of empty matrix (should throw error)
try {
  const m = [];
  inverse(m);
  console.error("Test 28 failed - should have thrown an error");
} catch (e) {
  console.log("Test 28 - Correctly threw error for empty matrix:", e.message);
  console.assert(e.message === "Cannot calculate inverse of empty matrix", "Test 28 failed with wrong error message");
  console.log("Test 28 - PASSED");
}

console.log("\nAll tests completed successfully!");
