// Reference solution (final state of chain q1) - used only to prove checks-E.mjs can pass.
class Warehouse {
  constructor() { this.st = new Map(); this.res = []; this.hist = new Map(); }
  _q(qty) { if (!Number.isInteger(qty) || qty <= 0) throw new Error('qty must be a positive integer'); }
  _h(sku, e) { if (!this.hist.has(sku)) this.hist.set(sku, []); this.hist.get(sku).push(e); }
  addItem(sku, qty) { this._q(qty); this.st.set(sku, this.stock(sku) + qty); this._h(sku, { type: 'add', qty }); }
  stock(sku) { return this.st.get(sku) || 0; }
  skus() { return [...this.st.keys()].sort(); }
  _reserved(sku) { return this.res.filter((r) => r.sku === sku).reduce((a, r) => a + r.qty, 0); }
  available(sku) { return this.stock(sku) - this._reserved(sku); }
  remove(sku, qty) {
    this._q(qty);
    if (qty > this.available(sku)) throw new Error('not enough available stock of ' + sku);
    this.st.set(sku, this.stock(sku) - qty); this._h(sku, { type: 'remove', qty });
  }
  reserve(sku, qty, orderId) {
    this._q(qty);
    if (this.res.some((r) => r.orderId === orderId && r.sku === sku)) throw new Error(`order ${orderId} already holds a reservation for ${sku}`);
    if (qty > this.available(sku)) throw new Error('not enough available stock of ' + sku);
    this.res.push({ orderId, sku, qty }); this._h(sku, { type: 'reserve', qty, orderId });
  }
  release(orderId) {
    const mine = this.res.filter((r) => r.orderId === orderId);
    this.res = this.res.filter((r) => r.orderId !== orderId);
    for (const r of mine) this._h(r.sku, { type: 'release', qty: r.qty, orderId });
    return mine.reduce((a, r) => a + r.qty, 0);
  }
  fulfil(orderId) {
    const mine = this.res.filter((r) => r.orderId === orderId);
    if (!mine.length) throw new Error('no reservations for order ' + orderId);
    this.res = this.res.filter((r) => r.orderId !== orderId);
    for (const r of mine) { this.st.set(r.sku, this.stock(r.sku) - r.qty); this._h(r.sku, { type: 'fulfil', qty: r.qty, orderId }); }
  }
  lowStock(threshold) { return this.skus().filter((s) => this.available(s) < threshold); }
  toJSON() {
    const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
    return {
      stock: Object.fromEntries(this.skus().map((s) => [s, this.stock(s)])),
      reservations: [...this.res].sort((a, b) => cmp(a.orderId, b.orderId) || cmp(a.sku, b.sku)).map((r) => ({ orderId: r.orderId, sku: r.sku, qty: r.qty })),
    };
  }
  static fromJSON(data) {
    const w = new Warehouse();
    for (const [s, q] of Object.entries(data.stock || {})) w.st.set(s, q);
    for (const r of data.reservations || []) w.res.push({ orderId: r.orderId, sku: r.sku, qty: r.qty });
    return w;
  }
  history(sku) { return (this.hist.get(sku) || []).map((e) => ({ ...e })); }
}
module.exports = { Warehouse };
