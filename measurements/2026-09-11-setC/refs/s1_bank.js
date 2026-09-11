// Reference solution (final state of chain 1) - used only to prove checks-C.mjs can pass.
class Bank {
  constructor() { this.accounts = new Map(); }
  _acct(name) { const a = this.accounts.get(name); if (!a) throw new Error('unknown account: ' + name); return a; }
  _amt(amount) { if (!(typeof amount === 'number' && Number.isFinite(amount) && amount > 0)) throw new Error('amount must be a positive number'); }
  open(name) { if (this.accounts.has(name)) throw new Error('account exists: ' + name); this.accounts.set(name, { balance: 0, history: [] }); }
  deposit(name, amount) { this._amt(amount); const a = this._acct(name); a.balance += amount; a.history.push({ type: 'deposit', amount }); }
  balance(name) { return this._acct(name).balance; }
  withdraw(name, amount) { this._amt(amount); const a = this._acct(name); if (amount > a.balance) throw new Error('insufficient funds'); a.balance -= amount; a.history.push({ type: 'withdraw', amount }); }
  transfer(from, to, amount) {
    this._amt(amount); const a = this._acct(from); const b = this._acct(to);
    if (amount > a.balance) throw new Error('insufficient funds');
    a.balance -= amount; b.balance += amount;
    a.history.push({ type: 'transfer-out', amount }); b.history.push({ type: 'transfer-in', amount });
  }
  history(name) { return this._acct(name).history.map((h) => ({ ...h })); }
}
module.exports = { Bank };
