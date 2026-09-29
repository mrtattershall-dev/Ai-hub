// Direct test of the limits functionality
const Library = require('./s1_library.js');

console.log("Testing library limits implementation...");

// Create a new library instance
const library = new Library();

// Add some books
library.addBook("123", "Book 1", 3);
library.addBook("456", "Book 2", 3);
library.addBook("789", "Book 3", 3);
library.addBook("012", "Book 4", 3);

// Add a member with no fines
library.members.set("Alice", 0);

console.log("Testing checkout limits (3 books max)...");
try {
  // Checkout 3 books - should work
  library.checkout("123", "Alice", 1);
  library.checkout("456", "Alice", 1);
  library.checkout("789", "Alice", 1);
  console.log("✓ Successfully checked out 3 books");
  
  // Try to checkout 4th book - should fail
  library.checkout("012", "Alice", 1);
  console.log("✗ Should have failed to checkout 4th book");
} catch (e) {
  if (e.message.includes("limit")) {
    console.log("✓ Correctly failed to checkout 4th book due to limit");
  } else {
    console.log("✗ Wrong error message:", e.message);
  }
}

console.log("\nTesting fines limits (500+ cents)...");
// Add fines to member
library.members.set("Alice", 600); // 600 cents fines

try {
  // Try to checkout another book with high fines - should fail
  library.checkout("012", "Alice", 1);
  console.log("✗ Should have failed to checkout due to fines");
} catch (e) {
  if (e.message.includes("fines")) {
    console.log("✓ Correctly failed to checkout due to high fines");
  } else {
    console.log("✗ Wrong error message for fines:", e.message);
  }
}

console.log("\nTesting hold limits (3 holds max)...");
// Reset fines and test hold limits
library.members.set("Alice", 0);

try {
  // Place 3 holds - should work
  library.placeHold("123", "Alice");
  library.placeHold("456", "Alice");
  library.placeHold("789", "Alice");
  console.log("✓ Successfully placed 3 holds");
  
  // Try to place 4th hold - should fail
  library.placeHold("012", "Alice");
  console.log("✗ Should have failed to place 4th hold");
} catch (e) {
  if (e.message.includes("limit")) {
    console.log("✓ Correctly failed to place 4th hold due to limit");
  } else {
    console.log("✗ Wrong error message for 4th hold:", e.message);
  }
}

console.log("\nAll tests completed");