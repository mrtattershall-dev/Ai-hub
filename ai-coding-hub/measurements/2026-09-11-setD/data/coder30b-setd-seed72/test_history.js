const { Ledger } = require('./r1_ledger.js');

console.log("Testing history method...");

// Create a new ledger
const ledger = new Ledger();

// Open an account
ledger.open("testAccount");

// Deposit some money
ledger.deposit("testAccount", 100);

// Withdraw some money
ledger.withdraw("testAccount", 50);

// Transfer money
ledger.open("anotherAccount");
ledger.deposit("anotherAccount", 200);
ledger.transfer("testAccount", "anotherAccount", 25);

// Test history
try {
    const history = ledger.history("testAccount");
    console.log("History for testAccount:", JSON.stringify(history, null, 2));
    
    // Verify the history contains the expected entries
    if (history.length === 3) {
        console.log("PASS: History contains 3 entries");
        
        // Check first entry (deposit)
        if (history[0].type === 'deposit' && history[0].amount === 100) {
            console.log("PASS: First entry is deposit of 100");
        } else {
            console.log("FAIL: First entry incorrect");
        }
        
        // Check second entry (withdraw)
        if (history[1].type === 'withdraw' && history[1].amount === 50) {
            console.log("PASS: Second entry is withdrawal of 50");
        } else {
            console.log("FAIL: Second entry incorrect");
        }
        
        // Check third entry (transfer-out)
        if (history[2].type === 'transfer-out' && history[2].amount === 25) {
            console.log("PASS: Third entry is transfer-out of 25");
        } else {
            console.log("FAIL: Third entry incorrect");
        }
    } else {
        console.log("FAIL: History does not contain expected number of entries");
    }
    
} catch (error) {
    console.log("ERROR:", error.message);
}

// Test history for non-existent account
try {
    ledger.history("nonExistentAccount");
    console.log("FAIL: Should have thrown error for non-existent account");
} catch (error) {
    console.log("PASS: Correctly threw error for non-existent account");
}