// Matrix operations module

/**
 * Adds two matrices
 * @param {number[][]} a - First matrix
 * @param {number[][]} b - Second matrix
 * @returns {number[][]} Sum of matrices a and b
 */
function add(a, b) {
  // Validate inputs
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new Error("Both arguments must be arrays");
  }
  
  if (a.length === 0 || b.length === 0) {
    throw new Error("Cannot add empty matrices");
  }
  
  // Check if all elements in arrays are arrays (rows)
  for (let i = 0; i < a.length; i++) {
    if (!Array.isArray(a[i])) {
      throw new Error("Matrix a must be an array of arrays");
    }
  }
  
  for (let i = 0; i < b.length; i++) {
    if (!Array.isArray(b[i])) {
      throw new Error("Matrix b must be an array of arrays");
    }
  }
  
  // Check if matrices have the same dimensions
  if (a.length !== b.length) {
    throw new Error("Matrix dimensions do not match for addition");
  }
  
  // Check if rows have the same length
  const rows = a.length;
  const cols = a[0].length;
  
  if (cols !== b[0].length) {
    throw new Error("Matrix dimensions do not match for addition");
  }
  
  // Check that all elements are numbers
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (typeof a[i][j] !== 'number' || isNaN(a[i][j])) {
        throw new Error(`Element at position [${i}][${j}] in matrix a is not a valid number`);
      }
      if (typeof b[i][j] !== 'number' || isNaN(b[i][j])) {
        throw new Error(`Element at position [${i}][${j}] in matrix b is not a valid number`);
      }
    }
  }
  
  // Perform addition
  const result = [];
  for (let i = 0; i < rows; i++) {
    result[i] = [];
    for (let j = 0; j < cols; j++) {
      result[i][j] = a[i][j] + b[i][j];
    }
  }
  
  return result;
}

/**
 * Multiplies two matrices
 * @param {number[][]} a - First matrix
 * @param {number[][]} b - Second matrix
 * @returns {number[][]} Product of matrices a and b
 */
function multiply(a, b) {
  // Validate inputs
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new Error("Both arguments must be arrays");
  }
  
  // Check if matrices are empty
  if (a.length === 0 || b.length === 0) {
    throw new Error("Cannot multiply empty matrices");
  }
  
  // Check if all elements in arrays are arrays (rows)
  for (let i = 0; i < a.length; i++) {
    if (!Array.isArray(a[i])) {
      throw new Error("Matrix a must be an array of arrays");
    }
  }
  
  for (let i = 0; i < b.length; i++) {
    if (!Array.isArray(b[i])) {
      throw new Error("Matrix b must be an array of arrays");
    }
  }
  
  // Check if rows have the same length in matrix a
  const rowsA = a.length;
  const colsA = a[0].length;
  
  for (let i = 0; i < rowsA; i++) {
    if (a[i].length !== colsA) {
      throw new Error("Matrix a rows must have the same length");
    }
  }
  
  // Check if rows have the same length in matrix b
  const colsB = b[0].length;
  
  for (let i = 0; i < b.length; i++) {
    if (b[i].length !== colsB) {
      throw new Error("Matrix b rows must have the same length");
    }
  }
  
  // Check if matrices can be multiplied (columns of a must equal rows of b)
  if (a[0].length !== b.length) {
    throw new Error("Matrix dimensions are incompatible for multiplication");
  }
  
  // Check that all elements are numbers
  for (let i = 0; i < rowsA; i++) {
    for (let j = 0; j < colsA; j++) {
      if (typeof a[i][j] !== 'number' || isNaN(a[i][j])) {
        throw new Error(`Element at position [${i}][${j}] in matrix a is not a valid number`);
      }
    }
  }
  
  for (let i = 0; i < b.length; i++) {
    for (let j = 0; j < colsB; j++) {
      if (typeof b[i][j] !== 'number' || isNaN(b[i][j])) {
        throw new Error(`Element at position [${i}][${j}] in matrix b is not a valid number`);
      }
    }
  }
  
  // Perform multiplication
  const result = [];
  for (let i = 0; i < rowsA; i++) {
    result[i] = [];
    for (let j = 0; j < colsB; j++) {
      let sum = 0;
      for (let k = 0; k < colsA; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  
  return result;
}

/**
 * Transposes a matrix
 * @param {number[][]} m - Matrix to transpose
 * @returns {number[][]} Transposed matrix
 */
function transpose(m) {
  // Validate input
  if (!Array.isArray(m)) {
    throw new Error("Matrix must be an array");
  }
  
  // Check if matrix is empty
  if (m.length === 0) {
    throw new Error("Cannot transpose empty matrix");
  }
  
  // Check if all elements in arrays are arrays (rows)
  for (let i = 0; i < m.length; i++) {
    if (!Array.isArray(m[i])) {
      throw new Error("Matrix must be an array of arrays");
    }
  }
  
  // Check if rows have the same length
  const rows = m.length;
  const cols = m[0].length;
  
  for (let i = 0; i < rows; i++) {
    if (m[i].length !== cols) {
      throw new Error("Matrix rows must have the same length");
    }
  }
  
  // Check that all elements are numbers
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      if (typeof m[i][j] !== 'number' || isNaN(m[i][j])) {
        throw new Error(`Element at position [${i}][${j}] in matrix is not a valid number`);
      }
    }
  }
  
  // Perform transpose
  const result = [];
  for (let i = 0; i < cols; i++) {
    result[i] = [];
    for (let j = 0; j < rows; j++) {
      result[i][j] = m[j][i];
    }
  }
  
  return result;
}

