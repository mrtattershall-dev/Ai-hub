const { Matrix } = require('./s3_matrix.js');

// Test add method
console.log("Testing add method...");

// Test 1: Valid addition
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const m2 = new Matrix([[5, 6], [7, 8]]);
  const result = m1.add(m2);
  const expected = [[6, 8], [10, 12]];
  const actual = result.toArray();
  
  console.log("Test 1 - Valid addition:");
  console.log("Expected:", expected);
  console.log("Actual  :", actual);
  console.log("Pass    :", JSON.stringify(expected) === JSON.stringify(actual));
} catch (e) {
  console.log("Test 1 - Valid addition: FAIL -", e.message);
}

// Test 2: Shape mismatch
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const m2 = new Matrix([[5, 6, 7], [8, 9, 10]]);
  m1.add(m2);
  console.log("Test 2 - Shape mismatch: FAIL - Should have thrown error");
} catch (e) {
  console.log("Test 2 - Shape mismatch: PASS -", e.message);
}

// Test 3: Non-Matrix operand
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  m1.add("not a matrix");
  console.log("Test 3 - Non-Matrix operand: FAIL - Should have thrown error");
} catch (e) {
  console.log("Test 3 - Non-Matrix operand: PASS -", e.message);
}

// Test sub method
console.log("\nTesting sub method...");

// Test 4: Valid subtraction
try {
  const m1 = new Matrix([[10, 8], [6, 4]]);
  const m2 = new Matrix([[5, 4], [3, 2]]);
  const result = m1.sub(m2);
  const expected = [[5, 4], [3, 2]];
  const actual = result.toArray();
  
  console.log("Test 4 - Valid subtraction:");
  console.log("Expected:", expected);
  console.log("Actual  :", actual);
  console.log("Pass    :", JSON.stringify(expected) === JSON.stringify(actual));
} catch (e) {
  console.log("Test 4 - Valid subtraction: FAIL -", e.message);
}

// Test 5: Shape mismatch for subtraction
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const m2 = new Matrix([[5, 6, 7], [8, 9, 10]]);
  m1.sub(m2);
  console.log("Test 5 - Subtraction shape mismatch: FAIL - Should have thrown error");
} catch (e) {
  console.log("Test 5 - Subtraction shape mismatch: PASS -", e.message);
}

// Test 6: Verify original matrices unchanged
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const m2 = new Matrix([[5, 6], [7, 8]]);
  const original1 = m1.toArray();
  const original2 = m2.toArray();
  m1.add(m2);
  const after1 = m1.toArray();
  const after2 = m2.toArray();
  
  const unchanged1 = JSON.stringify(original1) === JSON.stringify(after1);
  const unchanged2 = JSON.stringify(original2) === JSON.stringify(after2);
  
  console.log("Test 6 - Original matrices unchanged:");
  console.log("Matrix 1 unchanged:", unchanged1);
  console.log("Matrix 2 unchanged:", unchanged2);
  console.log("Pass:", unchanged1 && unchanged2);
} catch (e) {
  console.log("Test 6 - Original matrices unchanged: FAIL -", e.message);
}

console.log("\nAll tests completed.");
// Test mul method
console.log("\nTesting mul method...");

// Test 7: Scalar multiplication
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const result = m1.mul(2);
  const expected = [[2, 4], [6, 8]];
  const actual = result.toArray();
  
  console.log("Test 7 - Scalar multiplication:");
  console.log("Expected:", expected);
  console.log("Actual  :", actual);
  console.log("Pass    :", JSON.stringify(expected) === JSON.stringify(actual));
} catch (e) {
  console.log("Test 7 - Scalar multiplication: FAIL -", e.message);
}

// Test 8: Matrix multiplication
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const m2 = new Matrix([[5, 6], [7, 8]]);
  const result = m1.mul(m2);
  const expected = [[19, 22], [43, 50]];
  const actual = result.toArray();
  
  console.log("Test 8 - Matrix multiplication:");
  console.log("Expected:", expected);
  console.log("Actual  :", actual);
  console.log("Pass    :", JSON.stringify(expected) === JSON.stringify(actual));
} catch (e) {
  console.log("Test 8 - Matrix multiplication: FAIL -", e.message);
}

// Test 9: Matrix multiplication with incompatible dimensions
try {
  const m1 = new Matrix([[1, 2, 3], [4, 5, 6]]); // 2x3
  const m2 = new Matrix([[7, 8], [9, 10]]); // 2x2
  m1.mul(m2);
  console.log("Test 9 - Incompatible dimensions: FAIL - Should have thrown error");
} catch (e) {
  console.log("Test 9 - Incompatible dimensions: PASS -", e.message);
}

