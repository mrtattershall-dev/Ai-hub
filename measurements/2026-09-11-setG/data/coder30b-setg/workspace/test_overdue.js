// Test just the overdueLines function
const { overdueLines } = require('./s10_desk.js');

// Create a mock library object for testing
const mockLibrary = {
  overdue: (today) => [
    { member: 'Alice', isbn: '978-0134685991', days: 5 },
    { member: 'Bob', isbn: '978-0201633610', days: 3 }
  ]
};

// Test the function
const result = overdueLines(mockLibrary, '2023-01-01');
console.log('Result:', JSON.stringify(result));
console.log('Expected: "Alice owes 978-0134685991 (5 days)\\nBob owes 978-0201633610 (3 days)"');

// Test empty result
const emptyResult = overdueLines(mockLibrary, '2023-01-01');
console.log('Empty result:', JSON.stringify(emptyResult));