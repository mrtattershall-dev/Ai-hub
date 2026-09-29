// Test file for Matrix class methods: add and sub
const { Matrix } = require('./s3_matrix.js');

// Test basic addition
console.log("Testing basic addition...");
const matrix1 = new Matrix([
  [1, 2],
  [3, 4]
]);

const matrix2 = new Matrix([
  [5, 6],
  [7, 8]
]);

const resultAdd = matrix1.add(matrix2);
const expectedAdd = [
  [6, 8],
  [10, 12]
];

console.assert(resultAdd.shape()[0] === 2 && resultAdd.shape()[1] === 2, "Result should be 2x2 matrix");
for (let i = 0; i < 2; i++) {
  for (let j = 0; j < 2; j++) {
    console.assert(resultAdd.get(i, j) === expectedAdd[i][j], `Element at (${i},${j}) should be ${expectedAdd[i][j]}`);
  }
}

// Test basic subtraction
console.log("Testing basic subtraction...");
const resultSub = matrix1.sub(matrix2);
const expectedSub = [
  [-4, -4],
  [-4, -4]
];

console.assert(resultSub.shape()[0] === 2 && resultSub.shape()[1] === 2, "Result should be 2x2 matrix");
for (let i = 0; i < 2; i++) {
  for (let j = 0; j < 2; j++) {
    console.assert(resultSub.get(i, j) === expectedSub[i][j], `Element at (${i},${j}) should be ${expectedSub[i][j]}`);
  }
}

// Test that original matrices are not modified
console.log("Testing that original matrices are not modified...");
console.assert(matrix1.get(0, 0) === 1, "Original matrix1 should not be modified");
console.assert(matrix2.get(0, 0) === 5, "Original matrix2 should not be modified");

// Test error case: different shapes
console.log("Testing error case for different shapes...");
try {
  const matrix3 = new Matrix([[1, 2, 3]]);
  matrix1.add(matrix3);
  console.assert(false, "Should have thrown an error for different shapes");
} catch (e) {
  console.assert(e.message === "Matrices must have the same shape for addition", "Should throw correct error for different shapes");
}

try {
  const matrix3 = new Matrix([[1, 2, 3]]);
  matrix1.sub(matrix3);
  console.assert(false, "Should have thrown an error for different shapes");
} catch (e) {
  console.assert(e.message === "Matrices must have the same shape for subtraction", "Should throw correct error for different shapes");
}

// Test error case: non-Matrix parameter
console.log("Testing error case for non-Matrix parameter...");
try {
  matrix1.add("not a matrix");
  console.assert(false, "Should have thrown an error for non-Matrix parameter");
} catch (e) {
  console.assert(e.message === "other must be a Matrix", "Should throw correct error for non-Matrix parameter");
}

try {
  matrix1.sub("not a matrix");
  console.assert(false, "Should have thrown an error for non-Matrix parameter");
} catch (e) {
  console.assert(e.message === "other must be a Matrix", "Should throw correct error for non-Matrix parameter");
}

console.log("All tests passed!");
// Test scalar multiplication
console.log("Testing scalar multiplication...");
const scalarResult = matrix1.mul(2);
const expectedScalar = [
  [2, 4],
  [6, 8]
];

console.assert(scalarResult.shape()[0] === 2 && scalarResult.shape()[1] === 2, "Result should be 2x2 matrix");
for (let i = 0; i < 2; i++) {
  for (let j = 0; j < 2; j++) {
    console.assert(scalarResult.get(i, j) === expectedScalar[i][j], `Element at (${i},${j}) should be ${expectedScalar[i][j]}`);
  }
}

// Test matrix multiplication
console.log("Testing matrix multiplication...");
const matrix3 = new Matrix([
  [1, 2],
  [3, 4]
]);

const matrix4 = new Matrix([
  [5, 6],
  [7, 8]
]);

const matrixMultResult = matrix3.mul(matrix4);
const expectedMatrixMult = [
  [19, 22],
  [43, 50]
];

