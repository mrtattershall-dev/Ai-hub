// Test file for Matrix add and sub methods
const { Matrix } = require('./s3_matrix.js');

// Test case 1: Valid addition
console.log("Test 1: Valid addition");
try {
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  const matrix2 = new Matrix([[5, 6], [7, 8]]);
  const result = matrix1.add(matrix2);
  const expected = [[6, 8], [10, 12]];
  
  console.assert(result.shape()[0] === 2, "Result should have 2 rows");
  console.assert(result.shape()[1] === 2, "Result should have 2 columns");
  
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      console.assert(result.get(i, j) === expected[i][j], `Result[${i}][${j}] should be ${expected[i][j]}`);
    }
  }
  
  console.log("✅ Test 1 passed");
} catch (e) {
  console.error("❌ Test 1 failed:", e.message);
}

// Test case 2: Valid subtraction
console.log("Test 2: Valid subtraction");
try {
  const matrix1 = new Matrix([[10, 8], [6, 4]]);
  const matrix2 = new Matrix([[5, 3], [2, 1]]);
  const result = matrix1.sub(matrix2);
  const expected = [[5, 5], [4, 3]];
  
  console.assert(result.shape()[0] === 2, "Result should have 2 rows");
  console.assert(result.shape()[1] === 2, "Result should have 2 columns");
  
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      console.assert(result.get(i, j) === expected[i][j], `Result[${i}][${j}] should be ${expected[i][j]}`);
    }
  }
  
  console.log("✅ Test 2 passed");
} catch (e) {
  console.error("❌ Test 2 failed:", e.message);
}

// Test case 3: Shape mismatch for addition
console.log("Test 3: Shape mismatch for addition");
try {
  const matrix1 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  const matrix2 = new Matrix([[1, 2], [3, 4]]);
  matrix1.add(matrix2);
  console.error("❌ Test 3 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "Matrix shapes must match for addition", "Should throw correct error for shape mismatch");
  console.log("✅ Test 3 passed");
}

// Test case 4: Shape mismatch for subtraction
console.log("Test 4: Shape mismatch for subtraction");
try {
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  const matrix2 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  matrix1.sub(matrix2);
  console.error("❌ Test 4 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "Matrix shapes must match for subtraction", "Should throw correct error for shape mismatch");
  console.log("✅ Test 4 passed");
}

// Test case 5: Non-Matrix operand for addition
console.log("Test 5: Non-Matrix operand for addition");
try {
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  matrix1.add("not a matrix");
  console.error("❌ Test 5 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "Operand must be a Matrix", "Should throw correct error for non-Matrix operand");
  console.log("✅ Test 5 passed");
}

// Test case 6: Non-Matrix operand for subtraction
console.log("Test 6: Non-Matrix operand for subtraction");
try {
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  matrix1.sub("not a matrix");
  console.error("❌ Test 6 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "Operand must be a Matrix", "Should throw correct error for non-Matrix operand");
  console.log("✅ Test 6 passed");
}

// Test case 7: Original matrices unchanged after operations
console.log("Test 7: Original matrices unchanged after operations");
try {
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  const matrix2 = new Matrix([[5, 6], [7, 8]]);
  const original1 = matrix1.toArray();
  const original2 = matrix2.toArray();
  
  matrix1.add(matrix2);
  
  console.assert(JSON.stringify(matrix1.toArray()) === JSON.stringify(original1), "First matrix should be unchanged");
  console.assert(JSON.stringify(matrix2.toArray()) === JSON.stringify(original2), "Second matrix should be unchanged");
  
  console.log("✅ Test 7 passed");
} catch (e) {
  console.error("❌ Test 7 failed:", e.message);
}

console.log("All tests completed!");

// Test case 1: Valid addition
console.log("Test 1: Valid addition");
try {
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  const matrix2 = new Matrix([[5, 6], [7, 8]]);
  const result = matrix1.add(matrix2);
  const expected = [[6, 8], [10, 12]];
  
  console.assert(result.shape()[0] === 2, "Result should have 2 rows");
  console.assert(result.shape()[1] === 2, "Result should have 2 columns");
  
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      console.assert(result.get(i, j) === expected[i][j], `Result[${i}][${j}] should be ${expected[i][j]}`);
    }
  }
  
  console.log("✅ Test 1 passed");
} catch (e) {
  console.error("❌ Test 1 failed:", e.message);
}

// Test case 2: Valid subtraction
console.log("Test 2: Valid subtraction");
try {
  const matrix1 = new Matrix([[10, 8], [6, 4]]);
  const matrix2 = new Matrix([[5, 3], [2, 1]]);
  const result = matrix1.sub(matrix2);
  const expected = [[5, 5], [4, 3]];
  
  console.assert(result.shape()[0] === 2, "Result should have 2 rows");
  console.assert(result.shape()[1] === 2, "Result should have 2 columns");
  
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      console.assert(result.get(i, j) === expected[i][j], `Result[${i}][${j}] should be ${expected[i][j]}`);
    }
  }
  
  console.log("✅ Test 2 passed");
} catch (e) {
  console.error("❌ Test 2 failed:", e.message);
}

