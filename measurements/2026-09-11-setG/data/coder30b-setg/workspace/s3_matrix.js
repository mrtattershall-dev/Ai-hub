// Matrix class implementation
class Matrix {
  constructor(rows) {
    // Validate input
    if (!Array.isArray(rows)) {
      throw new Error("Rows must be an array");
    }
    
    if (rows.length === 0) {
      throw new Error("Matrix must have at least one row");
    }
    
    const firstRow = rows[0];
    if (!Array.isArray(firstRow)) {
      throw new Error("Each row must be an array");
    }
    
    if (firstRow.length === 0) {
      throw new Error("Matrix must have at least one column");
    }
    
    const cols = firstRow.length;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) {
        throw new Error("Each row must be an array");
      }
      if (row.length !== cols) {
        throw new Error("All rows must have the same length");
      }
      for (let j = 0; j < row.length; j++) {
        if (typeof row[j] !== 'number' || !isFinite(row[j])) {
          throw new Error("All entries must be finite numbers");
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
      throw new Error("Index out of bounds");
    }
    return this._rows[r][c];
  }
  
  toArray() {
    return this._rows.map(row => [...row]);
  }
  
  add(other) {
    const [rows, cols] = this.shape();
    const [otherRows, otherCols] = other.shape();
    
    if (rows !== otherRows || cols !== otherCols) {
      throw new Error("Matrix dimensions must match for addition");
    }
    
    const resultRows = [];
    for (let i = 0; i < rows; i++) {
      const resultRow = [];
      for (let j = 0; j < cols; j++) {
        resultRow.push(this.get(i, j) + other.get(i, j));
      }
      resultRows.push(resultRow);
    }
    
    return new Matrix(resultRows);
  }
  
  sub(other) {
    const [rows, cols] = this.shape();
    const [otherRows, otherCols] = other.shape();
    
    if (rows !== otherRows || cols !== otherCols) {
      throw new Error("Matrix dimensions must match for subtraction");
    }
    
    const resultRows = [];
    for (let i = 0; i < rows; i++) {
      const resultRow = [];
      for (let j = 0; j < cols; j++) {
        resultRow.push(this.get(i, j) - other.get(i, j));
      }
      resultRows.push(resultRow);
    }
    
    return new Matrix(resultRows);
  }
  
  transpose() {
    const [rows, cols] = this.shape();
    const resultRows = [];
    for (let j = 0; j < cols; j++) {
      const resultRow = [];
      for (let i = 0; i < rows; i++) {
        resultRow.push(this.get(i, j));
      }
      resultRows.push(resultRow);
    }
    return new Matrix(resultRows);
  }
  
