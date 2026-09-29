const { Ledger } = require('./r1_ledger.js');
const { taxReport } = require('./r10_report.js');

console.log("Testing taxReport function...");

// Create a new ledger
const ledger = new Ledger();

// Open some test accounts with different balances
ledger.open("Alice");
ledger.deposit("Alice", 1000);

ledger.open("Bob");
ledger.deposit("Bob", 2000);

ledger.open("Charlie");
ledger.deposit("Charlie", 500);

// Test taxReport with 10% tax rate
try {
    const names = ["Alice", "Bob", "Charlie"];
    const ratePct = 10;
    const result = taxReport(ledger, names, ratePct);
    
    console.log("Tax Report Results:");
    result.forEach(line => console.log(line));
    
    // Verify the format
    console.log("\nVerifying format:");
    result.forEach((line, index) => {
        if (line.includes(": net") && line.includes("tax") && line.includes("gross")) {
            console.log(`PASS: Line ${index + 1} has correct format`);
        } else {
            console.log(`FAIL: Line ${index + 1} has incorrect format: ${line}`);
        }
    });
    
} catch (error) {
    console.log("ERROR:", error.message);
}