// Test case 3: Shape mismatch for addition
console.log("Test 3: Shape mismatch for addition");
try {
  const matrix1 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  const matrix2 = new Matrix([[1, 2], [3, 4]]);
  matrix1.add(matrix2);
  console.error("❌ Test 3 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "Matrix shapes must match for addition", "Should throw correct error for shape mismatch");
  console.log("✅ Test 3 passed");
}

// Test case 4: Shape mismatch for subtraction
console.log("Test 4: Shape mismatch for subtraction");
try {
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  const matrix2 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  matrix1.sub(matrix2);
  console.error("❌ Test 4 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "Matrix shapes must match for subtraction", "Should throw correct error for shape mismatch");
  console.log("✅ Test 4 passed");
}

// Test case 5: Non-Matrix operand for addition
console.log("Test 5: Non-Matrix operand for addition");
try {
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  matrix1.add("not a matrix");
  console.error("❌ Test 5 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "Operand must be a Matrix", "Should throw correct error for non-Matrix operand");
  console.log("✅ Test 5 passed");
}

// Test case 6: Non-Matrix operand for subtraction
console.log("Test 6: Non-Matrix operand for subtraction");
try {
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  matrix1.sub("not a matrix");
  console.error("❌ Test 6 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "Operand must be a Matrix", "Should throw correct error for non-Matrix operand");
  console.log("✅ Test 6 passed");
}

// Test case 7: Original matrices unchanged after operations
console.log("Test 7: Original matrices unchanged after operations");
try {
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  const matrix2 = new Matrix([[5, 6], [7, 8]]);
  const original1 = matrix1.toArray();
  const original2 = matrix2.toArray();
  
  matrix1.add(matrix2);
  
  console.assert(JSON.stringify(matrix1.toArray()) === JSON.stringify(original1), "First matrix should be unchanged");
  console.assert(JSON.stringify(matrix2.toArray()) === JSON.stringify(original2), "Second matrix should be unchanged");
  
  console.log("✅ Test 7 passed");
} catch (e) {
  console.error("❌ Test 7 failed:", e.message);
}

console.log("All tests completed!");
// Test case 8: Scalar multiplication
console.log("Test 8: Scalar multiplication");
try {
  const matrix = new Matrix([[1, 2], [3, 4]]);
  const result = matrix.mul(3);
  const expected = [[3, 6], [9, 12]];
  
  console.assert(result.shape()[0] === 2, "Result should have 2 rows");
  console.assert(result.shape()[1] === 2, "Result should have 2 columns");
  
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      console.assert(result.get(i, j) === expected[i][j], `Result[${i}][${j}] should be ${expected[i][j]}`);
    }
  }
  
  console.log("✅ Test 8 passed");
} catch (e) {
  console.error("❌ Test 8 failed:", e.message);
}

// Test case 9: Matrix multiplication
console.log("Test 9: Matrix multiplication");
try {
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  const matrix2 = new Matrix([[5, 6], [7, 8]]);
  const result = matrix1.mul(matrix2);
  const expected = [[19, 22], [43, 50]];
  
  console.assert(result.shape()[0] === 2, "Result should have 2 rows");
  console.assert(result.shape()[1] === 2, "Result should have 2 columns");
  
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      console.assert(result.get(i, j) === expected[i][j], `Result[${i}][${j}] should be ${expected[i][j]}`);
    }
  }
  
  console.log("✅ Test 9 passed");
} catch (e) {
  console.error("❌ Test 9 failed:", e.message);
}

