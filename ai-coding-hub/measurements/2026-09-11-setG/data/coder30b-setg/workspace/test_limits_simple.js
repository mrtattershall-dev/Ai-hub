const Library = require('./s1_library.js');

// Create a simple test for the limits functionality
function testLimits() {
  console.log("Testing library limits implementation...");
  
  const library = new Library();
  
  // Add some books
  library.addBook("123", "Book 1", 3);
  library.addBook("456", "Book 2", 3);
  library.addBook("789", "Book 3", 3);
  library.addBook("012", "Book 4", 3);
  
  // Add a member with no fines
  library.members.set("Alice", 0);
  
  // Test 1: Checkout 3 books - should work
  try {
    library.checkout("123", "Alice", 1);
    library.checkout("456", "Alice", 1);
    library.checkout("789", "Alice", 1);
    console.log("✓ Successfully checked out 3 books");
  } catch (e) {
    console.log("✗ Failed to checkout 3 books:", e.message);
    return;
  }
  
  // Test 2: Try to checkout 4th book - should fail
  try {
    library.checkout("012", "Alice", 1);
    console.log("✗ Should have failed to checkout 4th book");
  } catch (e) {
    if (e.message.includes("limit")) {
      console.log("✓ Correctly failed to checkout 4th book due to limit");
    } else {
      console.log("✗ Wrong error message for 4th book:", e.message);
    }
  }
  
  // Test 3: Add fines to member
  library.members.set("Alice", 600); // 600 cents fines
  
  // Test 4: Try to checkout another book with high fines - should fail
  try {
    library.checkout("012", "Alice", 1);
    console.log("✗ Should have failed to checkout due to fines");
  } catch (e) {
    if (e.message.includes("fines")) {
      console.log("✓ Correctly failed to checkout due to high fines");
    } else {
      console.log("✗ Wrong error message for fines:", e.message);
    }
  }
  
  // Test 5: Reset fines and test hold limits
  library.members.set("Alice", 0);
  
  // Test 6: Place 3 holds - should work
  try {
    library.placeHold("123", "Alice");
    library.placeHold("456", "Alice");
    library.placeHold("789", "Alice");
    console.log("✓ Successfully placed 3 holds");
  } catch (e) {
    console.log("✗ Failed to place 3 holds:", e.message);
    return;
  }
  
  // Test 7: Try to place 4th hold - should fail
  try {
    library.placeHold("012", "Alice");
    console.log("✗ Should have failed to place 4th hold");
  } catch (e) {
    if (e.message.includes("limit")) {
      console.log("✓ Correctly failed to place 4th hold due to limit");
    } else {
      console.log("✗ Wrong error message for 4th hold:", e.message);
    }
  }
  
  console.log("All tests completed");
}

testLimits();