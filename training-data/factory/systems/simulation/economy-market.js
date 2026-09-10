/**
 * Simulation economy: a Wallet holding currency, a Market that prices goods from supply, an
 * Inventory of owned goods, and a Store that ties them together — a purchase quotes the
 * Market, debits the Wallet, and deposits into the Inventory (selling reverses it and
 * returns stock to the Market). Each system owns one concern; they communicate only through
 * the Store. This is the economy -> store -> inventory chain.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class Wallet {
  constructor(balance) { this.balance = balance; }
  canAfford(n) { return this.balance >= n; }
  debit(n) { if (!this.canAfford(n)) return false; this.balance -= n; return true; }
  credit(n) { this.balance += n; }
}

class Inventory {
  constructor() { this.goods = new Map(); }
  add(id, qty) { this.goods.set(id, this.count(id) + qty); }
  remove(id, qty) { if (this.count(id) < qty) return false; this.goods.set(id, this.count(id) - qty); return true; }
  count(id) { return this.goods.get(id) || 0; }
}

class Market {
  constructor(base) { this.base = base; this.stock = new Map(); }     // id -> units available
  setStock(id, units) { this.stock.set(id, units); }
  units(id) { const u = this.stock.get(id); return u == null ? 50 : u; }
  price(id) {
    const base = this.base[id] || 1;
    return Math.round(base * (50 / Math.max(1, this.units(id))));       // scarcer -> pricier
  }
}

class Store {
  constructor(wallet, market, inventory) { this.wallet = wallet; this.market = market; this.inv = inventory; }
  buy(id, qty) {
    const cost = this.market.price(id) * qty;
    if (!this.wallet.debit(cost)) return { ok: false, cost };
    this.inv.add(id, qty);
    this.market.setStock(id, this.market.units(id) - qty);
    return { ok: true, cost };
  }
  sell(id, qty) {
    if (!this.inv.remove(id, qty)) return { ok: false };
    const gain = this.market.price(id) * qty;
    this.wallet.credit(gain);
    this.market.setStock(id, this.market.units(id) + qty);
    return { ok: true, gain };
  }
}

// --- self-checking demo ---
const wallet = new Wallet(1000);
const market = new Market({ ore: 10 });
market.setStock('ore', 50);
const inv = new Inventory();
const store = new Store(wallet, market, inv);

assert(market.price('ore') === 10, 'price equals base at neutral stock');
const buy = store.buy('ore', 10);
assert(buy.ok && buy.cost === 100, 'bought ten ore for one hundred');
assert(wallet.balance === 900, 'the wallet was debited');
assert(inv.count('ore') === 10, 'the inventory received the ore');
assert(market.price('ore') > 10, 'the price rose as market stock fell');
const sell = store.sell('ore', 5);
assert(sell.ok && inv.count('ore') === 5, 'sold five ore back to the market');
assert(wallet.balance > 900, 'the wallet was credited from the sale');
console.log('simulation/economy-market OK');
