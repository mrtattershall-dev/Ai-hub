const { Ledger } = require('./r1_ledger.js');

// Test undo functionality
const ledger = new Ledger();

// Test opening accounts
ledger.open("account1");
ledger.open("account2");

// Test deposit and undo
ledger.deposit("account1", 100);
console.log("After deposit of 100 to account1:", ledger.balance("account1")); // Should be 100

ledger.undo();
console.log("After undo deposit:", ledger.balance("account1")); // Should be 0

// Test withdraw and undo
ledger.deposit("account1", 150);
ledger.withdraw("account1", 50);
console.log("After deposit 150 and withdraw 50:", ledger.balance("account1")); // Should be 100

ledger.undo();
console.log("After undo withdraw:", ledger.balance("account1")); // Should be 150

ledger.undo();
console.log("After undo deposit:", ledger.balance("account1")); // Should be 0

// Test transfer and undo
ledger.deposit("account1", 200);
ledger.deposit("account2", 100);
ledger.transfer("account1", "account2", 50);
console.log("After transfer 50 from account1 to account2:");
console.log("account1 balance:", ledger.balance("account1")); // Should be 150
console.log("account2 balance:", ledger.balance("account2")); // Should be 150

ledger.undo();
console.log("After undo transfer:");
console.log("account1 balance:", ledger.balance("account1")); // Should be 200
console.log("account2 balance:", ledger.balance("account2")); // Should be 100

ledger.undo();
console.log("After undo second undo:");
console.log("account1 balance:", ledger.balance("account1")); // Should be 0
console.log("account2 balance:", ledger.balance("account2")); // Should be 100

// Test error when nothing to undo
try {
  ledger.undo();
  console.log("ERROR: Should have thrown an error");
} catch (e) {
  console.log("PASS: Undo throws error when nothing to undo:", e.message);
}

console.log("All undo tests completed");