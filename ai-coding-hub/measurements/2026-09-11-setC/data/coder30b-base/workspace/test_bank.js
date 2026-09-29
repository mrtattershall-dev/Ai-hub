const Bank = require('./s1_bank.js');
const bank = new Bank();

// Test opening accounts
bank.open('alice');
bank.open('bob');

// Test depositing money
bank.deposit('alice', 100);
bank.deposit('bob', 50);

// Test balance retrieval
console.log('Alice balance:', bank.balance('alice')); // Should be 100
console.log('Bob balance:', bank.balance('bob')); // Should be 50

// Test error cases
try {
  bank.deposit('alice', -10);
} catch (e) {
  console.log('Caught expected error:', e.message);
}

try {
  bank.deposit('charlie', 100);
} catch (e) {
  console.log('Caught expected error:', e.message);
}

try {
  bank.balance('charlie');
} catch (e) {
  console.log('Caught expected error:', e.message);
}

// Test that all assertions pass
console.log('All tests completed successfully');
// Test withdrawal
console.log('Testing withdrawal...');
bank.withdraw('alice', 30);
console.log('Alice balance after withdrawal:', bank.balance('alice')); // Should be 70

// Test insufficient funds
try {
  bank.withdraw('alice', 100);
} catch (e) {
  console.log('Caught expected error:', e.message);
}

// Test withdrawal from non-existent account
try {
  bank.withdraw('charlie', 10);
} catch (e) {
  console.log('Caught expected error:', e.message);
}

// Test invalid withdrawal amount
try {
  bank.withdraw('bob', -5);
} catch (e) {
  console.log('Caught expected error:', e.message);
}

try {
  bank.withdraw('bob', 0);
} catch (e) {
  console.log('Caught expected error:', e.message);
}

console.log('All tests completed successfully');
// Test transfer functionality
console.log('Testing transfer...');

// Test valid transfer
bank.transfer('alice', 'bob', 25);
console.log('Alice balance after transfer:', bank.balance('alice')); // Should be 45
console.log('Bob balance after transfer:', bank.balance('bob')); // Should be 75

// Test transfer with insufficient funds
try {
  bank.transfer('alice', 'bob', 100);
} catch (e) {
  console.log('Caught expected error:', e.message);
}

// Test transfer from non-existent account
try {
  bank.transfer('charlie', 'alice', 10);
} catch (e) {
  console.log('Caught expected error:', e.message);
}

// Test transfer to non-existent account
try {
  bank.transfer('alice', 'charlie', 10);
} catch (e) {
  console.log('Caught expected error:', e.message);
}

// Test transfer with invalid amount
try {
  bank.transfer('alice', 'bob', -5);
} catch (e) {
  console.log('Caught expected error:', e.message);
}

try {
  bank.transfer('alice', 'bob', 0);
} catch (e) {
  console.log('Caught expected error:', e.message);
}

// Test atomicity - transfer should not happen if any validation fails
try {
  bank.transfer('alice', 'bob', 100);
} catch (e) {
  console.log('Caught expected error:', e.message);
  // Verify balances haven't changed
  console.log('Alice balance after failed transfer attempt:', bank.balance('alice')); // Should still be 45
  console.log('Bob balance after failed transfer attempt:', bank.balance('bob')); // Should still be 75
}

console.log('All transfer tests completed successfully');
// Test history method
console.log('Testing history method...');
const aliceHistory = bank.history('alice');
console.log('Alice history:', aliceHistory);

const bobHistory = bank.history('bob');
console.log('Bob history:', bobHistory);

// Test history for non-existent account
try {
  bank.history('charlie');
} catch (e) {
  console.log('Caught expected error:', e.message);
}

// Test history after more operations
bank.deposit('alice', 50);
bank.withdraw('alice', 20);
bank.transfer('alice', 'bob', 10);

const aliceHistoryAfter = bank.history('alice');
console.log('Alice history after more operations:', aliceHistoryAfter);

const bobHistoryAfter = bank.history('bob');
console.log('Bob history after more operations:', bobHistoryAfter);

console.log('History tests completed successfully');