// Test 10: Invalid operand type
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  m1.mul("not a number or matrix");
  console.log("Test 10 - Invalid operand type: FAIL - Should have thrown error");
} catch (e) {
  console.log("Test 10 - Invalid operand type: PASS -", e.message);
}

console.log("\nAll tests completed.");
// Test transpose method
console.log("\nTesting transpose method...");

// Test 11: Valid transpose
try {
  const m1 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  const result = m1.transpose();
  const expected = [[1, 4], [2, 5], [3, 6]];
  const actual = result.toArray();
  
  console.log("Test 11 - Valid transpose:");
  console.log("Expected:", expected);
  console.log("Actual  :", actual);
  console.log("Pass    :", JSON.stringify(expected) === JSON.stringify(actual));
} catch (e) {
  console.log("Test 11 - Valid transpose: FAIL -", e.message);
}

// Test 12: Transpose of square matrix
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const result = m1.transpose();
  const expected = [[1, 3], [2, 4]];
  const actual = result.toArray();
  
  console.log("Test 12 - Transpose of square matrix:");
  console.log("Expected:", expected);
  console.log("Actual  :", actual);
  console.log("Pass    :", JSON.stringify(expected) === JSON.stringify(actual));
} catch (e) {
  console.log("Test 12 - Transpose of square matrix: FAIL -", e.message);
}

// Test identity method
console.log("\nTesting identity method...");

// Test 13: Valid identity matrix
try {
  const result = Matrix.identity(3);
  const expected = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const actual = result.toArray();
  
  console.log("Test 13 - Valid identity matrix:");
  console.log("Expected:", expected);
  console.log("Actual  :", actual);
  console.log("Pass    :", JSON.stringify(expected) === JSON.stringify(actual));
} catch (e) {
  console.log("Test 13 - Valid identity matrix: FAIL -", e.message);
}

// Test 14: Identity matrix with size 1
try {
  const result = Matrix.identity(1);
  const expected = [[1]];
  const actual = result.toArray();
  
  console.log("Test 14 - Identity matrix with size 1:");
  console.log("Expected:", expected);
  console.log("Actual  :", actual);
  console.log("Pass    :", JSON.stringify(expected) === JSON.stringify(actual));
} catch (e) {
  console.log("Test 14 - Identity matrix with size 1: FAIL -", e.message);
}

// Test 15: Invalid identity matrix (non-positive integer)
try {
  Matrix.identity(0);
  console.log("Test 15 - Invalid identity matrix (zero): FAIL - Should have thrown error");
} catch (e) {
  console.log("Test 15 - Invalid identity matrix (zero): PASS -", e.message);
}

// Test 16: Invalid identity matrix (negative integer)
try {
  Matrix.identity(-1);
  console.log("Test 16 - Invalid identity matrix (negative): FAIL - Should have thrown error");
} catch (e) {
  console.log("Test 16 - Invalid identity matrix (negative): PASS -", e.message);
}

// Test 17: Invalid identity matrix (non-integer)
try {
  Matrix.identity(2.5);
  console.log("Test 17 - Invalid identity matrix (non-integer): FAIL - Should have thrown error");
} catch (e) {
  console.log("Test 17 - Invalid identity matrix (non-integer): PASS -", e.message);
}

// Test 18: Invalid identity matrix (string)
try {
  Matrix.identity("3");
  console.log("Test 18 - Invalid identity matrix (string): FAIL - Should have thrown error");
} catch (e) {
  console.log("Test 18 - Invalid identity matrix (string): PASS -", e.message);
}

console.log("\nAll tests completed.");
console.log("\nTesting equals method...");

// Test 19: Equal matrices
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const m2 = new Matrix([[1, 2], [3, 4]]);
  const result = m1.equals(m2);
  
  console.log("Test 19 - Equal matrices:");
  console.log("Result:", result);
  console.log("Pass:", result === true);
} catch (e) {
  console.log("Test 19 - Equal matrices: FAIL -", e.message);
}

// Test 20: Different matrices
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const m2 = new Matrix([[5, 6], [7, 8]]);
  const result = m1.equals(m2);
  
  console.log("Test 20 - Different matrices:");
  console.log("Result:", result);
  console.log("Pass:", result === false);
} catch (e) {
  console.log("Test 20 - Different matrices: FAIL -", e.message);
}

