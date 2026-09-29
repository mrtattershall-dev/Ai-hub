const { Matrix } = require('./s3_matrix.js');

// Test the equals method
function testEquals() {
  console.log("Testing equals method...");
  
  // Test equal matrices
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  const matrix2 = new Matrix([[1, 2], [3, 4]]);
  console.log("Equal matrices:", matrix1.equals(matrix2)); // Should be true
  
  // Test different matrices
  const matrix3 = new Matrix([[1, 2], [3, 5]]);
  console.log("Different matrices:", matrix1.equals(matrix3)); // Should be false
  
  // Test matrices with tolerance
  const matrix4 = new Matrix([[1.000000001, 2], [3, 4]]);
  console.log("Near-equal matrices (default eps):", matrix1.equals(matrix4)); // Should be true
  
  // Test matrices with tolerance
  console.log("Near-equal matrices (small eps):", matrix1.equals(matrix4, 1e-10)); // Should be false
  
  // Test different shapes
  const matrix5 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  console.log("Different shapes:", matrix1.equals(matrix5)); // Should be false
  
  // Test with non-matrix
  console.log("With non-matrix:", matrix1.equals("not a matrix")); // Should be false
  
  console.log("All tests completed.");
}

testEquals();
// Test the inverse method
function testInverse() {
  console.log("Testing inverse method...");
  
  // Test 1x1 matrix
  const matrix1 = new Matrix([[5]]);
  const inv1 = matrix1.inverse();
  console.log("1x1 inverse:", inv1.get(0, 0)); // Should be 1/5 = 0.2
  console.log("1x1 inverse check:", matrix1.multiply(inv1).equals(Matrix.identity(1))); // Should be true
  
  // Test 2x2 matrix
  const matrix2 = new Matrix([[4, 7], [2, 6]]);
  const inv2 = matrix2.inverse();
  console.log("2x2 inverse:");
  console.log("  [", inv2.get(0, 0), ",", inv2.get(0, 1), "]");
  console.log("  [", inv2.get(1, 0), ",", inv2.get(1, 1), "]");
  
  // Check that matrix * inverse = identity
  const check2 = matrix2.multiply(inv2);
  console.log("2x2 inverse check:", check2.equals(Matrix.identity(2))); // Should be true
  
  // Test non-square matrix (should throw error)
  const matrix3 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  try {
    matrix3.inverse();
    console.log("ERROR: Non-square matrix should have thrown");
  } catch (e) {
    console.log("Non-square matrix correctly threw error:", e.message);
  }
  
  // Test singular matrix (determinant = 0, should throw error)
  const matrix4 = new Matrix([[2, 4], [1, 2]]);
  try {
    matrix4.inverse();
    console.log("ERROR: Singular matrix should have thrown");
  } catch (e) {
    console.log("Singular matrix correctly threw error:", e.message);
  }
  
  console.log("All inverse tests completed.");
}

testInverse();