// Test case 10: Matrix multiplication with incompatible dimensions
console.log("Test 10: Matrix multiplication with incompatible dimensions");
try {
  const matrix1 = new Matrix([[1, 2, 3], [4, 5, 6]]); // 2x3
  const matrix2 = new Matrix([[1, 2], [3, 4]]); // 2x2
  matrix1.mul(matrix2);
  console.error("❌ Test 10 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "Inner dimensions must match for matrix multiplication", "Should throw correct error for incompatible dimensions");
  console.log("✅ Test 10 passed");
}

// Test case 11: Invalid operand for multiplication
console.log("Test 11: Invalid operand for multiplication");
try {
  const matrix = new Matrix([[1, 2], [3, 4]]);
  matrix.mul("not a number or matrix");
  console.error("❌ Test 11 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "Operand must be a number or a Matrix", "Should throw correct error for invalid operand");
  console.log("✅ Test 11 passed");
}
// Test case 12: Static identity method with valid input
console.log("Test 12: Static identity method with valid input");
try {
  const identityMatrix = Matrix.identity(3);
  console.assert(identityMatrix.shape()[0] === 3, "Identity matrix should have 3 rows");
  console.assert(identityMatrix.shape()[1] === 3, "Identity matrix should have 3 columns");
  
  // Check that it's actually an identity matrix
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const expected = i === j ? 1 : 0;
      console.assert(identityMatrix.get(i, j) === expected, `Identity[${i}][${j}] should be ${expected}`);
    }
  }
  
  console.log("✅ Test 12 passed");
} catch (e) {
  console.error("❌ Test 12 failed:", e.message);
}

// Test case 13: Static identity method with invalid input (non-positive integer)
console.log("Test 13: Static identity method with invalid input (non-positive integer)");
try {
  Matrix.identity(0);
  console.error("❌ Test 13 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "n must be a positive integer", "Should throw correct error for non-positive integer");
  console.log("✅ Test 13 passed");
}

// Test case 14: Static identity method with invalid input (non-integer)
console.log("Test 14: Static identity method with invalid input (non-integer)");
try {
  Matrix.identity(2.5);
  console.error("❌ Test 14 failed: Should have thrown an error");
} catch (e) {
  console.assert(e.message === "n must be a positive integer", "Should throw correct error for non-integer");
  console.log("✅ Test 14 passed");
}

// Test case 15: Transpose method
console.log("Test 15: Transpose method");
try {
  const matrix = new Matrix([[1, 2, 3], [4, 5, 6]]);
  const transposed = matrix.transpose();
  
  console.assert(transposed.shape()[0] === 3, "Transposed matrix should have 3 rows");
  console.assert(transposed.shape()[1] === 2, "Transposed matrix should have 2 columns");
  
  // Check the values
  const expected = [[1, 4], [2, 5], [3, 6]];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      console.assert(transposed.get(i, j) === expected[i][j], `Transposed[${i}][${j}] should be ${expected[i][j]}`);
    }
  }
  
  console.log("✅ Test 15 passed");
} catch (e) {
  console.error("❌ Test 15 failed:", e.message);
}

// Test case 16: Transpose of transpose should equal original
console.log("Test 16: Transpose of transpose should equal original");
try {
  const matrix = new Matrix([[1, 2, 3], [4, 5, 6]]);
  const transposed = matrix.transpose();
  const doubleTransposed = transposed.transpose();
  
  console.assert(doubleTransposed.shape()[0] === matrix.shape()[0], "Double transpose should have same rows as original");
  console.assert(doubleTransposed.shape()[1] === matrix.shape()[1], "Double transpose should have same columns as original");
  
  // Check that values are the same
  for (let i = 0; i < matrix.shape()[0]; i++) {
    for (let j = 0; j < matrix.shape()[1]; j++) {
      console.assert(doubleTransposed.get(i, j) === matrix.get(i, j), `Double transpose[${i}][${j}] should equal original[${i}][${j}]`);
    }
  }
  
  console.log("✅ Test 16 passed");
} catch (e) {
  console.error("❌ Test 16 failed:", e.message);
}
