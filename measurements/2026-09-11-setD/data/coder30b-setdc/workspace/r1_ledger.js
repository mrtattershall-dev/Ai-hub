class Ledger {
  constructor() {
    this.accounts = new Map();
    this.history = new Map(); // Store transaction history for each account
    this.undoStack = []; // Stack to track operations for undo
  }
  
  open(name) {
    if (this.accounts.has(name)) {
      throw new Error(`Account ${name} already exists`);
    }
    this.accounts.set(name, 0);
  }
  
  deposit(name, amount) {
    if (!this.accounts.has(name)) {
      throw new Error(`Unknown account ${name}`);
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error(`Invalid deposit amount ${amount}`);
    }
    const oldBalance = this.accounts.get(name);
    this.accounts.set(name, oldBalance + amount);
    // Record transaction in history
    if (!this.history.has(name)) {
      this.history.set(name, []);
    }
    this.history.get(name).push({ type: 'deposit', amount });
    // Add to undo stack
    this.undoStack.push({ type: 'deposit', account: name, amount, oldBalance });
  }
  
  balance(name) {
    if (!this.accounts.has(name)) {
      throw new Error(`Unknown account ${name}`);
    }
    return this.accounts.get(name);
  }
  
  withdraw(name, amount) {
    if (!this.accounts.has(name)) {
      throw new Error(`Unknown account ${name}`);
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error(`Invalid withdrawal amount ${amount}`);
    }
    if (this.accounts.get(name) < amount) {
      throw new Error(`Insufficient funds in account ${name}`);
    }
    const oldBalance = this.accounts.get(name);
    this.accounts.set(name, oldBalance - amount);
    // Record transaction in history
    if (!this.history.has(name)) {
      this.history.set(name, []);
    }
    this.history.get(name).push({ type: 'withdraw', amount });
    // Add to undo stack
    this.undoStack.push({ type: 'withdraw', account: name, amount, oldBalance });
  }
  
  transfer(from, to, amount) {
    if (from === to) {
      throw new Error(`Cannot transfer from and to the same account ${from}`);
    }
    if (!this.accounts.has(from)) {
      throw new Error(`Unknown account ${from}`);
    }
    if (!this.accounts.has(to)) {
      throw new Error(`Unknown account ${to}`);
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error(`Invalid transfer amount ${amount}`);
    }
    if (this.accounts.get(from) < amount) {
      throw new Error(`Insufficient funds in account ${from}`);
    }
    
    // All validations passed, perform the transfer atomically
    const oldFromBalance = this.accounts.get(from);
    const oldToBalance = this.accounts.get(to);
    this.accounts.set(from, oldFromBalance - amount);
    this.accounts.set(to, oldToBalance + amount);
    
    // Record transactions in history
    if (!this.history.has(from)) {
      this.history.set(from, []);
    }
    if (!this.history.has(to)) {
      this.history.set(to, []);
    }
    this.history.get(from).push({ type: 'transfer-out', amount });
    this.history.get(to).push({ type: 'transfer-in', amount });
    
    // Add to undo stack
    this.undoStack.push({ type: 'transfer', from, to, amount, oldFromBalance, oldToBalance });
  }
  
  undo() {
    if (this.undoStack.length === 0) {
      throw new Error("Nothing to undo");
    }
    
    const lastOp = this.undoStack.pop();
    
    if (lastOp.type === 'deposit') {
      // Revert deposit by subtracting the amount
      this.accounts.set(lastOp.account, lastOp.oldBalance);
      // Remove the deposit from history
      const accountHistory = this.history.get(lastOp.account);
      if (accountHistory && accountHistory.length > 0) {
        accountHistory.pop();
      }
    } else if (lastOp.type === 'withdraw') {
      // Revert withdrawal by adding back the amount
      this.accounts.set(lastOp.account, lastOp.oldBalance);
      // Remove the withdrawal from history
      const accountHistory = this.history.get(lastOp.account);
      if (accountHistory && accountHistory.length > 0) {
        accountHistory.pop();
      }
    } else if (lastOp.type === 'transfer') {
      // Revert transfer by restoring balances
      this.accounts.set(lastOp.from, lastOp.oldFromBalance);
      this.accounts.set(lastOp.to, lastOp.oldToBalance);
      // Remove the transfer from history for both accounts
      const fromHistory = this.history.get(lastOp.from);
      const toHistory = this.history.get(lastOp.to);
      if (fromHistory && fromHistory.length > 0) {
        fromHistory.pop();
      }
      if (toHistory && toHistory.length > 0) {
        toHistory.pop();
      }
    }
  }
  
  history(name) {
    if (!this.accounts.has(name)) {
      throw new Error(`Unknown account ${name}`);
    }
    // Return the transaction history for the account, or empty array if none
    return this.history.get(name) || [];
  }
  
  applyInterest(ratePct) {
    let totalInterest = 0;
    
    // Iterate through all accounts
    for (const [name, balance] of this.accounts.entries()) {
      // Skip frozen accounts and accounts with non-positive balance
      if (balance <= 0) {
        continue;
      }
      
      // Calculate interest: balance * ratePct / 100
      const interest = balance * ratePct / 100;
      
      // Round to nearest cent
      const roundedInterest = Math.round(interest * 100) / 100;
      
      // Add interest to balance
      this.accounts.set(name, balance + roundedInterest);
      
      // Record interest in history
      if (!this.history.has(name)) {
        this.history.set(name, []);
      }
      this.history.get(name).push({ type: 'interest', amount: roundedInterest });
      
      // Add to total interest paid
      totalInterest += roundedInterest;
    }
    
    return totalInterest;
  }
  
  toCSV() {
    // Create header line
    let csv = 'account,balance';
    
    // Get all accounts and sort them by name
    const sortedAccounts = Array.from(this.accounts.entries()).sort(([a], [b]) => a.localeCompare(b));
    
    // Add each account with its balance formatted to 2 decimal places
    for (const [name, balance] of sortedAccounts) {
      csv += `\n${name},${balance.toFixed(2)}`;
    }
    
    return csv;
  }
  
  static fromCSV(text) {
    // Parse CSV text into lines
    const lines = text.trim().split('\n');
    
    // Check for empty input
    if (lines.length === 0) {
      throw new Error("CSV data is empty");
    }
    
    // Check header line
    const header = lines[0];
    if (header !== 'account,balance') {
      throw new Error(`Invalid header: expected "account,balance", got "${header}"`);
    }
    
    // Create new ledger
    const ledger = new Ledger();
    
    // Process each data line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (line === '') continue;
      
      // Split line by comma
      const parts = line.split(',');
      
      // Check line format
      if (parts.length !== 2) {
        throw new Error(`Malformed line: ${line}`);
      }
      
      const accountName = parts[0];
      const balanceStr = parts[1];
      
      // Validate account name
      if (accountName === '') {
        throw new Error(`Empty account name in line: ${line}`);
      }
      
      // Parse balance
      const balance = parseFloat(balanceStr);
      
      // Validate balance
      if (isNaN(balance) || balance < 0) {
        throw new Error(`Invalid balance "${balanceStr}" in line: ${line}`);
      }
      
      // Open account
      ledger.open(accountName);
      
      // If balance is positive, make a deposit
      if (balance > 0) {
        ledger.deposit(accountName, balance);
      }
    }
    
    return ledger;
  }
}

