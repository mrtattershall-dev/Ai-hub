class Matrix {
  constructor(rows) {
    // Check if rows is provided
    if (!rows) {
      throw new Error("No rows provided");
    }
    
    // Check if rows is an array
    if (!Array.isArray(rows)) {
      throw new Error("Rows must be an array");
    }
    
    // Check if rows array is empty
    if (rows.length === 0) {
      throw new Error("No rows provided");
    }
    
    // Check if all rows are arrays and have the same length
    const firstRowLength = rows[0].length;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!Array.isArray(row)) {
        throw new Error("All rows must be arrays");
      }
      if (row.length !== firstRowLength) {
        throw new Error("All rows must have the same length");
      }
      if (row.length === 0) {
        throw new Error("Rows cannot be empty");
      }
      // Check if all elements in the row are finite numbers
      for (let j = 0; j < row.length; j++) {
        if (typeof row[j] !== 'number' || !isFinite(row[j])) {
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
  
  add(other) {
    // Check if other is a Matrix
    if (!(other instanceof Matrix)) {
      throw new Error("Operand must be a Matrix");
    }
    
    // Check if shapes match
    const thisShape = this.shape();
    const otherShape = other.shape();
    if (thisShape[0] !== otherShape[0] || thisShape[1] !== otherShape[1]) {
      throw new Error("Matrix shapes must match for addition");
    }
    
    // Create new matrix with summed values
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
    // Check if other is a Matrix
    if (!(other instanceof Matrix)) {
      throw new Error("Operand must be a Matrix");
    }
    
    // Check if shapes match
    const thisShape = this.shape();
    const otherShape = other.shape();
    if (thisShape[0] !== otherShape[0] || thisShape[1] !== otherShape[1]) {
      throw new Error("Matrix shapes must match for subtraction");
    }
    
    // Create new matrix with subtracted values
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
    // If x is a number, perform scalar multiplication
    if (typeof x === 'number') {
      const resultRows = [];
      const shape = this.shape();
      for (let i = 0; i < shape[0]; i++) {
        const newRow = [];
        for (let j = 0; j < shape[1]; j++) {
          newRow.push(this.get(i, j) * x);
        }
        resultRows.push(newRow);
      }
      return new Matrix(resultRows);
    }
    
    // If x is a Matrix, perform matrix multiplication
    if (x instanceof Matrix) {
      const thisShape = this.shape();
      const otherShape = x.shape();
      
      // Check if inner dimensions match for matrix multiplication
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
    }
    
    // If x is neither a number nor a Matrix, throw an error
    throw new Error("Operand must be a number or a Matrix");
  }
  
  toArray() {
    // Return a copy of the rows
    return this._rows.map(row => [...row]);
  }
  
  transpose() {
    const shape = this.shape();
    const rows = shape[0];
    const cols = shape[1];
    
    const resultRows = [];
    for (let j = 0; j < cols; j++) {
      const newRow = [];
      for (let i = 0; i < rows; i++) {
        newRow.push(this.get(i, j));
      }
      resultRows.push(newRow);
    }
    
    return new Matrix(resultRows);
  }
  
  determinant() {
    const shape = this.shape();
    const rows = shape[0];
    const cols = shape[1];
    
    // Check if matrix is square
    if (rows !== cols) {
      throw new Error("Matrix must be square to calculate determinant");
    }
    
    // Base case: 1x1 matrix
    if (rows === 1) {
      return this.get(0, 0);
    }
    
    // Base case: 2x2 matrix
    if (rows === 2) {
      return this.get(0, 0) * this.get(1, 1) - this.get(0, 1) * this.get(1, 0);
    }
    
    // Recursive case: cofactor expansion along first row
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
      
      // Calculate cofactor: (-1)^(0+j) * element * determinant of minor
      const element = this.get(0, j);
      const minorMatrix = new Matrix(minorRows);
      const cofactor = Math.pow(-1, j) * element * minorMatrix.determinant();
      det += cofactor;
    }
    
    return det;
  }
  
  static identity(n) {
    if (typeof n !== 'number' || n <= 0 || !Number.isInteger(n)) {
      throw new Error('n must be a positive integer');
    }
    
    const rows = [];
    for (let i = 0; i < n; i++) {
      const row = new Array(n).fill(0);
      row[i] = 1;
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
    const thisShape = this.shape();
    const otherShape = other.shape();
    if (thisShape[0] !== otherShape[0] || thisShape[1] !== otherShape[1]) {
      return false;
    }
    
    // Check if all entries differ by at most eps
    for (let i = 0; i < thisShape[0]; i++) {
      for (let j = 0; j < thisShape[1]; j++) {
        if (Math.abs(this.get(i, j) - other.get(i, j)) > eps) {
          return false;
        }
      }
    }
    
    return true;
  }
}

module.exports = { Matrix };