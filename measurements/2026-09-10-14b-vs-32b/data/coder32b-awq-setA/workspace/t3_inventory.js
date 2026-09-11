class Inventory {
  constructor() {
    this.items = {};
  }

  add(name, qty) {
    if (typeof name !== 'string' || typeof qty !== 'number' || qty <= 0) {
      throw new Error('Invalid arguments for add.');
    }
    if (this.items[name]) {
      this.items[name] += qty;
    } else {
      this.items[name] = qty;
    }
    console.assert(this.items[name] > 0, `Quantity for ${name} should be positive.`);
  }

  count(name) {
    return this.items[name] || 0;
  }

  remove(name, qty) {
    if (this.items[name] && this.items[name] >= qty) {
      this.items[name] -= qty;
      if (this.items[name] === 0) {
        delete this.items[name];
      }
    } else {
      throw new Error(`Not enough ${name} to remove.`);
    }
  }
}

module.exports = Inventory;