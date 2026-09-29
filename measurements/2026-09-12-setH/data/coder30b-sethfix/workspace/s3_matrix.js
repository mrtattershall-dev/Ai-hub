// Matrix class implementation
class Matrix {
  static identity(n) {
    if (typeof n !== 'number' || n <= 0 || !Number.isInteger(n)) {
      throw new Error('n must be a positive integer');
    }
    
    const rows = [];
    for (let i = 0; i < n; i++) {
      const row = [];
      for (let j = 0; j < n; j++) {
        row.push(i === j ? 1 : 0);
      }
      rows.push(row);
    }
    return new Matrix(rows);
  }
  
  constructor(rows) {
    // Validate input
    if (!Array.isArray(rows)) {
      throw new Error("rows must be an array");
    }
    
    if (rows.length === 0) {
      throw new Error("rows cannot be empty");
    }
    
    // Check each row
    for (let i = 0; i < rows.length; i++) {
      if (!Array.isArray(rows[i])) {
        throw new Error("each row must be an array");
      }
      
      if (rows[i].length === 0) {
        throw new Error("rows cannot be empty");
      }
      
      // Check if all rows have the same length
      if (i > 0 && rows[i].length !== rows[0].length) {
        throw new Error("all rows must have the same length");
      }
      
      // Check each element in the row
      for (let j = 0; j < rows[i].length; j++) {
        if (typeof rows[i][j] !== 'number' || !Number.isFinite(rows[i][j])) {
          throw new Error("all elements must be finite numbers");
        }
      }
    }
    
    this._rows = rows;
  }
  
  shape() {
    return [this._rows.length, this._rows[0].length];
  }
  
  get(r, c) {
    if (r < 0 || r >= this._rows.length || c < 0 || c >= this._rows[0].length) {
      throw new Error("index out of bounds");
    }
    return this._rows[r][c];
  }
  
  toArray() {
    // Return a copy of the rows
    return this._rows.map(row => [...row]);
  }
  
  add(other) {
    // Validate that other is a Matrix
    if (!(other instanceof Matrix)) {
      throw new Error("other must be a Matrix");
    }
    
    // Check if shapes match
    const thisShape = this.shape();
    const otherShape = other.shape();
    if (thisShape[0] !== otherShape[0] || thisShape[1] !== otherShape[1]) {
      throw new Error("Matrices must have the same shape for addition");
    }
    
    // Create result matrix
    const resultRows = [];
    for (let i = 0; i < thisShape[0]; i++) {
      const newRow = [];
      for (let j = 0; j < thisShape[1]; j++) {
        newRow.push(this.get(i, j) + other.get(i, j));
      }
      resultRows.push(newRow);
    }
    
    return new Matrix(resultRows);
  }
  
  sub(other) {
    // Validate that other is a Matrix
    if (!(other instanceof Matrix)) {
      throw new Error("other must be a Matrix");
    }
    
    // Check if shapes match
    const thisShape = this.shape();
    const otherShape = other.shape();
    if (thisShape[0] !== otherShape[0] || thisShape[1] !== otherShape[1]) {
      throw new Error("Matrices must have the same shape for subtraction");
    }
    
    // Create result matrix
    const resultRows = [];
    for (let i = 0; i < thisShape[0]; i++) {
      const newRow = [];
      for (let j = 0; j < thisShape[1]; j++) {
        newRow.push(this.get(i, j) - other.get(i, j));
      }
      resultRows.push(newRow);
    }
    
    return new Matrix(resultRows);
  }
  
  mul(x) {
    // Validate input
    if (typeof x === 'number') {
      // Scalar multiplication
      const resultRows = [];
      const thisShape = this.shape();
      for (let i = 0; i < thisShape[0]; i++) {
        const newRow = [];
        for (let j = 0; j < thisShape[1]; j++) {
          newRow.push(this.get(i, j) * x);
        }
        resultRows.push(newRow);
      }
      return new Matrix(resultRows);
    } else if (x instanceof Matrix) {
      // Matrix multiplication
      const thisShape = this.shape();
      const otherShape = x.shape();
      
      // Check if inner dimensions match
      if (thisShape[1] !== otherShape[0]) {
        throw new Error("Inner dimensions must match for matrix multiplication");
      }
      
      // Create result matrix
      const resultRows = [];
      for (let i = 0; i < thisShape[0]; i++) {
        const newRow = [];
        for (let j = 0; j < otherShape[1]; j++) {
          let sum = 0;
          for (let k = 0; k < thisShape[1]; k++) {
            sum += this.get(i, k) * x.get(k, j);
          }
          newRow.push(sum);
        }
        resultRows.push(newRow);
      }
      return new Matrix(resultRows);
    } else {
      throw new Error("mul(x) expects a number or Matrix as argument");
    }
  }
  
  transpose() {
    const thisShape = this.shape();
    const resultRows = [];
    for (let j = 0; j < thisShape[1]; j++) {
      const newRow = [];
      for (let i = 0; i < thisShape[0]; i++) {
        newRow.push(this.get(i, j));
      }
      resultRows.push(newRow);
    }
    return new Matrix(resultRows);
  }
  
