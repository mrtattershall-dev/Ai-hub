class Account {
  constructor() {
    this.balance = 0;
    this.history = [];
  }

  deposit(amount) {
    if (amount > 0) {
      this.balance += amount;
      this.history.push({ type: 'deposit', amount });
    }
  }

  withdraw(amount) {
    if (amount > 0 && this.balance >= amount) {
      this.balance -= amount;
      this.history.push({ type: 'withdraw', amount });
    } else {
      throw new Error('Overdraft');
    }
  }

  getHistory() {
    return this.history;
  }

  deposit(amount) {
    if (amount > 0) {
      this.balance += amount;
      this.history.push({ type: 'deposit', amount });
    }
  }

  withdraw(amount) {
    if (amount > 0 && this.balance >= amount) {
      this.balance -= amount;
      this.history.push({ type: 'withdraw', amount });
    } else {
      throw new Error('Overdraft');
    }
  }
}

module.exports = Account;
const assert = require('assert');

// Test deposit
const account = new Account();
account.deposit(100);
assert.strictEqual(account.balance, 100);
assert.deepStrictEqual(account.getHistory(), [{ type: 'deposit', amount: 100 }]);

// Test withdraw
account.withdraw(50);
assert.strictEqual(account.balance, 50);
assert.deepStrictEqual(account.getHistory(), [{ type: 'deposit', amount: 100 }, { type: 'withdraw', amount: 50 }]);

// Test overdraft
try {
  account.withdraw(100);
  assert.fail('Expected overdraft error');
} catch (e) {
  assert.strictEqual(e.message, 'Overdraft');
}

console.log('All tests passed');
