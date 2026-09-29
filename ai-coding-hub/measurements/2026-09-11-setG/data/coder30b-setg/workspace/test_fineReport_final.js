// Create a mock library with the necessary methods
const mockLibrary = {
  fines: function(member) {
    // Mock fine data - this simulates what the real library.fines() would return
    const fineData = {
      'Alice': 150,
      'Bob': 75,
      'Charlie': 225,
      'David': 0
    };
    return fineData[member] || 0;
  }
};

// Import the fineReport function directly from s10_desk.js
const { fineReport } = require('./s10_desk.js');

// Test members
const members = ['Alice', 'Bob', 'Charlie', 'David'];

console.log('Testing fineReport with mock data:');
const result = fineReport(mockLibrary, members);
console.log('Result:');
console.log(result);

// Expected output should be:
// Charlie: $2.25
// Alice: $1.50
// Bob: $0.75
// David: $0.00