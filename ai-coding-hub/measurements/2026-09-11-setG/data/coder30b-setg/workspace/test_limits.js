const Library = require('./s1_library.js');

// Test the limits implementation
function testLimits() {
  console.log("Testing library limits...");
  
  const library = new Library();
  
  // Add some books
  library.addBook("123", "Book 1", 3);
  library.addBook("456", "Book 2", 3);
  library.addBook("789", "Book 3", 3);
  library.addBook("012", "Book 4", 3);
  
  // Add a member
  library.members.set("Alice", 0); // Member with no fines
  
  // Checkout 3 books to Alice - this should work
  library.checkout("123", "Alice", 1);
  library.checkout("456", "Alice", 1);
  library.checkout("789", "Alice", 1);
  
  console.log("Successfully checked out 3 books to Alice");
  
  // Try to checkout a 4th book - this should throw an error
  try {
    library.checkout("012", "Alice", 1);
    console.log("ERROR: Should have thrown an error for 4th book checkout");
  } catch (e) {
    if (e.message.includes("limit")) {
      console.log("SUCCESS: Correctly threw limit error for 4th book");
    } else {
      console.log("ERROR: Wrong error message:", e.message);
    }
  }
  
  // Add fines to Alice
  library.members.set("Alice", 600); // Member with 600 cents fines
  
  // Try to checkout another book - this should throw an error due to fines
  try {
    library.checkout("012", "Alice", 1);
    console.log("ERROR: Should have thrown an error for fines limit");
  } catch (e) {
    if (e.message.includes("fines")) {
      console.log("SUCCESS: Correctly threw fines error for high fines");
    } else {
      console.log("ERROR: Wrong error message:", e.message);
    }
  }
  
  // Test hold limits
  try {
    library.placeHold("123", "Alice");
    console.log("ERROR: Should have thrown an error for hold limit");
  } catch (e) {
    if (e.message.includes("limit")) {
      console.log("SUCCESS: Correctly threw limit error for hold");
    } else {
      console.log("ERROR: Wrong error message:", e.message);
    }
  }
  
  console.log("Test completed");
}

testLimits();