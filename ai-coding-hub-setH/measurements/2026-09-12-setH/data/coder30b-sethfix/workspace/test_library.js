const { Library } = require('./s1_library.js');

// Test the Library class
const library = new Library();

// Add some books
library.addBook('1234567890', 'The Great Gatsby', 3);
library.addBook('0987654321', '1984', 2);

console.log("Initial state:");
console.log("Available copies of '1234567890':", library.available('1234567890'));
console.log("Available copies of '0987654321':", library.available('0987654321'));

// Test checkout
try {
  library.checkout('1234567890', 'Alice');
  console.log("Alice checked out 'The Great Gatsby'");
  console.log("Available copies after checkout:", library.available('1234567890'));
} catch (error) {
  console.error("Checkout failed:", error.message);
}

try {
  library.checkout('1234567890', 'Bob');
  console.log("Bob checked out 'The Great Gatsby'");
  console.log("Available copies after checkout:", library.available('1234567890'));
} catch (error) {
  console.error("Checkout failed:", error.message);
}

try {
  library.checkout('1234567890', 'Charlie');
  console.log("Charlie checked out 'The Great Gatsby'");
  console.log("Available copies after checkout:", library.available('1234567890'));
} catch (error) {
  console.error("Checkout failed:", error.message);
}

// Try to checkout when no copies are available
try {
  library.checkout('1234567890', 'David');
  console.log("David checked out 'The Great Gatsby'");
} catch (error) {
  console.error("Checkout failed (expected):", error.message);
}

// Try to checkout unknown ISBN
try {
  library.checkout('9999999999', 'Eve');
  console.log("Eve checked out unknown book");
} catch (error) {
  console.error("Checkout failed (expected):", error.message);
}

// Try to checkout a book that member already has
try {
  library.checkout('0987654321', 'Alice');
  console.log("Alice checked out '1984'");
} catch (error) {
  console.error("Checkout failed (expected):", error.message);
}

// Test available method with non-existent ISBN
console.log("Available copies of non-existent ISBN:", library.available('9999999999'));

console.log("Final state:");
console.log("Available copies of '1234567890':", library.available('1234567890'));
console.log("Available copies of '0987654321':", library.available('0987654321'));
// Test returnBook method
console.log("\nTesting returnBook method:");

try {
  library.returnBook('1234567890', 'Alice');
  console.log("Alice returned 'The Great Gatsby'");
  console.log("Available copies after return:", library.available('1234567890'));
} catch (error) {
  console.error("Return failed:", error.message);
}

try {
  library.returnBook('1234567890', 'Alice');
  console.log("Alice returned 'The Great Gatsby' again (should fail)");
} catch (error) {
  console.error("Return failed (expected):", error.message);
}

try {
  library.returnBook('9999999999', 'Alice');
  console.log("Alice returned unknown book (should fail)");
} catch (error) {
  console.error("Return failed (expected):", error.message);
}

// Test loans method
console.log("\nTesting loans method:");

try {
  const aliceLoans = library.loans('Alice');
  console.log("Alice's loans:", aliceLoans);
  
  const bobLoans = library.loans('Bob');
  console.log("Bob's loans:", bobLoans);
  
  const charlieLoans = library.loans('Charlie');
  console.log("Charlie's loans:", charlieLoans);
  
  const davidLoans = library.loans('David');
  console.log("David's loans:", davidLoans);
} catch (error) {
  console.error("Loans test failed:", error.message);
}

// Test holds method
console.log("\nTesting holds method:");
try {
  const holdQueue = library.holds('1234567890');
  console.log("Hold queue for '1234567890':", holdQueue);
} catch (error) {
  console.error("Holds test failed:", error.message);
}

// Test placeHold method
console.log("\nTesting placeHold method:");

// Try to place a hold on a book that's available (should fail)
try {
  library.placeHold('1234567890', 'David');
  console.log("David placed hold on available book (should fail)");
} catch (error) {
  console.error("PlaceHold failed (expected):", error.message);
}

// Try to place a hold on a book that's not available (should succeed)
try {
  library.placeHold('1234567890', 'David');
  console.log("David placed hold on 'The Great Gatsby'");
  const holdQueue = library.holds('1234567890');
  console.log("Hold queue for '1234567890':", holdQueue);
} catch (error) {
  console.error("PlaceHold failed:", error.message);
}

// Try to place another hold
try {
  library.placeHold('1234567890', 'Eve');
  console.log("Eve placed hold on 'The Great Gatsby'");
  const holdQueue = library.holds('1234567890');
  console.log("Hold queue for '1234567890':", holdQueue);
} catch (error) {
  console.error("PlaceHold failed:", error.message);
}

// Try to place a hold for a member who already holds the book (should fail)
try {
  library.placeHold('0987654321', 'Alice');
  console.log("Alice placed hold on '1984' (should fail)");
} catch (error) {
  console.error("PlaceHold failed (expected):", error.message);
}

// Try to place a hold for a member who already has the book (should fail)
try {
  library.checkout('0987654321', 'Frank');
  library.placeHold('0987654321', 'Frank');
  console.log("Frank placed hold on '1984' (should fail)");
} catch (error) {
  console.error("PlaceHold failed (expected):", error.message);
}

// Test returnBook with hold queue
console.log("\nTesting returnBook with hold queue:");

