// Matrix class implementation

class Matrix {
  constructor(rows) {
    // Check if rows is an array
    if (!Array.isArray(rows)) {
      throw new Error("Rows must be an array");
    }
    
    // Check if there are no rows
    if (rows.length === 0) {
      throw new Error("Matrix must have at least one row");
    }
    
    // Check if all rows are arrays and have the same length
    const firstRowLength = rows[0].length;
    if (firstRowLength === 0) {
      throw new Error("Matrix must have at least one column");
    }
    
    for (let i = 0; i < rows.length; i++) {
      if (!Array.isArray(rows[i])) {
        throw new Error("Each row must be an array");
      }
      if (rows[i].length !== firstRowLength) {
        throw new Error("All rows must have the same length");
      }
      for (let j = 0; j < rows[i].length; j++) {
        if (typeof rows[i][j] !== 'number' || !isFinite(rows[i][j])) {
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
    // Return a copy of the rows
    return this._rows.map(row => [...row]);
  }
  
  add(other) {
    // Check if other is a Matrix
    if (!(other instanceof Matrix)) {
      throw new Error("Operand must be a Matrix");
    }
    
    // Check if shapes match
    const shape1 = this.shape();
    const shape2 = other.shape();
    if (shape1[0] !== shape2[0] || shape1[1] !== shape2[1]) {
      throw new Error("Matrix shapes must match for addition");
    }
    
    // Perform addition
    const resultRows = [];
    for (let i = 0; i < shape1[0]; i++) {
      const row = [];
      for (let j = 0; j < shape1[1]; j++) {
        row.push(this.get(i, j) + other.get(i, j));
      }
      resultRows.push(row);
    }
    
    return new Matrix(resultRows);
  }
  
  sub(other) {
    // Check if other is a Matrix
    if (!(other instanceof Matrix)) {
      throw new Error("Operand must be a Matrix");
    }
    
    // Check if shapes match
    const shape1 = this.shape();
    const shape2 = other.shape();
    if (shape1[0] !== shape2[0] || shape1[1] !== shape2[1]) {
      throw new Error("Matrix shapes must match for subtraction");
    }
    
    // Perform subtraction
    const resultRows = [];
    for (let i = 0; i < shape1[0]; i++) {
      const row = [];
      for (let j = 0; j < shape1[1]; j++) {
        row.push(this.get(i, j) - other.get(i, j));
      }
      resultRows.push(row);
    }
    
    return new Matrix(resultRows);
  }
  
  transpose() {
    const rows = this.shape()[0];
    const cols = this.shape()[1];
    const transposedRows = [];
    
    for (let j = 0; j < cols; j++) {
      const row = [];
      for (let i = 0; i < rows; i++) {
        row.push(this.get(i, j));
      }
      transposedRows.push(row);
    }
    
    return new Matrix(transposedRows);
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

  equals(other, eps = 1e-9) {
    // Check if other is a Matrix
    if (!(other instanceof Matrix)) {
      return false;
    }
    
    // Check if shapes match
    const shape1 = this.shape();
    const shape2 = other.shape();
    if (shape1[0] !== shape2[0] || shape1[1] !== shape2[1]) {
      return false;
    }
    
    // Check if all entries differ by at most eps
    for (let i = 0; i < shape1[0]; i++) {
      for (let j = 0; j < shape1[1]; j++) {
        if (Math.abs(this.get(i, j) - other.get(i, j)) > eps) {
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
      throw new Error("Determinant is only defined for square matrices");
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
      
      const minorMatrix = new Matrix(minorRows);
      const cofactor = Math.pow(-1, j) * this.get(0, j) * minorMatrix.determinant();
      det += cofactor;
    }
    
    return det;
  }

  inverse() {
    const shape = this.shape();
    const rows = shape[0];
    const cols = shape[1];
    
    // Check if matrix is square
    if (rows !== cols) {
      throw new Error("Inverse is only defined for square matrices");
    }
    
    // Calculate determinant
    const det = this.determinant();
    
    // Check if matrix is singular (determinant near zero)
    if (Math.abs(det) < 1e-12) {
      throw new Error("Matrix is singular (determinant is zero or near zero)");
    }
    
    // Special case: 1x1 matrix
    if (rows === 1) {
      return new Matrix([[1 / det]]);
    }
    
    // Special case: 2x2 matrix
    if (rows === 2) {
      const a = this.get(0, 0);
      const b = this.get(0, 1);
      const c = this.get(1, 0);
      const d = this.get(1, 1);
      const inv = [[d / det, -b / det], [-c / det, a / det]];
      return new Matrix(inv);
    }
    
    // For larger matrices, use adjugate method
    // Create cofactor matrix
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
        
        const minorMatrix = new Matrix(minorRows);
        const cofactor = Math.pow(-1, i + j) * minorMatrix.determinant();
        cofactorRow.push(cofactor);
      }
      cofactorRows.push(cofactorRow);
    }
    
    // Create adjugate matrix (transpose of cofactor matrix)
    const adjugateMatrix = new Matrix(cofactorRows).transpose();
    
    // Divide by determinant to get inverse
    const inverseRows = [];
    for (let i = 0; i < rows; i++) {
      const inverseRow = [];
      for (let j = 0; j < cols; j++) {
        inverseRow.push(adjugateMatrix.get(i, j) / det);
      }
      inverseRows.push(inverseRow);
    }
    
    return new Matrix(inverseRows);
  }
  
  solve(b) {
    // Check if matrix is square
    const shape = this.shape();
    const n = shape[0];
    if (shape[0] !== shape[1]) {
      throw new Error("Matrix must be square to solve Ax = b");
    }
    
    // Check if b has the correct length
    if (!Array.isArray(b) || b.length !== n) {
      throw new Error("b must be an array with the same length as the matrix rows");
    }
    
    // Create augmented matrix [A|b]
    const augmented = [];
    for (let i = 0; i < n; i++) {
      const row = [...this._rows[i], b[i]];
      augmented.push(row);
    }
    
    // Forward elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
          maxRow = k;
        }
      }
      
      // Swap rows
      if (maxRow !== i) {
        [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
      }
      
      // Check for singular matrix
      if (Math.abs(augmented[i][i]) < 1e-10) {
        throw new Error("Matrix is singular, cannot solve Ax = b");
      }
      
      // Eliminate column
      for (let k = i + 1; k < n; k++) {
        const factor = augmented[k][i] / augmented[i][i];
        for (let j = i; j <= n; j++) {
          augmented[k][j] -= factor * augmented[i][j];
        }
      }
    }
    
    // Back substitution
    const x = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = augmented[i][n];
      for (let j = i + 1; j < n; j++) {
        x[i] -= augmented[i][j] * x[j];
      }
      x[i] /= augmented[i][i];
    }
    
    return x;
  }
  
  static fromString(text) {
    if (typeof text !== 'string') {
      throw new Error('Input must be a string');
    }
    
    // Split text into lines
    const lines = text.trim().split('\n');
    
    // Handle empty input
    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
      throw new Error('Matrix must have at least one row');
    }
    
    const rows = [];
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (line === '') {
        continue;
      }
      
      // Split line into numbers
      const numbers = line.split(/\s+/);
      
      // Convert to numbers and validate
      const row = [];
      for (let j = 0; j < numbers.length; j++) {
        const num = Number(numbers[j]);
        if (isNaN(num) || !isFinite(num)) {
          throw new Error(`Invalid number "${numbers[j]}" in row ${i + 1}`);
        }
        row.push(num);
      }
      
      rows.push(row);
    }
    
