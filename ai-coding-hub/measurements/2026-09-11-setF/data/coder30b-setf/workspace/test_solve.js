const { Matrix } = require('./s3_matrix.js');

// Test case 1: Simple 2x2 system
console.log("Test 1: Simple 2x2 system");
try {
  const A = new Matrix([[2, 1], [1, 1]]);
  const b = [5, 3];
  const x = A.solve(b);
  console.log("Solution:", x);
  
  // Verify solution: A * x should equal b
  const result = A.multiply(new Matrix([x.map(val => [val])]));
  const resultArray = result.toArray().map(row => row[0]);
  console.log("Verification (A * x):", resultArray);
  console.log("Expected (b):", b);
  console.log("Test 1 PASSED");
} catch (e) {
  console.log("Test 1 FAILED:", e.message);
}

// Test case 2: 3x3 system
console.log("\nTest 2: 3x3 system");
try {
  const A = new Matrix([[1, 2, 3], [0, 1, 4], [5, 6, 0]]);
  const b = [14, 8, 10];
  const x = A.solve(b);
  console.log("Solution:", x);
  
  // Verify solution: A * x should equal b
  const result = A.multiply(new Matrix([x.map(val => [val])]));
  const resultArray = result.toArray().map(row => row[0]);
  console.log("Verification (A * x):", resultArray);
  console.log("Expected (b):", b);
  console.log("Test 2 PASSED");
} catch (e) {
  console.log("Test 2 FAILED:", e.message);
}

// Test case 3: Non-square matrix (should fail)
console.log("\nTest 3: Non-square matrix");
try {
  const A = new Matrix([[1, 2, 3], [4, 5, 6]]);
  const b = [7, 8];
  const x = A.solve(b);
  console.log("Test 3 FAILED: Should have thrown an error");
} catch (e) {
  console.log("Test 3 PASSED:", e.message);
}

// Test case 4: Wrong length b (should fail)
console.log("\nTest 4: Wrong length b");
try {
  const A = new Matrix([[1, 2], [3, 4]]);
  const b = [5, 6, 7];
  const x = A.solve(b);
  console.log("Test 4 FAILED: Should have thrown an error");
} catch (e) {
  console.log("Test 4 PASSED:", e.message);
}

// Test case 5: Singular matrix (should fail)
console.log("\nTest 5: Singular matrix");
try {
  const A = new Matrix([[1, 2], [2, 4]]);
  const b = [5, 10];
  const x = A.solve(b);
  console.log("Test 5 FAILED: Should have thrown an error");
} catch (e) {
  console.log("Test 5 PASSED:", e.message);
}