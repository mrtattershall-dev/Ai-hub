const Matrix = require('./s3_matrix.js');

// Test cases
try {
  // Test constructor with valid input
  const matrix1 = new Matrix([[1, 2, 3], [4, 5, 6]]);
  console.assert(matrix1.shape()[0] === 2 && matrix1.shape()[1] === 3, 'Test 1 Failed');

  // Test get method
  console.assert(matrix1.get(0, 0) === 1, 'Test 2 Failed');
  console.assert(matrix1.get(1, 2) === 6, 'Test 3 Failed');

  // Test toArray method
  const array1 = matrix1.toArray();
  console.assert(array1[0][0] === 1 && array1[1][2] === 6, 'Test 4 Failed');

  // Test constructor with no rows
  try {
    new Matrix([]);
    console.assert(false, 'Test 5 Failed');
  } catch (e) {
    console.assert(e.message === 'No rows provided', 'Test 5 Failed');
  }

  // Test constructor with empty rows
  try {
    new Matrix([[], []]);
    console.assert(false, 'Test 6 Failed');
  } catch (e) {
    console.assert(e.message === 'Empty rows provided', 'Test 6 Failed');
  }

  // Test constructor with rows of different lengths
  try {
    new Matrix([[1, 2], [3]]);
    console.assert(false, 'Test 7 Failed');
  } catch (e) {
    console.assert(e.message === 'Rows must be of equal length', 'Test 7 Failed');
  }

  // Test constructor with non-finite numbers
  try {
    new Matrix([[1, 2], [3, NaN]]);
    console.assert(false, 'Test 8 Failed');
  } catch (e) {
    console.assert(e.message === 'All entries must be finite numbers', 'Test 8 Failed');
  }

  // Test get method with out of bounds indices
  try {
    matrix1.get(2, 2);
    console.assert(false, 'Test 9 Failed');
  } catch (e) {
    console.assert(e.message === 'Index out of bounds', 'Test 9 Failed');
  }

  console.log('All tests passed!');
} catch (error) {
  console.error('Test failed:', error);
}