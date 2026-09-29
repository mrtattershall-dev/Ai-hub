const { Ledger } = require('./r1_ledger.js');

// Create a new ledger
const ledger = new Ledger();

// Add some test accounts
ledger.open("alice");
ledger.open("bob");
ledger.open("charlie");

// Add some balances
ledger.deposit("alice", 12.5);
ledger.deposit("bob", 25.75);
ledger.deposit("charlie", 50.0);

// Test toCSV method
const csvOutput = ledger.toCSV();
console.log("CSV Output:");
console.log(csvOutput);

// Verify the output format
const lines = csvOutput.split('\n');
if (lines.length === 4) { // header + 3 accounts
  console.log("PASS: Correct number of lines");
} else {
  console.log("FAIL: Incorrect number of lines");
}

// Check header
if (lines[0] === 'account,balance') {
  console.log("PASS: Correct header");
} else {
  console.log("FAIL: Incorrect header");
}

// Check account order (should be sorted)
if (lines[1].startsWith('alice,') && lines[2].startsWith('bob,') && lines[3].startsWith('charlie,')) {
  console.log("PASS: Accounts sorted correctly");
} else {
  console.log("FAIL: Accounts not sorted correctly");
}

// Check balances are formatted to 2 decimals
const aliceLine = lines[1];
const bobLine = lines[2];
const charlieLine = lines[3];

if (aliceLine === 'alice,12.50' && bobLine === 'bob,25.75' && charlieLine === 'charlie,50.00') {
  console.log("PASS: Balances formatted correctly to 2 decimals");
} else {
  console.log("FAIL: Balances not formatted correctly");
  console.log("Alice line:", aliceLine);
  console.log("Bob line:", bobLine);
  console.log("Charlie line:", charlieLine);
}