  equals(other, eps = 1e-9) {
    // Check if other is a Matrix instance
    if (!(other instanceof Matrix)) {
      return false;
    }
    
    // Check if shapes match
    const [rows, cols] = this.shape();
    const [otherRows, otherCols] = other.shape();
    if (rows !== otherRows || cols !== otherCols) {
      return false;
    }
    
    // Check if all corresponding elements differ by at most eps
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const diff = Math.abs(this.get(i, j) - other.get(i, j));
        if (diff > eps) {
          return false;
        }
      }
    }
    
    return true;
  }
  
  determinant() {
    const [rows, cols] = this.shape();
    
    // Only square matrices have determinants
    if (rows !== cols) {
      throw new Error("Determinant is only defined for square matrices");
    }
    
    // For 1x1 matrix
    if (rows === 1) {
      return this.get(0, 0);
    }
    
    // For 2x2 matrix
    if (rows === 2) {
      return this.get(0, 0) * this.get(1, 1) - this.get(0, 1) * this.get(1, 0);
    }
    
    // For larger matrices, use cofactor expansion along first row
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
      det += Math.pow(-1, j) * this.get(0, j) * minor.determinant();
    }
    
    return det;
  }
  
  inverse() {
    const [rows, cols] = this.shape();
    
    // Only square matrices can be inverted
    if (rows !== cols) {
      throw new Error("Inverse is only defined for square matrices");
    }
    
    // Calculate determinant
    const det = this.determinant();
    
    // Check if matrix is singular (determinant near zero)
    if (Math.abs(det) < 1e-12) {
      throw new Error("Matrix is singular (determinant is near zero)");
    }
    
    // For 1x1 matrix
    if (rows === 1) {
      return new Matrix([[1 / det]]);
    }
    
    // For 2x2 matrix, use the direct formula
    if (rows === 2) {
      const a = this.get(0, 0);
      const b = this.get(0, 1);
      const c = this.get(1, 0);
      const d = this.get(1, 1);
      return new Matrix([[d / det, -b / det], [-c / det, a / det]]);
    }
    
    // For larger matrices, use cofactor method
    const cofactorRows = [];
    for (let i = 0; i < rows; i++) {
      const cofactorRow = [];
      for (let j = 0; j < cols; j++) {
        // Create minor matrix by removing row i and column j
        const minorRows = [];
        for (let k = 0; k < rows; k++) {
          if (k !== i) {
            const minorRow = [];
            for (let l = 0; l < cols; l++) {
              if (l !== j) {
                minorRow.push(this.get(k, l));
              }
            }
            minorRows.push(minorRow);
          }
        }
        const minor = new Matrix(minorRows);
        const cofactor = Math.pow(-1, i + j) * minor.determinant();
        cofactorRow.push(cofactor);
      }
      cofactorRows.push(cofactorRow);
    }
    
    // Create cofactor matrix
    const cofactorMatrix = new Matrix(cofactorRows);
    
    // Transpose the cofactor matrix to get the adjugate
    const adjugate = cofactorMatrix.transpose();
    
    // Divide by determinant to get the inverse
    const resultRows = [];
    for (let i = 0; i < rows; i++) {
      const resultRow = [];
      for (let j = 0; j < cols; j++) {
        resultRow.push(adjugate.get(i, j) / det);
      }
      resultRows.push(resultRow);
    }
    
    return new Matrix(resultRows);
  }
  
  static identity(n) {
    if (typeof n !== 'number' || n <= 0 || !Number.isInteger(n)) {
      throw new Error("n must be a positive integer");
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
  
  multiply(other) {
    const [rows, cols] = this.shape();
    const [otherRows, otherCols] = other.shape();
    
    if (cols !== otherRows) {
      throw new Error("Number of columns in first matrix must equal number of rows in second matrix");
    }
    
    const resultRows = [];
    for (let i = 0; i < rows; i++) {
      const resultRow = [];
      for (let j = 0; j < otherCols; j++) {
        let sum = 0;
        for (let k = 0; k < cols; k++) {
          sum += this.get(i, k) * other.get(k, j);
        }
        resultRow.push(sum);
      }
      resultRows.push(resultRow);
    }
    
    return new Matrix(resultRows);
  }

  solve(b) {
    const [rows, cols] = this.shape();
    
    // Check if matrix is square
    if (rows !== cols) {
      throw new Error("Matrix must be square to solve Ax = b");
    }
    
    // Check if b has the correct length
    if (b.length !== rows) {
      throw new Error("Vector b must have the same number of elements as matrix rows");
    }
    
    // Create augmented matrix [A|b]
    const augmentedRows = [];
    for (let i = 0; i < rows; i++) {
      const augmentedRow = [...this._rows[i], b[i]];
      augmentedRows.push(augmentedRow);
    }
    
    // Perform Gaussian elimination with partial pivoting
    const augmented = new Matrix(augmentedRows);
    
    // Forward elimination
    for (let i = 0; i < rows; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < rows; k++) {
        if (Math.abs(augmented.get(k, i)) > Math.abs(augmented.get(maxRow, i))) {
          maxRow = k;
        }
      }
      
      // Swap rows if needed
      if (maxRow !== i) {
        for (let j = 0; j <= rows; j++) {
          const temp = augmented.get(i, j);
          augmented._rows[i][j] = augmented.get(maxRow, j);
          augmented._rows[maxRow][j] = temp;
        }
      }
      
      // Check for singular matrix
      if (Math.abs(augmented.get(i, i)) < 1e-12) {
        throw new Error("Matrix is singular (determinant is near zero)");
      }
      
      // Eliminate column
      for (let k = i + 1; k < rows; k++) {
        const factor = augmented.get(k, i) / augmented.get(i, i);
        for (let j = i; j <= rows; j++) {
          augmented._rows[k][j] -= factor * augmented.get(i, j);
        }
      }
    }
    
    // Back substitution
    const x = new Array(rows);
    for (let i = rows - 1; i >= 0; i--) {
      x[i] = augmented.get(i, rows);
      for (let j = i + 1; j < rows; j++) {
        x[i] -= augmented.get(i, j) * x[j];
      }
      x[i] /= augmented.get(i, i);
    }
    
    return x;
  }
}

