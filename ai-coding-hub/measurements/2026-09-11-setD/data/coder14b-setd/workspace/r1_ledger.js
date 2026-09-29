class Ledger {
  constructor() {
    this.accounts = {};
  }

  open(name) {
    if (this.accounts[name]) {
      throw new Error(`Account ${name} already exists.`);
    }
    this.accounts[name] = 0;
  }

  deposit(name, amount) {
    if (!this.accounts[name]) {
      throw new Error(`Unknown account ${name}.`);
    }
    if (amount <= 0) {
      throw new Error(`Amount ${amount} is not a positive number.`);
    }
    this.accounts[name] += amount;
  }

  balance(name) {
    if (!this.accounts[name]) {
      throw new Error(`Unknown account ${name}.`);
    }
    return this.accounts[name];
  }
}

module.exports = Ledger;