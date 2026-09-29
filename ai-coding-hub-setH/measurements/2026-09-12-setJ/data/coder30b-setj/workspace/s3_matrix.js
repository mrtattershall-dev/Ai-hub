// Matrix class implementation
class Matrix {
  constructor(rows) {
    // Validate input
    if (!Array.isArray(rows)) {
      throw new Error("Input must be an array");
    }
    
    if (rows.length === 0) {
      throw new Error("Matrix must have at least one row");
    }
    
    // Check each row
    for (let i = 0; i < rows.length; i++) {
      if (!Array.isArray(rows[i])) {
        throw new Error("Each row must be an array");
      }
      
      if (rows[i].length === 0) {
        throw new Error("Rows cannot be empty");
      }
      
      // Check if all rows have the same length
      if (i > 0 && rows[i].length !== rows[0].length) {
        throw new Error("All rows must have the same length");
      }
      
      // Check each element in the row
      for (let j = 0; j < rows[i].length; j++) {
        if (typeof rows[i][j] !== 'number' || !isFinite(rows[i][j])) {
          throw new Error("All elements must be finite numbers");
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
    const shape1 = this.shape();
    const shape2 = other.shape();
    if (shape1[0] !== shape2[0] || shape1[1] !== shape2[1]) {
      throw new Error("Matrix shapes must match for addition");
    }
    
    // Create result matrix
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
    // Check if other is a Matrix instance
    if (!(other instanceof Matrix)) {
      throw new Error("Operand must be a Matrix");
    }
    
    // Check if shapes match
    const shape1 = this.shape();
    const shape2 = other.shape();
    if (shape1[0] !== shape2[0] || shape1[1] !== shape2[1]) {
      throw new Error("Matrix shapes must match for subtraction");
    }
    
    // Create result matrix
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
}

// Test assertions
const matrix = new Matrix([
  [1, 2, 3],
  [4, 5, 6]
]);

console.assert(matrix.shape()[0] === 2, "Rows should be 2");
console.assert(matrix.shape()[1] === 3, "Columns should be 3");

console.assert(matrix.get(0, 0) === 1, "Element at (0,0) should be 1");
console.assert(matrix.get(1, 2) === 6, "Element at (1,2) should be 6");

const arrayCopy = matrix.toArray();
console.assert(arrayCopy[0][0] === 1, "Copy should have same values");
console.assert(arrayCopy !== matrix._rows, "toArray should return a copy");

// Test error cases
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
  console.assert(e.message === "All elements must be finite numbers", "Should throw correct error for non-finite number");
}

try {
  matrix.get(5, 5);
  console.assert(false, "Should have thrown error for out of bounds access");
} catch (e) {
  console.assert(e.message === "Index out of bounds", "Should throw correct error for out of bounds access");
}

console.log("All assertions passed!");

// Test new add and sub methods
const matrix1 = new Matrix([
  [1, 2, 3],
  [4, 5, 6]
]);

const matrix2 = new Matrix([
  [7, 8, 9],
  [10, 11, 12]
]);

const matrix3 = new Matrix([
  [1, 2],
  [3, 4]
]);

// Test add method
const sum = matrix1.add(matrix2);
console.assert(sum.get(0, 0) === 8, "Addition failed");
console.assert(sum.get(1, 2) === 18, "Addition failed");
console.assert(matrix1.get(0, 0) === 1, "Original matrix modified by add");
console.assert(matrix2.get(0, 0) === 7, "Original matrix modified by add");

// Test sub method
const diff = matrix2.sub(matrix1);
console.assert(diff.get(0, 0) === 6, "Subtraction failed");
console.assert(diff.get(1, 2) === 6, "Subtraction failed");
console.assert(matrix1.get(0, 0) === 1, "Original matrix modified by sub");
console.assert(matrix2.get(0, 0) === 7, "Original matrix modified by sub");

// Test error cases
try {
  matrix1.add(matrix3);
  console.assert(false, "Should have thrown error for mismatched shapes in add");
} catch (e) {
  console.assert(e.message === "Matrix shapes must match for addition", "Should throw correct error for mismatched shapes in add");
}

try {
  matrix1.sub(matrix3);
  console.assert(false, "Should have thrown error for mismatched shapes in sub");
} catch (e) {
  console.assert(e.message === "Matrix shapes must match for subtraction", "Should throw correct error for mismatched shapes in sub");
}

// Test non-Matrix operand
try {
  matrix1.add("not a matrix");
  console.assert(false, "Should have thrown error for non-Matrix operand in add");
} catch (e) {
  console.assert(e.message === "Operand must be a Matrix", "Should throw correct error for non-Matrix operand in add");
}

try {
  matrix1.sub("not a matrix");
  console.assert(false, "Should have thrown error for non-Matrix operand in sub");
} catch (e) {
  console.assert(e.message === "Operand must be a Matrix", "Should throw correct error for non-Matrix operand in sub");
}

console.log("All new method tests passed!");

// Export the Matrix class
module.exports = { Matrix };