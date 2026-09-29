class Inventory {
  constructor() {
    this.items = new Map();
  }

  add(name, qty) {
    if (qty < 0) throw new Error('Quantity must be non-negative');
    this.items.set(name, (this.items.get(name) || 0) + qty);
  }

  remove(name, qty) {
    if (qty < 0) throw new Error('Quantity must be non-negative');
    const current = this.items.get(name) || 0;
    if (current < qty) throw new Error('Not enough stock');
    this.items.set(name, current - qty);
  }

  count(name) {
    return this.items.get(name) || 0;
  }
}{ Inventory };