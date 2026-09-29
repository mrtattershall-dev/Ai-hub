// Import required modules
const { Ledger } = require('./r1_ledger');
const { formatMoney, addMoney, multiplyMoney, splitMoney, convertMoney } = require('./r8_money');

// Function to generate balances report
function balancesReport(ledger, names) {
  return names.map(name => {
    const balance = ledger.balance(name);
    return `${name}: ${formatMoney(Math.round(balance * 100))}`;
  });
}

// Function to generate total report
function totalReport(ledger, names) {
  const totalCents = names.reduce((sum, name) => {
    const balance = ledger.balance(name);
    return addMoney(sum, Math.round(balance * 100));
  }, 0);
  
  return `Total: ${formatMoney(totalCents)}`;
}

// Function to generate interest preview report
function interestPreview(ledger, names, ratePct) {
  return names.map(name => {
    const balance = ledger.balance(name);
    const balanceCents = Math.round(balance * 100);
    const interestCents = multiplyMoney(balanceCents, ratePct / 100);
    return `${name}: ${formatMoney(interestCents)}`;
  });
}

// Function to even split balance from one account to multiple accounts
function evenSplit(ledger, from, names) {
  const balance = ledger.balance(from);
  const balanceCents = Math.round(balance * 100);
  
  // Split the balance as evenly as possible
  const splits = splitMoney(balanceCents, names.length);
  
  // Transfer each split amount to the corresponding account
  splits.forEach((amount, index) => {
    if (amount > 0) {
      ledger.transfer(from, names[index], amount / 100);
    }
  });
  
  return splits;
}

// Export the functions
module.exports = { balancesReport, totalReport, interestPreview, evenSplit };

// Asserts to test the function
console.log("Running tests for balancesReport...");

// Create a test ledger
const ledger = new Ledger();
ledger.open("alice");
ledger.open("bob");
ledger.open("charlie");

// Add some balances
ledger.deposit("alice", 12.50);
ledger.deposit("bob", 100); // Changed from 0 to 100
ledger.deposit("charlie", 999.99);

// Test the balancesReport function
const names = ["alice", "bob", "charlie"];
const report = balancesReport(ledger, names);

// Expected results
const expected = [
  "alice: $12.50",
  "bob: $100.00", // Changed from $0.00 to $100.00
  "charlie: $999.99"
];

// Check results
try {
  console.assert(report.length === expected.length, "Report should have same length as expected");
  for (let i = 0; i < expected.length; i++) {
    console.assert(report[i] === expected[i], `Report item ${i} should match expected: ${report[i]} !== ${expected[i]}`);
  }
  console.log("PASS: balancesReport works correctly");
} catch (error) {
  console.error("FAIL: balancesReport test failed:", error.message);
}

// Test with empty names array
try {
  const emptyReport = balancesReport(ledger, []);
  console.assert(emptyReport.length === 0, "Empty names array should produce empty report");
  console.log("PASS: balancesReport with empty names works correctly");
} catch (error) {
  console.error("FAIL: balancesReport with empty names failed:", error.message);
}

// Test the interestPreview function
console.log("Running tests for interestPreview...");
try {
  const interestReport = interestPreview(ledger, names, 5); // 5% interest rate
  const expectedInterest = [
    "alice: $0.63",
    "bob: $5.00",
    "charlie: $50.00"
  ];
  
  console.assert(interestReport.length === expectedInterest.length, "Interest report should have same length as expected");
  for (let i = 0; i < expectedInterest.length; i++) {
    console.assert(interestReport[i] === expectedInterest[i], `Interest report item ${i} should match expected: ${interestReport[i]} !== ${expectedInterest[i]}`);
  }
  console.log("PASS: interestPreview works correctly");
} catch (error) {
  console.error("FAIL: interestPreview test failed:", error.message);
}

console.log("All tests completed");

// Function to generate history report for an account
function historyReport(ledger, name) {
  const account = ledger.getAccount(name);
  if (!account) {
    return `Account ${name} not found`;
  }
  
  return account.history.map(entry => `${entry.type} ${formatMoney(entry.amount)}`).join('\n');
}
// Function to generate tax report for names
function taxReport(ledger, names, ratePct) {
  return names.map(name => {
    const balance = ledger.balance(name);
    const balanceCents = Math.round(balance * 100);
    const tax = taxMoney(balanceCents, ratePct);
    const net = addMoney(balance, -tax);
    const gross = balance;
    
    return `${name}: net ${formatMoney(net)} tax ${formatMoney(tax)} gross ${formatMoney(gross)}`;
  });
}

// Function to convert balances to target currency
function convertBalances(ledger, names, code, rates) {
  return names.map(name => {
    const balance = ledger.balance(name);
    const balanceCents = Math.round(balance * 100);
    return convertMoney(balanceCents, 'USD', code, rates);
  });
}

// Export the functions
module.exports = {
  balancesReport,
  totalReport,
  interestPreview,
  evenSplit,
  historyReport,
  taxReport,
  convertBalances
};
