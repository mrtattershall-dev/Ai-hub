// Test that evenSplit is properly exported
const { evenSplit, balancesReport } = require('./r10_report');
const { Ledger } = require('./r1_ledger');

// Create a test ledger
const ledger = new Ledger();
ledger.open("alice");
ledger.open("bob");
ledger.open("charlie");

// Add some balance to alice
ledger.deposit("alice", 100);

console.log("Before evenSplit:");
console.log(balancesReport(ledger, ["alice", "bob", "charlie"]));

// Test evenSplit
const amounts = evenSplit(ledger, "alice", ["bob", "charlie"]);
console.log("Amounts moved:", amounts);
console.log("After evenSplit:");
console.log(balancesReport(ledger, ["alice", "bob", "charlie"]));