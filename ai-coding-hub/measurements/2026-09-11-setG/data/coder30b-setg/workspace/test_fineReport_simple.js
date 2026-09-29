const { fineReport } = require('./s10_desk.js');

// Create a mock library with fines function
const mockLibrary = {
  fines: function(member) {
    const fineData = {
      'Alice': 150,
      'Bob': 75,
      'Charlie': 225,
      'David': 0
    };
    return fineData[member] || 0;
  }
};

// Test members
const members = ['Alice', 'Bob', 'Charlie', 'David'];

console.log('Testing fineReport with mock data:');
const result = fineReport(mockLibrary, members);
console.log('Result:');
console.log(result);
console.log('Expected format:');
console.log('member: $2.25');
console.log('member: $1.50');
console.log('member: $0.75');
console.log('member: $0.00');