// Export the Ledger class
module.exports = { Ledger };
// Test asserts
const ledger = new Ledger();

// Test open
ledger.open("account1");
try {
  ledger.open("account1");
  console.error("ERROR: Should have thrown for duplicate account");
} catch (e) {
  console.log("PASS: Duplicate account detection works");
}

// Test deposit
ledger.deposit("account1", 100);
if (ledger.balance("account1") !== 100) {
  console.error("ERROR: Deposit failed");
} else {
  console.log("PASS: Deposit works");
}

// Test deposit with invalid amount
try {
  ledger.deposit("account1", -50);
  console.error("ERROR: Should have thrown for negative deposit");
} catch (e) {
  console.log("PASS: Negative deposit detection works");
}

try {
  ledger.deposit("account1", 0);
  console.error("ERROR: Should have thrown for zero deposit");
} catch (e) {
  console.log("PASS: Zero deposit detection works");
}

// Test unknown account deposit
try {
  ledger.deposit("account2", 100);
  console.error("ERROR: Should have thrown for unknown account");
} catch (e) {
  console.log("PASS: Unknown account deposit detection works");
}

// Test balance
if (ledger.balance("account1") !== 100) {
  console.error("ERROR: Balance check failed");
} else {
  console.log("PASS: Balance check works");
}

// Test unknown account balance
try {
  ledger.balance("account2");
  console.error("ERROR: Should have thrown for unknown account balance");
} catch (e) {
  console.log("PASS: Unknown account balance detection works");
}

console.log("All tests completed");

// Test withdraw
try {
  ledger.withdraw("account1", 50);
  if (ledger.balance("account1") !== 50) {
    console.error("ERROR: Withdraw failed");
  } else {
    console.log("PASS: Withdraw works");
  }
} catch (e) {
  console.error("ERROR: Withdraw should not have thrown:", e.message);
}

// Test withdraw with invalid amount
try {
  ledger.withdraw("account1", -25);
  console.error("ERROR: Should have thrown for negative withdrawal");
} catch (e) {
  console.log("PASS: Negative withdrawal detection works");
}

try {
  ledger.withdraw("account1", 0);
  console.error("ERROR: Should have thrown for zero withdrawal");
} catch (e) {
  console.log("PASS: Zero withdrawal detection works");
}

// Test unknown account withdrawal
try {
  ledger.withdraw("account2", 100);
  console.error("ERROR: Should have thrown for unknown account withdrawal");
} catch (e) {
  console.log("PASS: Unknown account withdrawal detection works");
}

// Test insufficient funds
try {
  ledger.withdraw("account1", 100);
  console.error("ERROR: Should have thrown for insufficient funds");
} catch (e) {
  console.log("PASS: Insufficient funds detection works");
}
