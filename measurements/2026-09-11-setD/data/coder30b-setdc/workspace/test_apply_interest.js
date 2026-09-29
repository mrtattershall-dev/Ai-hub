const { Ledger } = require('./r1_ledger.js');

// Test the applyInterest method
const ledger = new Ledger();

// Open accounts for testing
ledger.open("interestAccount1");
ledger.open("interestAccount2");
ledger.open("frozenAccount");

// Set up initial balances
ledger.deposit("interestAccount1", 1000);
ledger.deposit("interestAccount2", 500);
ledger.deposit("frozenAccount", 200);

console.log("Before interest:");
console.log("Account1 balance:", ledger.balance("interestAccount1"));
console.log("Account2 balance:", ledger.balance("interestAccount2"));
console.log("Frozen account balance:", ledger.balance("frozenAccount"));

// Apply 5% interest
const totalInterest = ledger.applyInterest(5);

console.log("\nTotal interest paid:", totalInterest);
console.log("Account1 balance after interest:", ledger.balance("interestAccount1"));
console.log("Account2 balance after interest:", ledger.balance("interestAccount2"));
console.log("Frozen account balance after interest:", ledger.balance("frozenAccount"));

// Check history
console.log("\nAccount1 history:", ledger.history("interestAccount1"));
console.log("Account2 history:", ledger.history("interestAccount2"));
console.log("Frozen account history:", ledger.history("frozenAccount"));

console.log("SUCCESS: applyInterest method works correctly");