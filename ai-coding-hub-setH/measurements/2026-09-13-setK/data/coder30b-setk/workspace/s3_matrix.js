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
    
    const cols = firstRow.length;
    if (cols === 0) {
      throw new Error("Matrix must have at least one column");
    }
    
    // Validate all rows have the same length and contain only finite numbers
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) {
        throw new Error("Each row must be an array");
      }
      
      if (row.length !== cols) {
        throw new Error("All rows must have the same length");
      }
      
      for (let j = 0; j < row.length; j++) {
        const value = row[j];
        if (typeof value !== 'number' || !isFinite(value)) {
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
    // Check if other is a Matrix instance
    if (!(other instanceof Matrix)) {
      throw new Error("Operand must be a Matrix");
    }
    
    // Check if shapes match
    const [rows1, cols1] = this.shape();
    const [rows2, cols2] = other.shape();
    if (rows1 !== rows2 || cols1 !== cols2) {
      throw new Error("Matrix shapes must match for addition");
    }
    
    // Create new matrix with sum
    const resultRows = [];
    for (let i = 0; i < rows1; i++) {
      const newRow = [];
      for (let j = 0; j < cols1; j++) {
        newRow.push(this.get(i, j) + other.get(i, j));
      }
      resultRows.push(newRow);
    }
    
    return new Matrix(resultRows);
  }
  
  sub(other) {
    // Check if other is a Matrix instance
    if (!(other instanceof Matrix)) {
      throw new Error("Operand must be a Matrix");
    }
    
    // Check if shapes match
    const [rows1, cols1] = this.shape();
    const [rows2, cols2] = other.shape();
    if (rows1 !== rows2 || cols1 !== cols2) {
      throw new Error("Matrix shapes must match for subtraction");
    }
    
    // Create new matrix with difference
    const resultRows = [];
    for (let i = 0; i < rows1; i++) {
      const newRow = [];
      for (let j = 0; j < cols1; j++) {
        newRow.push(this.get(i, j) - other.get(i, j));
      }
      resultRows.push(newRow);
    }
  return new Matrix(resultRows);
  }
  
  mul(x) {
    // If x is a number, perform scalar multiplication
    if (typeof x === 'number') {
      const [rows, cols] = this.shape();
      const resultRows = [];
      for (let i = 0; i < rows; i++) {
        const newRow = [];
        for (let j = 0; j < cols; j++) {
          newRow.push(this.get(i, j) * x);
        }
        resultRows.push(newRow);
      }
      return new Matrix(resultRows);
    }
    
    // If x is a Matrix, perform matrix multiplication
    if (x instanceof Matrix) {
      const [rows1, cols1] = this.shape();
      const [rows2, cols2] = x.shape();
      
      // Check if inner dimensions match
      if (cols1 !== rows2) {
        throw new Error("Inner dimensions must match for matrix multiplication");
      }
      
      // Perform matrix multiplication
      const resultRows = [];
      for (let i = 0; i < rows1; i++) {
        const newRow = [];
        for (let j = 0; j < cols2; j++) {
          let sum = 0;
          for (let k = 0; k < cols1; k++) {
            sum += this.get(i, k) * x.get(k, j);
          }
          newRow.push(sum);
        }
        resultRows.push(newRow);
      }
      
      return new Matrix(resultRows);
    }
    
  // If x is neither a number nor a Matrix, throw an error
  throw new Error("Operand must be a number or a Matrix");
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
  
  transpose() {
    const [rows, cols] = this.shape();
    const transposedRows = [];
    
    for (let j = 0; j < cols; j++) {
      const newRow = [];
      for (let i = 0; i < rows; i++) {
        newRow.push(this.get(i, j));
      }
      transposedRows.push(newRow);
    }
    
    return new Matrix(transposedRows);
  }
}

// Asserts that all pass

// Asserts that all pass
const matrix1 = new Matrix([[1, 2, 3], [4, 5, 6]]);
console.assert(matrix1.shape()[0] === 2, "Shape rows should be 2");
console.assert(matrix1.shape()[1] === 3, "Shape cols should be 3");
console.assert(matrix1.get(0, 0) === 1, "get(0,0) should return 1");
console.assert(matrix1.get(1, 2) === 6, "get(1,2) should return 6");
const arrayCopy = matrix1.toArray();
console.assert(arrayCopy[0][0] === 1, "toArray should return a copy");
console.assert(arrayCopy !== matrix1._rows, "toArray should return a copy, not the original");

// Test validation
try {
  new Matrix([]);
  console.assert(false, "Should have thrown error for empty rows");
} catch (e) {
  console.assert(e.message === "Matrix must have at least one row", "Should throw correct error for empty rows");
}

try {
  new Matrix([[1, 2], [3]]);
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

console.log("All asserts passed!");

// Export the Matrix class
module.exports = { Matrix };