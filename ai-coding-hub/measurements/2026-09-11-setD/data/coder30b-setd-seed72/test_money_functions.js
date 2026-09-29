// Test the Ledger transfer function
const { Ledger } = require('./r1_ledger.js');

console.log("Testing Ledger transfer function:");
const ledger = new Ledger();

// Set up test accounts
ledger.open("account1");
ledger.open("account2");
ledger.deposit("account1", 100);

// Test successful transfer
try {
    ledger.transfer("account1", "account2", 50);
    console.log("PASS: Transfer works");
    console.log("account1 balance:", ledger.balance("account1"));
    console.log("account2 balance:", ledger.balance("account2"));
} catch (error) {
    console.error("ERROR: Transfer failed:", error.message);
}

// Test transfer to same account
try {
    ledger.transfer("account1", "account1", 25);
    console.error("ERROR: Should have thrown for same account transfer");
} catch (error) {
    console.log("PASS: Same account transfer correctly rejected:", error.message);
}

// Test transfer from unknown account
try {
    ledger.transfer("unknown", "account2", 25);
    console.error("ERROR: Should have thrown for unknown from account");
} catch (error) {
    console.log("PASS: Unknown from account transfer correctly rejected:", error.message);
}

// Test transfer to unknown account
try {
    ledger.transfer("account1", "unknown", 25);
    console.error("ERROR: Should have thrown for unknown to account");
} catch (error) {
    console.log("PASS: Unknown to account transfer correctly rejected:", error.message);
}

// Test transfer with invalid amount
try {
    ledger.transfer("account1", "account2", -25);
    console.error("ERROR: Should have thrown for negative transfer");
} catch (error) {
    console.log("PASS: Negative transfer correctly rejected:", error.message);
}

try {
    ledger.transfer("account1", "account2", 0);
    console.error("ERROR: Should have thrown for zero transfer");
} catch (error) {
    console.log("PASS: Zero transfer correctly rejected:", error.message);
}

// Test transfer with insufficient funds
try {
    ledger.transfer("account1", "account2", 100);
    console.error("ERROR: Should have thrown for insufficient funds");
} catch (error) {
    console.log("PASS: Insufficient funds transfer correctly rejected:", error.message);
}

// Test that balances haven't changed after failed transfers
console.log("account1 balance after failed transfers:", ledger.balance("account1"));
console.log("account2 balance after failed transfers:", ledger.balance("account2"));

console.log("\nAll tests completed!");