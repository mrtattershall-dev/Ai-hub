// Reference solution (final state of chain r1) - used only to prove checks-D.mjs can pass.
class Ledger {
  constructor() { this.acc = new Map(); this.log = []; }
  _a(name) { const a = this.acc.get(name); if (!a) throw new Error('unknown account: ' + name); return a; }
  _amt(x) { if (!(typeof x === 'number' && Number.isFinite(x) && x > 0)) throw new Error('amount must be a positive number'); }
  _live(a, name) { if (a.frozen) throw new Error('account is frozen: ' + name); }
  open(name) { if (this.acc.has(name)) throw new Error('account exists: ' + name); this.acc.set(name, { balance: 0, history: [], frozen: false }); }
  deposit(name, amount) { this._amt(amount); const a = this._a(name); this._live(a, name); a.balance += amount; a.history.push({ type: 'deposit', amount }); this.log.push({ kind: 'deposit', name, amount }); }
  balance(name) { return this._a(name).balance; }
  withdraw(name, amount) {
    this._amt(amount); const a = this._a(name); this._live(a, name);
    if (amount > a.balance) throw new Error('not enough money');
    a.balance -= amount; a.history.push({ type: 'withdraw', amount }); this.log.push({ kind: 'withdraw', name, amount });
  }
  transfer(from, to, amount) {
    this._amt(amount); const a = this._a(from), b = this._a(to);
    if (from === to) throw new Error('cannot transfer to the same account');
    this._live(a, from); this._live(b, to);
    if (amount > a.balance) throw new Error('not enough money');
    a.balance -= amount; b.balance += amount;
    a.history.push({ type: 'transfer-out', amount }); b.history.push({ type: 'transfer-in', amount });
    this.log.push({ kind: 'transfer', from, to, amount });
  }
  history(name) { return this._a(name).history.map((h) => ({ ...h })); }
  freeze(name) { this._a(name).frozen = true; }
  unfreeze(name) { this._a(name).frozen = false; }
  undo() {
    const op = this.log.pop(); if (!op) throw new Error('nothing to undo');
    const drop = (a, type, amount) => { for (let i = a.history.length - 1; i >= 0; i--) if (a.history[i].type === type && a.history[i].amount === amount) { a.history.splice(i, 1); return; } };
    if (op.kind === 'deposit') { const a = this.acc.get(op.name); a.balance -= op.amount; drop(a, 'deposit', op.amount); }
    else if (op.kind === 'withdraw') { const a = this.acc.get(op.name); a.balance += op.amount; drop(a, 'withdraw', op.amount); }
    else { const a = this.acc.get(op.from), b = this.acc.get(op.to); a.balance += op.amount; b.balance -= op.amount; drop(a, 'transfer-out', op.amount); drop(b, 'transfer-in', op.amount); }
  }
  applyInterest(ratePct) {
    let total = 0;
    for (const a of this.acc.values()) {
      if (a.frozen || !(a.balance > 0)) continue;
      const i = Math.round(a.balance * ratePct / 100 * 100) / 100;
      if (i <= 0) continue;
      a.balance += i; a.history.push({ type: 'interest', amount: i }); total += i;
    }
    return Math.round(total * 100) / 100;
  }
  toCSV() { return ['account,balance', ...[...this.acc.keys()].sort().map((n) => n + ',' + this.acc.get(n).balance.toFixed(2))].join('\n'); }
  static fromCSV(text) {
    const lines = String(text).split('\n');
    if (lines[0] !== 'account,balance') throw new Error('bad header');
    const l = new Ledger();
    for (const line of lines.slice(1)) {
      const m = /^([^,]+),(\d+(?:\.\d+)?)$/.exec(line); if (!m) throw new Error('malformed line: ' + line);
      l.open(m[1]); const v = Number(m[2]); if (v > 0) l.deposit(m[1], v);
    }
    return l;
  }
}
module.exports = { Ledger };