  equals(other, eps = 1e-9) {
    // Validate that other is a Matrix
    if (!(other instanceof Matrix)) {
      return false;
    }
    
    // Check if shapes match
    const thisShape = this.shape();
    const otherShape = other.shape();
    if (thisShape[0] !== otherShape[0] || thisShape[1] !== otherShape[1]) {
      return false;
    }
    
    // Check each element with epsilon tolerance
    for (let i = 0; i < thisShape[0]; i++) {
      for (let j = 0; j < thisShape[1]; j++) {
        const diff = Math.abs(this.get(i, j) - other.get(i, j));
        if (diff > eps) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  determinant() {
    const shape = this.shape();
    const rows = shape[0];
    const cols = shape[1];
    
    // Check if matrix is square
    if (rows !== cols) {
      throw new Error("Determinant can only be calculated for square matrices");
    }
    
    // Base case: 1x1 matrix
    if (rows === 1) {
      return this.get(0, 0);
    }
    
    // Base case: 2x2 matrix
    if (rows === 2) {
      return this.get(0, 0) * this.get(1, 1) - this.get(0, 1) * this.get(1, 0);
    }
    
    // For larger matrices, use cofactor expansion along the first row
    let det = 0;
    for (let j = 0; j < cols; j++) {
      // Create minor matrix by removing row 0 and column j
      const minorRows = [];
      for (let i = 1; i < rows; i++) {
        const minorRow = [];
        for (let k = 0; k < cols; k++) {
          if (k !== j) {
            minorRow.push(this.get(i, k));
          }
        }
        minorRows.push(minorRow);
      }
      
      const minor = new Matrix(minorRows);
      const cofactor = Math.pow(-1, j) * this.get(0, j) * minor.determinant();
      det += cofactor;
    }
    
    return det;
  }
}

// Export the Matrix class
module.exports = { Matrix };

// Test asserts
const matrix = new Matrix([
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
]);

console.assert(matrix.shape()[0] === 3, "Should have 3 rows");
console.assert(matrix.shape()[1] === 3, "Should have 3 columns");
console.assert(matrix.get(0, 0) === 1, "Should get element at (0,0)");
console.assert(matrix.get(1, 2) === 6, "Should get element at (1,2)");

const matrix2 = new Matrix([
  [1, 2],
  [3, 4]
]);

console.assert(matrix2.shape()[0] === 2, "Should have 2 rows");
console.assert(matrix2.shape()[1] === 2, "Should have 2 columns");
console.assert(matrix2.get(0, 1) === 2, "Should get element at (0,1)");
console.assert(matrix2.get(1, 0) === 3, "Should get element at (1,0)");

const matrix3 = new Matrix([
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16]
]);

console.assert(matrix3.shape()[0] === 4, "Should have 4 rows");
console.assert(matrix3.shape()[1] === 4, "Should have 4 columns");

// Test addition
const matrixA = new Matrix([[1, 2], [3, 4]]);
const matrixB = new Matrix([[5, 6], [7, 8]]);
const matrixC = matrixA.add(matrixB);
console.assert(matrixC.get(0, 0) === 6, "Addition should work");
console.assert(matrixC.get(1, 1) === 12, "Addition should work");

// Test subtraction
const matrixD = matrixB.sub(matrixA);
console.assert(matrixD.get(0, 0) === 4, "Subtraction should work");
console.assert(matrixD.get(1, 1) === 4, "Subtraction should work");

// Test scalar multiplication
const matrixE = matrixA.mul(2);
console.assert(matrixE.get(0, 0) === 2, "Scalar multiplication should work");
console.assert(matrixE.get(1, 1) === 8, "Scalar multiplication should work");

// Test matrix multiplication
const matrixF = new Matrix([[1, 2], [3, 4]]);
const matrixG = new Matrix([[5, 6], [7, 8]]);
const matrixH = matrixF.mul(matrixG);
console.assert(matrixH.get(0, 0) === 19, "Matrix multiplication should work");
console.assert(matrixH.get(1, 1) === 43, "Matrix multiplication should work");

// Test transpose
const matrixI = new Matrix([[1, 2, 3], [4, 5, 6]]);
const matrixJ = matrixI.transpose();
console.assert(matrixJ.get(0, 1) === 2, "Transpose should work");
console.assert(matrixJ.get(1, 0) === 4, "Transpose should work");

// Test identity matrix
const identity = Matrix.identity(3);
console.assert(identity.get(0, 0) === 1, "Identity matrix should have 1 at (0,0)");
console.assert(identity.get(1, 1) === 1, "Identity matrix should have 1 at (1,1)");
console.assert(identity.get(0, 1) === 0, "Identity matrix should have 0 at (0,1)");

// Test equals method
const matrixK = new Matrix([[1, 2], [3, 4]]);
const matrixL = new Matrix([[1, 2], [3, 4]]);
console.assert(matrixK.equals(matrixL), "Equals should work for equal matrices");

const matrixM = new Matrix([[1, 2], [3, 5]]);
console.assert(!matrixK.equals(matrixM), "Equals should work for different matrices");

// Test determinant for 1x1 matrix
const matrix1x1 = new Matrix([[5]]);
console.assert(matrix1x1.determinant() === 5, "Determinant of 1x1 matrix should work");

// Test determinant for 2x2 matrix
const matrix2x2 = new Matrix([[1, 2], [3, 4]]);
console.assert(matrix2x2.determinant() === -2, "Determinant of 2x2 matrix should work");

// Test determinant for 3x3 matrix
const matrix3x3 = new Matrix([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
console.assert(matrix3x3.determinant() === 0, "Determinant of 3x3 matrix should work");

// Test determinant error for non-square matrix
try {
  const nonSquare = new Matrix([[1, 2, 3], [4, 5, 6]]);
  nonSquare.determinant();
  console.assert(false, "Should have thrown an error for non-square matrix");
} catch (e) {
  console.assert(e.message === "Determinant can only be calculated for square matrices", "Should throw correct error for non-square matrix");
}

console.log("All asserts passed!");