/**
 * Creates an identity matrix of size n
 * @param {number} n - Size of the identity matrix
 * @returns {number[][]} Identity matrix of size n
 */
function identity(n) {
  // Validate input
  if (typeof n !== 'number' || isNaN(n) || n <= 0 || !Number.isInteger(n)) {
    throw new Error("Matrix size must be a positive integer");
  }
  
  // Create identity matrix
  const result = [];
  for (let i = 0; i < n; i++) {
    result[i] = [];
    for (let j = 0; j < n; j++) {
      result[i][j] = (i === j) ? 1 : 0;
    }
  }
  
  return result;
}

/**
 * Calculates the determinant of a square matrix
 * @param {number[][]} m - Square matrix
 * @returns {number} Determinant of the matrix
 */
function determinant(m) {
  // Check if matrix is empty
  if (m.length === 0) {
    throw new Error("Cannot calculate determinant of empty matrix");
  }
  
  // Check if matrix is square
  const rows = m.length;
  const cols = m[0].length;
  
  if (rows !== cols) {
    throw new Error("Matrix must be square to calculate determinant");
  }
  
  // Base case: 1x1 matrix
  if (rows === 1) {
    return m[0][0];
  }
  
  // Base case: 2x2 matrix
  if (rows === 2) {
    return m[0][0] * m[1][1] - m[0][1] * m[1][0];
  }
  
  // For larger matrices, use cofactor expansion along the first row
  let det = 0;
  for (let j = 0; j < cols; j++) {
    // Create minor matrix by removing row 0 and column j
    const minor = [];
    for (let i = 1; i < rows; i++) {
      const row = [];
      for (let k = 0; k < cols; k++) {
        if (k !== j) {
          row.push(m[i][k]);
        }
      }
      minor.push(row);
    }
    
    // Calculate cofactor and add to determinant
    const sign = (j % 2 === 0) ? 1 : -1;
    det += sign * m[0][j] * determinant(minor);
  }
  
  return det;
}

module.exports = { add, multiply, transpose, identity, determinant, inverse };
/**
 * Calculates the inverse of a square matrix
 * @param {number[][]} m - Square matrix
 * @returns {number[][]} Inverse of the matrix
 */
function inverse(m) {
  // Check if matrix is empty
  if (m.length === 0) {
    throw new Error("Cannot calculate inverse of empty matrix");
  }
  
  // Check if matrix is square
  const rows = m.length;
  const cols = m[0].length;
  
  if (rows !== cols) {
    throw new Error("Matrix must be square to calculate inverse");
  }
  
  // Calculate determinant
  const det = determinant(m);
  
  // If determinant is zero, matrix is singular and has no inverse
  if (Math.abs(det) < 1e-10) {
    throw new Error("Matrix is singular (determinant is zero) and has no inverse");
  }
  
  // For 1x1 matrix
  if (rows === 1) {
    return [[1 / m[0][0]]];
  }
  
  // For 2x2 matrix, use the direct formula
  if (rows === 2) {
    const a = m[0][0];
    const b = m[0][1];
    const c = m[1][0];
    const d = m[1][1];
    return [
      [d / det, -b / det],
      [-c / det, a / det]
    ];
  }
  
  // For larger matrices, use cofactor method
  // Create cofactor matrix
  const cofactorMatrix = [];
  for (let i = 0; i < rows; i++) {
    cofactorMatrix[i] = [];
    for (let j = 0; j < cols; j++) {
      // Create minor matrix by removing row i and column j
      const minor = [];
      for (let k = 0; k < rows; k++) {
        if (k !== i) {
          const row = [];
          for (let l = 0; l < cols; l++) {
            if (l !== j) {
              row.push(m[k][l]);
            }
          }
          minor.push(row);
        }
      }
      
      // Calculate cofactor: (-1)^(i+j) * determinant of minor
      const sign = Math.pow(-1, i + j);
      cofactorMatrix[i][j] = sign * determinant(minor);
    }
  }
  
  // Transpose the cofactor matrix to get the adjugate
  const adjugate = transpose(cofactorMatrix);
  
  // Divide each element by the determinant
  const result = [];
  for (let i = 0; i < rows; i++) {
    result[i] = [];
    for (let j = 0; j < cols; j++) {
      result[i][j] = adjugate[i][j] / det;
    }
  }
  
  return result;
}

module.exports = { add, multiply, transpose, identity, determinant, inverse };
