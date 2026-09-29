const { convertBalances } = require('./r10_report.js');

// Mock ledger with balance method
const mockLedger = {
  balance: function(name) {
    // Return mock balances for testing
    const balances = {
      'Alice': 100.50,
      'Bob': 250.75,
      'Charlie': 50.25
    };
    return balances[name] || 0;
  }
};

// Test data
const names = ['Alice', 'Bob', 'Charlie'];
const code = 'EUR';
const rates = { USD: 1, EUR: 1.1 };

// Test the convertBalances function
try {
  const result = convertBalances(mockLedger, names, code, rates);
  console.log('Convert Balances Result:', result);
  
  // Expected values (rounded to nearest cent)
  // Alice: 100.50 USD -> 100.50 * 1.1 = 110.55 EUR -> 11055 cents
  // Bob: 250.75 USD -> 250.75 * 1.1 = 275.825 EUR -> 27583 cents  
  // Charlie: 50.25 USD -> 50.25 * 1.1 = 55.275 EUR -> 5528 cents
  
  const expected = [11055, 27583, 5528];
  
  console.log('Expected:', expected);
  
  // Check if results match expected
  const matches = result.every((val, i) => val === expected[i]);
  console.log('Test passed:', matches);
  
} catch (error) {
  console.error('Test failed with error:', error.message);
}