console.assert(matrixMultResult.shape()[0] === 2 && matrixMultResult.shape()[1] === 2, "Result should be 2x2 matrix");
for (let i = 0; i < 2; i++) {
  for (let j = 0; j < 2; j++) {
    console.assert(matrixMultResult.get(i, j) === expectedMatrixMult[i][j], `Element at (${i},${j}) should be ${expectedMatrixMult[i][j]}`);
  }
}

// Test error case: incompatible dimensions for matrix multiplication
console.log("Testing error case for incompatible dimensions...");
try {
  const matrix5 = new Matrix([[1, 2, 3]]);
  const matrix6 = new Matrix([[1, 2], [3, 4]]);
  matrix5.mul(matrix6);
  console.assert(false, "Should have thrown an error for incompatible dimensions");
} catch (e) {
  console.assert(e.message === "Inner dimensions must match for matrix multiplication", "Should throw correct error for incompatible dimensions");
}

// Test error case: invalid argument type
console.log("Testing error case for invalid argument type...");
try {
  matrix1.mul("not a number or matrix");
  console.assert(false, "Should have thrown an error for invalid argument type");
} catch (e) {
  console.assert(e.message === "mul(x) expects a number or Matrix as argument", "Should throw correct error for invalid argument type");
}

console.log("All tests passed!");
// Test static identity method
console.log("Testing static identity method...");
const identityMatrix = Matrix.identity(3);
console.assert(identityMatrix.shape()[0] === 3 && identityMatrix.shape()[1] === 3, "Identity matrix should be 3x3");
for (let i = 0; i < 3; i++) {
  for (let j = 0; j < 3; j++) {
    if (i === j) {
      console.assert(identityMatrix.get(i, j) === 1, `Diagonal element at (${i},${j}) should be 1`);
    } else {
      console.assert(identityMatrix.get(i, j) === 0, `Non-diagonal element at (${i},${j}) should be 0`);
    }
  }
}

// Test error case for identity method
try {
  Matrix.identity(-1);
  console.assert(false, "Should have thrown an error for negative n");
} catch (e) {
  console.assert(e.message === "n must be a positive integer", "Should throw correct error for negative n");
}

try {
  Matrix.identity(0);
  console.assert(false, "Should have thrown an error for zero n");
} catch (e) {
  console.assert(e.message === "n must be a positive integer", "Should throw correct error for zero n");
}

try {
  Matrix.identity(2.5);
  console.assert(false, "Should have thrown an error for non-integer n");
} catch (e) {
  console.assert(e.message === "n must be a positive integer", "Should throw correct error for non-integer n");
}

try {
  Matrix.identity("not a number");
  console.assert(false, "Should have thrown an error for non-numeric n");
} catch (e) {
  console.assert(e.message === "n must be a positive integer", "Should throw correct error for non-numeric n");
}

// Test transpose method
console.log("Testing transpose method...");
const testMatrix = new Matrix([
  [1, 2, 3],
  [4, 5, 6]
]);
const transposed = testMatrix.transpose();
console.assert(transposed.shape()[0] === 3 && transposed.shape()[1] === 2, "Transposed matrix should be 3x2");
console.assert(transposed.get(0, 0) === 1, "Element at (0,0) should be 1");
console.assert(transposed.get(0, 1) === 4, "Element at (0,1) should be 4");
console.assert(transposed.get(1, 0) === 2, "Element at (1,0) should be 2");
console.assert(transposed.get(1, 1) === 5, "Element at (1,1) should be 5");
console.assert(transposed.get(2, 0) === 3, "Element at (2,0) should be 3");
console.assert(transposed.get(2, 1) === 6, "Element at (2,1) should be 6");

// Test that original matrix is not modified by transpose
console.assert(testMatrix.get(0, 0) === 1, "Original matrix should not be modified");
console.assert(testMatrix.get(1, 2) === 6, "Original matrix should not be modified");

console.log("All tests passed!");
