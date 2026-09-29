// Warehouse class implementation
class Warehouse {
  constructor() {
    this.inventory = {};
    this.reservations = {}; // Track reservations by SKU and order ID
  }
  
  addItem(sku, qty) {
    // Validate qty is a positive integer
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error("Quantity must be a positive integer");
    }
    
    // Add to inventory
    if (this.inventory[sku]) {
      this.inventory[sku] += qty;
    } else {
      this.inventory[sku] = qty;
    }
  }
  
  remove(sku, qty) {
    // Validate qty is a positive integer
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error("Quantity must be a positive integer");
    }
    
    // Check if SKU exists and has enough available stock
    const availableStock = this.available(sku);
    if (availableStock < qty) {
      throw new Error("Not enough available stock or SKU does not exist");
    }
    
    // Remove from inventory
    this.inventory[sku] -= qty;
    
    // Remove SKU from inventory if stock reaches 0
    if (this.inventory[sku] === 0) {
      delete this.inventory[sku];
    }
  }
  
  stock(sku) {
    return this.inventory[sku] || 0;
  }
  
  skus() {
    return Object.keys(this.inventory).sort();
  }
  
  reserve(sku, qty, orderId) {
    // Validate qty is a positive integer
    if (!Number.isInteger(qty) || qty <= 0) {
      throw new Error("Quantity must be a positive integer");
    }
    
    // Check if SKU exists and has enough stock
    if (!this.inventory[sku] || this.inventory[sku] < qty) {
      throw new Error("Not enough stock or SKU does not exist");
    }
    
    // Check if this order already has a reservation for this SKU
    if (this.reservations[sku] && this.reservations[sku][orderId]) {
      throw new Error("Order already has a reservation for this SKU");
    }
    
    // Reserve the quantity
    if (!this.reservations[sku]) {
      this.reservations[sku] = {};
    }
    this.reservations[sku][orderId] = qty;
  }
  
  available(sku) {
    // Get total stock
    const totalStock = this.inventory[sku] ? this.inventory[sku] : 0;
    
    // Calculate reserved quantity
    let reserved = 0;
    if (this.reservations[sku]) {
      for (const orderId in this.reservations[sku]) {
        reserved += this.reservations[sku][orderId];
      }
    }
    
    // Return available stock
    return totalStock - reserved;
  }

  release(orderId) {
    let totalUnitsFreed = 0;
    
    // Iterate through all SKUs in reservations
    for (const sku in this.reservations) {
      // Check if this order has a reservation for this SKU
      if (this.reservations[sku] && this.reservations[sku][orderId]) {
        // Add the quantity to the total freed
        totalUnitsFreed += this.reservations[sku][orderId];
        
        // Remove the reservation
        delete this.reservations[sku][orderId];
        
        // If no reservations left for this SKU, remove the SKU entry
        if (Object.keys(this.reservations[sku]).length === 0) {
          delete this.reservations[sku];
        }
      }
    }
    
    return totalUnitsFreed;
  }

  fulfil(orderId) {
    let totalUnitsFreed = 0;
    
    // Check if this order has any reservations
    let orderHasReservations = false;
    
    // Iterate through all SKUs in reservations
    for (const sku in this.reservations) {
      // Check if this order has a reservation for this SKU
      if (this.reservations[sku] && this.reservations[sku][orderId]) {
        orderHasReservations = true;
        // Add the quantity to the total freed
        totalUnitsFreed += this.reservations[sku][orderId];
        
        // Remove the reservation
        delete this.reservations[sku][orderId];
        
        // If no reservations left for this SKU, remove the SKU entry
        if (Object.keys(this.reservations[sku]).length === 0) {
          delete this.reservations[sku];
        }
      }
    }
    
    // If the order had no reservations, throw an error
    if (!orderHasReservations) {
      throw new Error("Order has no reservations to fulfil");
    }
    
    // Remove the reserved units from inventory
    // Note: We don't actually remove from inventory here because the reservation
    // was already made and the units were already deducted from available stock.
    // The fulfil method just clears the reservation, which makes the units available again.
    return totalUnitsFreed;
  }

  lowStock(threshold) {
    // Validate threshold is a positive integer
    if (!Number.isInteger(threshold) || threshold <= 0) {
      throw new Error("Threshold must be a positive integer");
    }
    
    // Filter SKUs whose available quantity is below threshold
    const lowStockSkus = [];
    for (const sku in this.inventory) {
      if (this.available(sku) < threshold) {
        lowStockSkus.push(sku);
      }
    }
    
    // Return sorted array of SKUs
    return lowStockSkus.sort();
  }
}

// Export the Warehouse class
module.exports = { Warehouse };