const { overdueLines } = require('./s10_desk.js');

// Create a mock library object with overdue method
const mockLibrary = {
  overdue: function(today) {
    // Return some mock overdue data for testing
    return [
      { isbn: '1234567890', member: 'Alice', daysLate: 5 },
      { isbn: '0987654321', member: 'Bob', daysLate: 3 }
    ];
  }
};

// Test the function
console.log('Testing overdueLines function:');
console.log('Result:', overdueLines(mockLibrary, 10));