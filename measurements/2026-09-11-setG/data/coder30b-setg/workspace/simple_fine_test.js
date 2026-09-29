// Simple test for fineReport function
const { Library } = require('./s1_library.js');

// Create a mock library with just the methods we need
const mockLibrary = {
  fines: function(member) {
    // Mock fines data
    const fineData = {
      'Alice': 150,
      'Bob': 75,
      'Charlie': 225,
      'David': 0
    };
    return fineData[member] || 0;
  }
};

// Test the fineReport function directly
const { fineReport } = require('./s10_desk.js');

const members = ['Alice', 'Bob', 'Charlie', 'David'];
const result = fineReport(mockLibrary, members);
console.log('Result:');
console.log(result);