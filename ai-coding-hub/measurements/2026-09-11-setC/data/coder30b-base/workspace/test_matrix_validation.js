const { add, multiply, transpose, identity, determinant, inverse } = require('./s4_matrix.js');

console.log("Testing matrix validation functions...");

// Test invalid inputs for add function
console.log("\n=== Testing add function validation ===");
try {
  add("not an array", [[1, 2], [3, 4]]);
  console.log("ERROR: add should have thrown for non-array first argument");
} catch (e) {
  console.log("✓ add correctly rejected non-array first argument:", e.message);
}

try {
  add([[1, 2], [3, 4]], "not an array");
  console.log("ERROR: add should have thrown for non-array second argument");
} catch (e) {
  console.log("✓ add correctly rejected non-array second argument:", e.message);
}

try {
  add([], [[1, 2], [3, 4]]);
  console.log("ERROR: add should have thrown for empty first matrix");
} catch (e) {
  console.log("✓ add correctly rejected empty first matrix:", e.message);
}

try {
  add([[1, 2], [3, 4]], []);
  console.log("ERROR: add should have thrown for empty second matrix");
} catch (e) {
  console.log("✓ add correctly rejected empty second matrix:", e.message);
}

try {
  add([[1, 2, 3], [4, 5, 6]], [[1, 2], [3, 4]]);
  console.log("ERROR: add should have thrown for mismatched dimensions");
} catch (e) {
  console.log("✓ add correctly rejected mismatched dimensions:", e.message);
}

// Test invalid inputs for multiply function
console.log("\n=== Testing multiply function validation ===");
try {
  multiply("not an array", [[1, 2], [3, 4]]);
  console.log("ERROR: multiply should have thrown for non-array first argument");
} catch (e) {
  console.log("✓ multiply correctly rejected non-array first argument:", e.message);
}

try {
  multiply([[1, 2], [3, 4]], "not an array");
  console.log("ERROR: multiply should have thrown for non-array second argument");
} catch (e) {
  console.log("✓ multiply correctly rejected non-array second argument:", e.message);
}

try {
  multiply([[1, 2], [3, 4]], [[1, 2, 3], [4, 5, 6]]);
  console.log("ERROR: multiply should have thrown for incompatible dimensions");
} catch (e) {
  console.log("✓ multiply correctly rejected incompatible dimensions:", e.message);
}

// Test invalid inputs for transpose function
console.log("\n=== Testing transpose function validation ===");
try {
  transpose("not an array");
  console.log("ERROR: transpose should have thrown for non-array argument");
} catch (e) {
  console.log("✓ transpose correctly rejected non-array argument:", e.message);
}

try {
  transpose([]);
  console.log("ERROR: transpose should have thrown for empty matrix");
} catch (e) {
  console.log("✓ transpose correctly rejected empty matrix:", e.message);
}

// Test invalid inputs for identity function
console.log("\n=== Testing identity function validation ===");
try {
  identity("not a number");
  console.log("ERROR: identity should have thrown for non-number argument");
} catch (e) {
  console.log("✓ identity correctly rejected non-number argument:", e.message);
}

try {
  identity(-1);
  console.log("ERROR: identity should have thrown for negative number");
} catch (e) {
  console.log("✓ identity correctly rejected negative number:", e.message);
}

try {
  identity(2.5);
  console.log("ERROR: identity should have thrown for non-integer");
} catch (e) {
  console.log("✓ identity correctly rejected non-integer:", e.message);
}

// Test invalid inputs for determinant function
console.log("\n=== Testing determinant function validation ===");
try {
  determinant("not an array");
  console.log("ERROR: determinant should have thrown for non-array argument");
} catch (e) {
  console.log("✓ determinant correctly rejected non-array argument:", e.message);
}

try {
  determinant([]);
  console.log("ERROR: determinant should have thrown for empty matrix");
} catch (e) {
  console.log("✓ determinant correctly rejected empty matrix:", e.message);
}

try {
  determinant([[1, 2], [3, 4, 5]]);
  console.log("ERROR: determinant should have thrown for irregular matrix");
} catch (e) {
  console.log("✓ determinant correctly rejected irregular matrix:", e.message);
}

// Test invalid inputs for inverse function
console.log("\n=== Testing inverse function validation ===");
try {
  inverse("not an array");
  console.log("ERROR: inverse should have thrown for non-array argument");
} catch (e) {
  console.log("✓ inverse correctly rejected non-array argument:", e.message);
}

try {
  inverse([]);
  console.log("ERROR: inverse should have thrown for empty matrix");
} catch (e) {
  console.log("✓ inverse correctly rejected empty matrix:", e.message);
}

try {
  inverse([[1, 2], [3, 4, 5]]);
  console.log("ERROR: inverse should have thrown for irregular matrix");
} catch (e) {
  console.log("✓ inverse correctly rejected irregular matrix:", e.message);
}

try {
  inverse([[1, 2], [2, 4]]); // Singular matrix (determinant = 0)
  console.log("ERROR: inverse should have thrown for singular matrix");
} catch (e) {
  console.log("✓ inverse correctly rejected singular matrix:", e.message);
}

console.log("\nAll validation tests completed!");