try {
  library.returnBook('1234567890', 'Alice');
  console.log("Alice returned 'The Great Gatsby'");
  console.log("Available copies after return:", library.available('1234567890'));
  
  // Check if David got the book (first in hold queue)
  const davidLoans = library.loans('David');
  console.log("David's loans:", davidLoans);
  
  // Check if Eve is still in the hold queue
  const holdQueue = library.holds('1234567890');
  console.log("Hold queue for '1234567890':", holdQueue);
} catch (error) {
  console.error("Return with hold queue failed:", error.message);
}

// Test returnBook with no hold queue
console.log("\nTesting returnBook with no hold queue:");

try {
  library.returnBook('0987654321', 'Frank');
  console.log("Frank returned '1984'");
  console.log("Available copies after return:", library.available('0987654321'));
  
  // Check if Frank's loan was removed
  const frankLoans = library.loans('Frank');
  console.log("Frank's loans:", frankLoans);
} catch (error) {
  console.error("Return with no hold queue failed:", error.message);
}

console.log("\nFinal state:");
console.log("Available copies of '1234567890':", library.available('1234567890'));
console.log("Available copies of '0987654321':", library.available('0987654321'));
// Test dueDay method
console.log("\nTesting dueDay method:");
try {
  const dueDay1 = library.dueDay('1234567890', 'Bob');
  console.log("Due day for Bob's book (should be 14):", dueDay1);
  
  const dueDay2 = library.dueDay('0987654321', 'Alice');
  console.log("Due day for Alice's book (should be 14):", dueDay2);
  
  const dueDay3 = library.dueDay('9999999999', 'Alice');
  console.log("Due day for unknown book (should be null):", dueDay3);
} catch (error) {
  console.error("DueDay test failed:", error.message);
}

// Test overdue method
console.log("\nTesting overdue method:");
try {
  // Test with no overdue books
  const overdue1 = library.overdue(10);
  console.log("Overdue books at day 10 (should be empty):", overdue1);
  
  // Test with some overdue books
  const overdue2 = library.overdue(20);
  console.log("Overdue books at day 20 (should show some):", overdue2);
  
  // Test with many overdue books
  const overdue3 = library.overdue(30);
  console.log("Overdue books at day 30 (should show more):", overdue3);
} catch (error) {
  console.error("Overdue test failed:", error.message);
}

// Test checkout with day parameter
console.log("\nTesting checkout with day parameter:");
try {
  library.checkout('0987654321', 'Grace', 5);
  console.log("Grace checked out '1984' on day 5");
  const dueDay = library.dueDay('0987654321', 'Grace');
  console.log("Grace's due day:", dueDay);
  
  const overdue = library.overdue(20);
  console.log("Overdue books at day 20:", overdue);
} catch (error) {
  console.error("Checkout with day test failed:", error.message);
}

// Test returnBook with day parameter
console.log("\nTesting returnBook with day parameter:");
try {
  library.returnBook('0987654321', 'Grace', 10);
  console.log("Grace returned '1984' on day 10");
  
  // Check if hold queue works with day parameter
  library.placeHold('0987654321', 'Henry');
  console.log("Henry placed hold on '1984'");
  
  library.returnBook('0987654321', 'Henry', 15);
  console.log("Henry returned '1984' on day 15");
  
  const overdue = library.overdue(30);
  console.log("Overdue books at day 30:", overdue);
} catch (error) {
  console.error("ReturnBook with day test failed:", error.message);
}
// Test fines method
console.log("\nTesting fines method:");
try {
  const aliceFines = library.fines('Alice');
  console.log("Alice's fines:", aliceFines);
  
  const bobFines = library.fines('Bob');
  console.log("Bob's fines:", bobFines);
} catch (error) {
  console.error("Fines test failed:", error.message);
}

// Test returnBook with late return (should generate fine)
console.log("\nTesting returnBook with late return:");
try {
  library.checkout('1234567890', 'Alice', 1);
  console.log("Alice checked out 'The Great Gatsby' on day 1");
  
  const fine = library.returnBook('1234567890', 'Alice', 20);
  console.log("Alice returned 'The Great Gatsby' on day 20, fine:", fine, "cents");
  
  const aliceFines = library.fines('Alice');
  console.log("Alice's total fines after late return:", aliceFines, "cents");
} catch (error) {
  console.error("Late return test failed:", error.message);
}

// Test pay method
console.log("\nTesting pay method:");
try {
  library.pay('Alice', 250);
  console.log("Alice paid 250 cents");
  
  const aliceFines = library.fines('Alice');
  console.log("Alice's remaining fines after payment:", aliceFines, "cents");
} catch (error) {
  console.error("Pay test failed:", error.message);
}

// Test pay method with invalid amount
console.log("\nTesting pay method with invalid amount:");
try {
  library.pay('Alice', -50);
  console.log("Alice paid -50 cents (should fail)");
} catch (error) {
  console.error("Pay test failed (expected):", error.message);
}

// Test pay method with amount exceeding fines
console.log("\nTesting pay method with amount exceeding fines:");
try {
  library.pay('Alice', 500);
  console.log("Alice paid 500 cents (should fail)");
} catch (error) {
  console.error("Pay test failed (expected):", error.message);
}

// Test pay method with no fines
console.log("\nTesting pay method with no fines:");
try {
  library.pay('Charlie', 100);
  console.log("Charlie paid 100 cents (should fail)");
} catch (error) {
  console.error("Pay test failed (expected):", error.message);
}
