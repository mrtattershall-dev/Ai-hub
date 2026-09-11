// Inventory class implementation
class Inventory {
  constructor() {
    this.items = {};
  }

  add(name, qty) {
    if (name === undefined || name === null) {
      throw new Error("Item name cannot be undefined or null");
    }
    if (typeof qty !== 'number' || qty <= 0) {
      throw new Error("Quantity must be a positive number");
    }
    
    if (this.items[name]) {
      this.items[name] += qty;
    } else {
      this.items[name] = qty;
    }
  }

  remove(name, qty) {
    if (name === undefined || name === null) {
      throw new Error("Item name cannot be undefined or null");
    }
    if (typeof qty !== 'number' || qty <= 0) {
      throw new Error("Quantity must be a positive number");
    }
    
    if (!this.items[name]) {
      throw new Error(`Cannot remove ${qty} of ${name}: item not found`);
    }
    
    if (this.items[name] < qty) {
      throw new Error(`Cannot remove ${qty} of ${name}: insufficient stock`);
    }
    
    this.items[name] -= qty;
    
    // Remove item from inventory if quantity reaches 0
    if (this.items[name] === 0) {
      delete this.items[name];
    }
  }

  count(name) {
    if (name === undefined || name === null) {
      throw new Error("Item name cannot be undefined or null");
    }
    return this.items[name] || 0;
  }
}

// Export the Inventory class
module.exports = { Inventory };