// Add asserts to test the Matrix class
const matrix1 = new Matrix([[1, 2, 3], [4, 5, 6]]);
console.assert(matrix1.shape()[0] === 2, "Shape rows test failed");
console.assert(matrix1.shape()[1] === 3, "Shape cols test failed");
console.assert(matrix1.get(0, 0) === 1, "Get test failed");
console.assert(matrix1.get(1, 2) === 6, "Get test failed");
const arrayCopy = matrix1.toArray();
console.assert(arrayCopy[0][0] === 1, "ToArray test failed");
console.assert(arrayCopy !== matrix1._rows, "ToArray should return a copy");

// Test error cases
let errorCaught = false;
try {
  new Matrix([]);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Should throw error for empty rows");

errorCaught = false;
try {
  new Matrix([[]]);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Should throw error for empty row");

errorCaught = false;
try {
  new Matrix([[1, 2], [3, 4, 5]]);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Should throw error for different row lengths");

errorCaught = false;
try {
  new Matrix([[1, 2], [3, "not a number"]]);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Should throw error for non-finite number");

errorCaught = false;
try {
  new Matrix([[1, 2], [3, 4]]);
  matrix1.get(5, 0);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Should throw error for out of bounds access");

// Test inverse method
const testInverse = () => {
  // Test 1x1 matrix
  const m1 = new Matrix([[5]]);
  const inv1 = m1.inverse();
  console.assert(inv1.equals(new Matrix([[1/5]])), "1x1 inverse test failed");
  
  // Test 2x2 matrix
  const m2 = new Matrix([[2, 1], [1, 1]]);
  const inv2 = m2.inverse();
  const expected2 = new Matrix([[1, -1], [-1, 2]]);
  console.assert(inv2.equals(expected2), "2x2 inverse test failed");
  
  // Test 3x3 matrix
  const m3 = new Matrix([[1, 2, 3], [0, 1, 4], [5, 6, 0]]);
  const inv3 = m3.inverse();
  // Verify that m3 * inv3 = identity matrix
  const identity3 = Matrix.identity(3);
  console.assert(m3.multiply(inv3).equals(identity3), "3x3 inverse test failed");
  
  // Test non-square matrix (should throw error)
  const m4 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  let errorCaught = false;
  try {
    m4.inverse();
  } catch (e) {
    errorCaught = true;
  }
  console.assert(errorCaught, "Non-square matrix inverse should throw error");
  
  // Test singular matrix (determinant = 0)
  const m5 = new Matrix([[1, 2], [2, 4]]);
  errorCaught = false;
  try {
    m5.inverse();
  } catch (e) {
    errorCaught = true;
  }
  console.assert(errorCaught, "Singular matrix inverse should throw error");
  
  console.log("All inverse tests passed!");
};

testInverse();
console.log("All asserts passed!");

// Test solve method
const testSolve = () => {
  // Test case: [[2,1],[1,1]] x = [5,3] should give x = [2,1]
  const A = new Matrix([[2, 1], [1, 1]]);
  const b = [5, 3];
  const x = A.solve(b);
  
  // Check if the solution is correct: A * x should equal b
  const result = A.multiply(new Matrix([x].transpose()).transpose());
  const expected = new Matrix([b]);
  
  console.assert(result.equals(expected), "Solve method test failed");
  
  // Test with a 3x3 matrix
  const A3 = new Matrix([[1, 2, 3], [0, 1, 4], [5, 6, 0]]);
  const b3 = [14, 10, 11];
  const x3 = A3.solve(b3);
  
  // Check if the solution is correct: A3 * x3 should equal b3
  const result3 = A3.multiply(new Matrix([x3].transpose()).transpose());
  const expected3 = new Matrix([b3]);
  
  console.assert(result3.equals(expected3), "3x3 Solve method test failed");
  
  // Test error cases
  // Non-square matrix
  const nonSquare = new Matrix([[1, 2, 3], [4, 5, 6]]);
  let errorCaught = false;
  try {
    nonSquare.solve([1, 2]);
  } catch (e) {
    errorCaught = true;
  }
  console.assert(errorCaught, "Non-square matrix solve should throw error");
  
  // Wrong length b
  const square = new Matrix([[1, 2], [3, 4]]);
  errorCaught = false;
  try {
    square.solve([1, 2, 3]);
  } catch (e) {
    errorCaught = true;
  }
  console.assert(errorCaught, "Wrong length b should throw error");
  
  console.log("All solve tests passed!");
};

testSolve();
module.exports = Matrix;