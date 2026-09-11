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
// Test asserts
const inventory = new Inventory();

// Test adding items
inventory.add("sword", 1);
console.assert(inventory.count("sword") === 1, "Failed to add sword");

inventory.add("sword", 2);
console.assert(inventory.count("sword") === 3, "Failed to add more swords");

inventory.add("potion", 5);
console.assert(inventory.count("potion") === 5, "Failed to add potion");

// Test removing items
inventory.remove("sword", 1);
console.assert(inventory.count("sword") === 2, "Failed to remove sword");

inventory.remove("potion", 3);
console.assert(inventory.count("potion") === 2, "Failed to remove potion");

// Test removing all items
inventory.remove("sword", 2);
console.assert(inventory.count("sword") === 0, "Failed to remove all swords");
console.assert(!inventory.items.hasOwnProperty("sword"), "Item should be removed from inventory when count reaches 0");

// Test error conditions
let errorCaught = false;
try {
  inventory.remove("nonexistent", 1);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Should throw error when removing non-existent item");

errorCaught = false;
try {
  inventory.remove("potion", 5);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Should throw error when removing more than available");

errorCaught = false;
try {
  inventory.add("shield", -1);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Should throw error when adding negative quantity");

errorCaught = false;
try {
  inventory.add("shield", 0);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Should throw error when adding zero quantity");

console.log("All asserts passed!");
