const { Ledger } = require('./r1_ledger.js');

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
// Test applyInterest method
console.log("\nTesting applyInterest method...");

// Open accounts for testing
ledger.open("interestAccount1");
ledger.open("interestAccount2");
ledger.open("frozenAccount");

// Set up initial balances
ledger.deposit("interestAccount1", 1000);
ledger.deposit("interestAccount2", 500);
ledger.deposit("frozenAccount", 200);

// Apply 5% interest
const totalInterest = ledger.applyInterest(5);

console.log("Total interest paid:", totalInterest);

// Check if interest was applied correctly
const balance1 = ledger.balance("interestAccount1");
const balance2 = ledger.balance("interestAccount2");
const balance3 = ledger.balance("frozenAccount");

console.log("Account1 balance after interest:", balance1);
console.log("Account2 balance after interest:", balance2);
console.log("Frozen account balance:", balance3);

// Verify balances
if (Math.abs(balance1 - 1050) < 0.01) { // 1000 * 1.05 = 1050
  console.log("PASS: Interest applied to account1");
} else {
  console.log("FAIL: Interest not applied correctly to account1");
}

if (Math.abs(balance2 - 525) < 0.01) { // 500 * 1.05 = 525
  console.log("PASS: Interest applied to account2");
} else {
  console.log("FAIL: Interest not applied correctly to account2");
}

// Frozen account should not get interest
if (balance3 === 200) {
  console.log("PASS: Frozen account not affected by interest");
} else {
  console.log("FAIL: Frozen account was affected by interest");
}

// Check history for interest transactions
const history1 = ledger.history("interestAccount1");
const history2 = ledger.history("interestAccount2");

console.log("Account1 history:", history1);
console.log("Account2 history:", history2);

// Verify interest transaction in history
if (history1.length > 0 && history1[history1.length - 1].type === 'interest') {
  console.log("PASS: Interest transaction recorded in history for account1");
} else {
  console.log("FAIL: Interest transaction not recorded in history for account1");
}

if (history2.length > 0 && history2[history2.length - 1].type === 'interest') {
  console.log("PASS: Interest transaction recorded in history for account2");
} else {
  console.log("FAIL: Interest transaction not recorded in history for account2");
}

console.log("Apply interest test completed");
// Test fromCSV method
console.log("\nTesting fromCSV method...");

// Create a ledger with some data
const originalLedger = new Ledger();
originalLedger.open("account1");
originalLedger.deposit("account1", 100);
originalLedger.open("account2");
originalLedger.deposit("account2", 50);
originalLedger.open("account3"); // Empty account

// Convert to CSV
const csv = originalLedger.toCSV();
console.log("Original CSV:");
console.log(csv);

// Convert back from CSV
const newLedger = Ledger.fromCSV(csv);

// Check if the roundtrip works correctly
const newCsv = newLedger.toCSV();
console.log("New CSV:");
console.log(newCsv);

if (csv === newCsv) {
  console.log("PASS: fromCSV -> toCSV roundtrip works");
} else {
  console.log("FAIL: fromCSV -> toCSV roundtrip failed");
}

// Verify accounts and balances
try {
  if (newLedger.balance("account1") === 100) {
    console.log("PASS: account1 balance correct");
  } else {
    console.log("FAIL: account1 balance incorrect");
  }
  
  if (newLedger.balance("account2") === 50) {
    console.log("PASS: account2 balance correct");
  } else {
    console.log("FAIL: account2 balance incorrect");
  }
  
  if (newLedger.balance("account3") === 0) {
    console.log("PASS: account3 balance correct");
  } else {
    console.log("FAIL: account3 balance incorrect");
  }
} catch (e) {
  console.log("FAIL: Error checking balances:", e.message);
}

// Test error cases
console.log("\nTesting error cases...");

// Test missing header
try {
  Ledger.fromCSV("account,balance\naccount1,100");
  console.log("FAIL: Should have thrown for missing header");
} catch (e) {
  console.log("PASS: Correctly rejected missing header");
}

// Test malformed line
try {
  Ledger.fromCSV("account,balance\naccount1,100,extra");
  console.log("FAIL: Should have thrown for malformed line");
} catch (e) {
  console.log("PASS: Correctly rejected malformed line");
}

// Test invalid balance
try {
  Ledger.fromCSV("account,balance\naccount1,invalid");
  console.log("FAIL: Should have thrown for invalid balance");
} catch (e) {
  console.log("PASS: Correctly rejected invalid balance");
}

// Test empty account name
try {
  Ledger.fromCSV("account,balance\n,100");
  console.log("FAIL: Should have thrown for empty account name");
} catch (e) {
  console.log("PASS: Correctly rejected empty account name");
}

console.log("\nAll fromCSV tests completed");