// Test 21: Matrices with different shapes
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const m2 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  const result = m1.equals(m2);
  
  console.log("Test 21 - Matrices with different shapes:");
  console.log("Result:", result);
  console.log("Pass:", result === false);
} catch (e) {
  console.log("Test 21 - Matrices with different shapes: FAIL -", e.message);
}

// Test 22: Matrices with small differences (within epsilon)
try {
  const m1 = new Matrix([[1.0, 2.0], [3.0, 4.0]]);
  const m2 = new Matrix([[1.000000001, 2.000000001], [3.000000001, 4.000000001]]);
  const result = m1.equals(m2);
  
  console.log("Test 22 - Matrices with small differences (within epsilon):");
  console.log("Result:", result);
  console.log("Pass:", result === true);
} catch (e) {
  console.log("Test 22 - Matrices with small differences (within epsilon): FAIL -", e.message);
}

// Test 23: Matrices with large differences (outside epsilon)
try {
  const m1 = new Matrix([[1.0, 2.0], [3.0, 4.0]]);
  const m2 = new Matrix([[1.000001, 2.000001], [3.000001, 4.000001]]);
  const result = m1.equals(m2);
  
  console.log("Test 23 - Matrices with large differences (outside epsilon):");
  console.log("Result:", result);
  console.log("Pass:", result === false);
} catch (e) {
  console.log("Test 23 - Matrices with large differences (outside epsilon): FAIL -", e.message);
}

// Test 24: Non-Matrix operand
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const result = m1.equals("not a matrix");
  
  console.log("Test 24 - Non-Matrix operand:");
  console.log("Result:", result);
  console.log("Pass:", result === false);
} catch (e) {
  console.log("Test 24 - Non-Matrix operand: FAIL -", e.message);
}

console.log("\nAll tests completed.");
// Test determinant method
console.log("\nTesting determinant method...");

// Test 1: 1x1 matrix
try {
  const m1 = new Matrix([[5]]);
  const result = m1.determinant();
  const expected = 5;
  
  console.log("Test 1 - 1x1 matrix:");
  console.log("Expected:", expected);
  console.log("Actual  :", result);
  console.log("Pass    :", result === expected);
} catch (e) {
  console.log("Test 1 - 1x1 matrix: FAIL -", e.message);
}

// Test 2: 2x2 matrix
try {
  const m1 = new Matrix([[1, 2], [3, 4]]);
  const result = m1.determinant();
  const expected = 1*4 - 2*3; // = 4 - 6 = -2
  
  console.log("Test 2 - 2x2 matrix:");
  console.log("Expected:", expected);
  console.log("Actual  :", result);
  console.log("Pass    :", result === expected);
} catch (e) {
  console.log("Test 2 - 2x2 matrix: FAIL -", e.message);
}

// Test 3: 3x3 matrix
try {
  const m1 = new Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
  const result = m1.determinant();
  // Using cofactor expansion along first row:
  // 1 * (5*9 - 6*8) - 2 * (4*9 - 6*7) + 3 * (4*8 - 5*7)
  // = 1 * (45 - 48) - 2 * (36 - 42) + 3 * (32 - 35)
  // = 1 * (-3) - 2 * (-6) + 3 * (-3)
  // = -3 + 12 - 9 = 0
  const expected = 0;
  
  console.log("Test 3 - 3x3 matrix:");
  console.log("Expected:", expected);
  console.log("Actual  :", result);
  console.log("Pass    :", result === expected);
} catch (e) {
  console.log("Test 3 - 3x3 matrix: FAIL -", e.message);
}

// Test 4: Non-square matrix
try {
  const m1 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  m1.determinant();
  console.log("Test 4 - Non-square matrix: FAIL - Should have thrown error");
} catch (e) {
  console.log("Test 4 - Non-square matrix: PASS -", e.message);
}

// Test 5: Another 3x3 matrix with non-zero determinant
try {
  const m1 = new Matrix([[2, -3, 1], [2, 0, -1], [1, 4, 5]]);
  const result = m1.determinant();
  // Using cofactor expansion along first row:
  // 2 * (0*5 - (-1)*4) - (-3) * (2*5 - (-1)*1) + 1 * (2*4 - 0*1)
  // = 2 * (0 + 4) + 3 * (10 + 1) + 1 * (8 - 0)
  // = 2 * 4 + 3 * 11 + 1 * 8
  // = 8 + 33 + 8 = 49
  const expected = 49;
  
  console.log("Test 5 - Another 3x3 matrix:");
  console.log("Expected:", expected);
  console.log("Actual  :", result);
  console.log("Pass    :", result === expected);
} catch (e) {
  console.log("Test 5 - Another 3x3 matrix: FAIL -", e.message);
}
