const { Ledger } = require('./clean_ledger.js');

// Create a new ledger
const ledger = new Ledger();

// Test history method
console.log("Testing history method...");

// Open an account
ledger.open("testAccount");

// Make some transactions
ledger.deposit("testAccount", 100);
ledger.withdraw("testAccount", 30);
ledger.deposit("testAccount", 50);

// Test history for the account
const history = ledger.history("testAccount");
console.log("Transaction history:", history);

// Verify the history is correct
if (history.length === 3) {
  console.log("PASS: History contains 3 transactions");
  
  if (history[0].type === 'deposit' && history[0].amount === 100) {
    console.log("PASS: First transaction is deposit of 100");
  } else {
    console.log("FAIL: First transaction incorrect");
  }
  
  if (history[1].type === 'withdraw' && history[1].amount === 30) {
    console.log("PASS: Second transaction is withdrawal of 30");
  } else {
    console.log("FAIL: Second transaction incorrect");
  }
  
  if (history[2].type === 'deposit' && history[2].amount === 50) {
    console.log("PASS: Third transaction is deposit of 50");
  } else {
    console.log("FAIL: Third transaction incorrect");
  }
} else {
  console.log("FAIL: History should contain 3 transactions");
}

// Test history for non-existent account
try {
  ledger.history("nonExistent");
  console.log("FAIL: Should have thrown for non-existent account");
} catch (e) {
  console.log("PASS: Correctly threw error for non-existent account");
}

// Test history for account with no transactions
ledger.open("emptyAccount");
const emptyHistory = ledger.history("emptyAccount");
console.log("History for empty account:", emptyHistory);
if (emptyHistory.length === 0) {
  console.log("PASS: Empty account history is empty array");
} else {
  console.log("FAIL: Empty account history should be empty");
}

// Test transfer transactions
ledger.deposit("testAccount", 100);
ledger.transfer("testAccount", "emptyAccount", 25);
const transferHistory = ledger.history("testAccount");
console.log("History after transfer:", transferHistory);

// Verify transfer history
if (transferHistory.length === 5) {
  console.log("PASS: Transfer history contains 5 transactions");
  if (transferHistory[4].type === 'transfer-out' && transferHistory[4].amount === 25) {
    console.log("PASS: Last transaction is transfer-out of 25");
  } else {
    console.log("FAIL: Last transaction should be transfer-out of 25");
  }
}

const receivedHistory = ledger.history("emptyAccount");
console.log("History for receiving account:", receivedHistory);
if (receivedHistory.length === 1) {
  console.log("PASS: Receiving account history contains 1 transaction");
  if (receivedHistory[0].type === 'transfer-in' && receivedHistory[0].amount === 25) {
    console.log("PASS: Received transaction is transfer-in of 25");
  } else {
    console.log("FAIL: Received transaction should be transfer-in of 25");
  }
}

console.log("History test completed");