    // Check if we have any rows
    if (rows.length === 0) {
      throw new Error('Matrix must have at least one row');
    }
    
    // Check that all rows have the same length
    const firstRowLength = rows[0].length;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length !== firstRowLength) {
        throw new Error(`Row ${i + 1} has ${rows[i].length} elements, expected ${firstRowLength}`);
      }
    }
    
    return new Matrix(rows);
  }
  
  toString() {
    return this._rows.map(row => row.join(' ')).join('\n');
  }
}

// Asserts that all pass
function runAsserts() {
  // Test valid matrix
  const validMatrix = new Matrix([[1, 2, 3], [4, 5, 6]]);
  console.assert(validMatrix.shape()[0] === 2, "Shape rows should be 2");
  console.assert(validMatrix.shape()[1] === 3, "Shape cols should be 3");
  console.assert(validMatrix.get(0, 1) === 2, "get(0,1) should return 2");
  console.assert(validMatrix.get(1, 2) === 6, "get(1,2) should return 6");
  
  const arrayCopy = validMatrix.toArray();
  console.assert(arrayCopy[0][0] === 1, "toArray should return a copy");
  console.assert(arrayCopy[0][1] === 2, "toArray should return a copy");
  
  // Test error cases
  try {
    new Matrix([]);
    console.assert(false, "Should have thrown error for empty rows");
  } catch (e) {
    console.assert(e.message === "Matrix must have at least one row", "Should throw correct error for empty rows");
  }
  
  try {
    new Matrix([[]]);
    console.assert(false, "Should have thrown error for empty rows");
  } catch (e) {
    console.assert(e.message === "Matrix must have at least one column", "Should throw correct error for empty rows");
  }
  
  try {
    new Matrix([[1, 2], [3, 4, 5]]);
    console.assert(false, "Should have thrown error for different row lengths");
  } catch (e) {
    console.assert(e.message === "All rows must have the same length", "Should throw correct error for different row lengths");
  }
  
  try {
    new Matrix([[1, 2], [3, "invalid"]]);
    console.assert(false, "Should have thrown error for non-finite number");
  } catch (e) {
    console.assert(e.message === "All entries must be finite numbers", "Should throw correct error for non-finite number");
  }
  
  try {
    validMatrix.get(5, 0);
    console.assert(false, "Should have thrown error for out of bounds");
  } catch (e) {
    console.assert(e.message === "Index out of bounds", "Should throw correct error for out of bounds");
  }
  
  // Test add and sub
  const matrix1 = new Matrix([[1, 2], [3, 4]]);
  const matrix2 = new Matrix([[5, 6], [7, 8]]);
  const sum = matrix1.add(matrix2);
  console.assert(sum.get(0, 0) === 6, "Addition should work");
  console.assert(sum.get(1, 1) === 12, "Addition should work");
  
  const diff = matrix1.sub(matrix2);
  console.assert(diff.get(0, 0) === -4, "Subtraction should work");
  console.assert(diff.get(1, 1) === -4, "Subtraction should work");
  
  // Test transpose
  const transposed = matrix1.transpose();
  console.assert(transposed.get(0, 1) === 3, "Transpose should work");
  console.assert(transposed.get(1, 0) === 2, "Transpose should work");
  
  // Test identity
  const identity = Matrix.identity(3);
  console.assert(identity.get(0, 0) === 1, "Identity should work");
  console.assert(identity.get(1, 1) === 1, "Identity should work");
  console.assert(identity.get(2, 2) === 1, "Identity should work");
  console.assert(identity.get(0, 1) === 0, "Identity should work");
  
  // Test equals
  const matrix3 = new Matrix([[1, 2], [3, 4]]);
  const matrix4 = new Matrix([[1.000000001, 2], [3, 4]]);
  console.assert(matrix1.equals(matrix3), "Equals should work for equal matrices");
  console.assert(matrix1.equals(matrix4), "Equals should work for near-equal matrices with default epsilon");
  console.assert(!matrix1.equals(matrix2), "Equals should work for different matrices");
  console.assert(!matrix1.equals("not a matrix"), "Equals should return false for non-matrix");
  
  console.log("All asserts passed!");
}

// Export the Matrix class
module.exports = { Matrix };

// Run the asserts
runAsserts();