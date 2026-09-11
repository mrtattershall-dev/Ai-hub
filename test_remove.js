const { Inventory } = require('./t3_inventory.js');

// Create a new inventory
const inventory = new Inventory();

// Add an item
inventory.add("sword", 1);
console.log("After adding sword:", inventory.items);

// Remove the last unit
inventory.remove("sword", 1);
console.log("After removing last sword:", inventory.items);

// Check if the item is completely removed
if (inventory.items.hasOwnProperty("sword")) {
    console.log("FAIL: Item still exists in inventory");
} else {
    console.log("PASS: Item completely removed from inventory");
}