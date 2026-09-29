const { Matrix } = require('./s3_matrix.js');

// Test the fromString method
function testFromString() {
  // Create a test matrix
  const m = new Matrix([[1, 2, 3], [4, 5, 6]]);
  
  // Convert to string
  const str = m.toString();
  console.log("Original matrix as string:");
  console.log(str);
  
  // Parse back from string
  const parsed = Matrix.fromString(str);
  
  // Convert parsed matrix to string
  const parsedStr = parsed.toString();
  
  // Check if they're equal
  console.log("Parsed matrix as string:");
  console.log(parsedStr);
  
  console.log("Are they equal?", str === parsedStr);
  
  // Test round-trip
  const roundTrip = Matrix.fromString(m.toString()).toString();
  console.log("Round-trip test:", roundTrip === m.toString());
  
  // Test error cases
  try {
    Matrix.fromString("1 2\n3");
    console.log("ERROR: Should have thrown for mismatched row lengths");
  } catch (e) {
    console.log("Correctly caught error for mismatched row lengths:", e.message);
  }
  
  try {
    Matrix.fromString("1 2\n3 abc");
    console.log("ERROR: Should have thrown for non-numeric input");
  } catch (e) {
    console.log("Correctly caught error for non-numeric input:", e.message);
  }
  
  try {
    Matrix.fromString("");
    console.log("ERROR: Should have thrown for empty input");
  } catch (e) {
    console.log("Correctly caught error for empty input:", e.message);
  }
  
  console.log("All tests completed");
}

testFromString();