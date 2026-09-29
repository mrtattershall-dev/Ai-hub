class Ledger {
  constructor() {
    this.accounts = new Map();
    this.history = new Map(); // Store transaction history for each account
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
    this.accounts.set(name, this.accounts.get(name) + amount);
    // Record transaction in history
    if (!this.history.has(name)) {
      this.history.set(name, []);
    }
    this.history.get(name).push({ type: 'deposit', amount });
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
    this.accounts.set(name, this.accounts.get(name) - amount);
    // Record transaction in history
    if (!this.history.has(name)) {
      this.history.set(name, []);
    }
    this.history.get(name).push({ type: 'withdraw', amount });
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
    this.accounts.set(from, this.accounts.get(from) - amount);
    this.accounts.set(to, this.accounts.get(to) + amount);
    
    // Record transactions in history
    if (!this.history.has(from)) {
      this.history.set(from, []);
    }
    if (!this.history.has(to)) {
      this.history.set(to, []);
    }
    this.history.get(from).push({ type: 'transfer-out', amount });
    this.history.get(to).push({ type: 'transfer-in', amount });
  }
  
  history(name) {
    if (!this.accounts.has(name)) {
      throw new Error(`Unknown account ${name}`);
    }
    // Return the transaction history for the account, or empty array if none
    return this.history.get(name) || [];
  }
}

// Export the Ledger class
module.exports = { Ledger };