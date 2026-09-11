class Cart {
  constructor() {
    this.items = [];
  }
  
  addItem(name, price, qty) {
    this.items.push({ name, price, qty });
  }
  
  total() {
    return Math.round((this.items.reduce((sum, item) => sum + (item.price * item.qty), 0)) * 100) / 100;
  }
  
  applyDiscount(pct) {
    if (pct < 0 || pct > 100) {
      throw new Error("Discount percentage must be between 0 and 100");
    }
    const originalTotal = this.total();
    return originalTotal * (1 - pct / 100);
  }
}

module.exports = Cart;
