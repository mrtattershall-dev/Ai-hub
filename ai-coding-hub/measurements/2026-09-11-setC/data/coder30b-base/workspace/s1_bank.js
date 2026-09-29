// Bank class implementation
class Bank {
  constructor() {
    this.accounts = {};
    this.transactions = {};
  }
  
  open(name) {
    if (this.accounts[name] !== undefined) {
      throw new Error(`Account ${name} already exists`);
    }
    this.accounts[name] = 0;
  }
  
  deposit(name, amount) {
    if (this.accounts[name] === undefined) {
      throw new Error(`Account ${name} does not exist`);
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error(`Invalid deposit amount: ${amount}`);
    }
    this.accounts[name] += amount;
    if (!this.transactions[name]) {
      this.transactions[name] = [];
    }
    this.transactions[name].push({ type: 'deposit', amount });
  }
  
  balance(name) {
    if (this.accounts[name] === undefined) {
      throw new Error(`Account ${name} does not exist`);
    }
    return this.accounts[name];
  }
  
  withdraw(name, amount) {
    if (this.accounts[name] === undefined) {
      throw new Error(`Account ${name} does not exist`);
    }
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error(`Invalid withdrawal amount: ${amount}`);
    }
    if (this.accounts[name] < amount) {
      throw new Error(`Insufficient funds in account ${name}`);
    }
    this.accounts[name] -= amount;
    if (!this.transactions[name]) {
      this.transactions[name] = [];
    }
    this.transactions[name].push({ type: 'withdraw', amount });
  }
  
  transfer(from, to, amount) {
    // Validate accounts exist
    if (this.accounts[from] === undefined) {
      throw new Error(`Account ${from} does not exist`);
    }
    if (this.accounts[to] === undefined) {
      throw new Error(`Account ${to} does not exist`);
    }
    
    // Validate amount
    if (typeof amount !== 'number' || amount <= 0) {
      throw new Error(`Invalid transfer amount: ${amount}`);
    }
    
    // Validate sufficient funds
    if (this.accounts[from] < amount) {
      throw new Error(`Insufficient funds in account ${from}`);
    }
    
    // Perform transfer atomically
    this.accounts[from] -= amount;
    this.accounts[to] += amount;
    
    // Record transactions
    if (!this.transactions[from]) {
      this.transactions[from] = [];
    }
    if (!this.transactions[to]) {
      this.transactions[to] = [];
    }
    this.transactions[from].push({ type: 'transfer-out', amount });
    this.transactions[to].push({ type: 'transfer-in', amount });
  }
  
  history(name) {
    if (this.accounts[name] === undefined) {
      throw new Error(`Account ${name} does not exist`);
    }
    return this.transactions[name] || [];
  }
}

// Export the Bank class
module.exports = Bank;