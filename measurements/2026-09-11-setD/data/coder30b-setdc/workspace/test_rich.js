const { Ledger } = require('./r1_ledger');
const { richest } = require('./r10_report');

// Create a test ledger
const ledger = new Ledger();
ledger.open("alice");
ledger.open("bob");
ledger.open("charlie");
ledger.open("diana");
ledger.open("eve");

// Add some balances
ledger.deposit("alice", 12.50);
ledger.deposit("bob", 100);
ledger.deposit("charlie", 999.99);
ledger.deposit("diana", 500.00);
ledger.deposit("eve", 500.00); // Same balance as diana, should be sorted alphabetically

// Test the richest function
console.log("Testing richest function...");
const top3 = richest(ledger, 3);
console.log("Top 3 accounts:", top3);

// Expected result: charlie (999.99), diana (500.00), eve (500.00) -> eve comes before diana alphabetically
const expected = ["charlie", "diana", "eve"];
console.log("Expected:", expected);

// Check results
try {
  console.assert(top3.length === expected.length, "Should return exactly 3 accounts");
  for (let i = 0; i < expected.length; i++) {
    console.assert(top3[i] === expected[i], `Account ${i} should match expected: ${top3[i]} !== ${expected[i]}`);
  }
  console.log("PASS: richest function works correctly");
} catch (error) {
  console.error("FAIL: richest function test failed:", error.message);
}

// Test with n=1
console.log("\nTesting with n=1...");
const top1 = richest(ledger, 1);
console.log("Top 1 account:", top1);
const expected1 = ["charlie"];
try {
  console.assert(top1.length === 1, "Should return exactly 1 account");
  console.assert(top1[0] === expected1[0], `Account should match expected: ${top1[0]} !== ${expected1[0]}`);
  console.log("PASS: richest function works correctly with n=1");
} catch (error) {
  console.error("FAIL: richest function test failed with n=1:", error.message);
}

// Test with n=0
console.log("\nTesting with n=0...");
const top0 = richest(ledger, 0);
console.log("Top 0 accounts:", top0);
const expected0 = [];
try {
  console.assert(top0.length === 0, "Should return exactly 0 accounts");
  console.log("PASS: richest function works correctly with n=0");
} catch (error) {
  console.error("FAIL: richest function test failed with n=0:", error.message);
}