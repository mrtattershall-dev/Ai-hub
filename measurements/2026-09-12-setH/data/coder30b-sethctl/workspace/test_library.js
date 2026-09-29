// Test file for Library class
const { Library } = require('./s1_library.js');

// Create a new library instance
const library = new Library();

// Test 1: Add a book with default copies
library.addBook("978-0134685991", "Effective Java", 3);
console.assert(library.copies("978-0134685991") === 3, "Test 1 failed: Adding book with default copies");

// Test 2: Add more copies of existing book
library.addBook("978-0134685991", "Effective Java", 2);
console.assert(library.copies("978-0134685991") === 5, "Test 2 failed: Adding more copies to existing book");

// Test 3: Add a new book with different ISBN
library.addBook("978-0201633610", "Design Patterns", 1);
console.assert(library.copies("978-0201633610") === 1, "Test 3 failed: Adding new book");

// Test 4: Check copies of unknown ISBN
console.assert(library.copies("978-0000000000") === 0, "Test 4 failed: Checking copies of unknown ISBN");

// Test 5: Test titles() method
const titles = library.titles();
console.assert(titles.length === 2, "Test 5 failed: titles() should return 2 titles");
console.assert(titles[0] === "Design Patterns", "Test 5 failed: titles() should be sorted alphabetically");
console.assert(titles[1] === "Effective Java", "Test 5 failed: titles() should be sorted alphabetically");

// Test 6: Test error for invalid copies parameter
let errorCaught = false;
try {
  library.addBook("978-0134685992", "Another Book", 0);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Test 6 failed: Should throw error for zero copies");

errorCaught = false;
try {
  library.addBook("978-0134685993", "Another Book", -1);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Test 6 failed: Should throw error for negative copies");

errorCaught = false;
try {
  library.addBook("978-0134685994", "Another Book", 1.5);
} catch (e) {
  errorCaught = true;
}
console.assert(errorCaught, "Test 6 failed: Should throw error for non-integer copies");

console.log("All asserts passed!");

// Test 8: Test returnBook and loans methods
const library2 = new Library();

// Add some books for testing
library2.addBook("978-0134685991", "Effective Java", 3);
library2.addBook("978-0201633610", "Design Patterns", 1);

// Test checkout
library2.checkout("978-0134685991", "Alice");
library2.checkout("978-0201633610", "Alice");
library2.checkout("978-0134685991", "Bob");

// Test loans method
const aliceLoans = library2.loans("Alice");
console.assert(aliceLoans.length === 2, "Alice should have 2 loans");
console.assert(aliceLoans[0] === "978-0134685991", "Alice should have Effective Java");
console.assert(aliceLoans[1] === "978-0201633610", "Alice should have Design Patterns");

const bobLoans = library2.loans("Bob");
console.assert(bobLoans.length === 1, "Bob should have 1 loan");
console.assert(bobLoans[0] === "978-0134685991", "Bob should have Effective Java");

const charlieLoans = library2.loans("Charlie");
console.assert(charlieLoans.length === 0, "Charlie should have 0 loans");

// Test returnBook method
library2.returnBook("978-0134685991", "Alice");
const aliceLoansAfterReturn = library2.loans("Alice");
console.assert(aliceLoansAfterReturn.length === 1, "Alice should have 1 loan after return");
console.assert(aliceLoansAfterReturn[0] === "978-0201633610", "Alice should have only Design Patterns after return");

// Test returnBook error for unknown ISBN
let returnBookError1 = false;
try {
  library2.returnBook("978-0000000000", "Alice");
} catch (e) {
  returnBookError1 = true;
}
console.assert(returnBookError1, "Should throw error for unknown ISBN");

// Test returnBook error for member without loan
let returnBookError2 = false;
try {
  library2.returnBook("978-0134685991", "Charlie");
} catch (e) {
  returnBookError2 = true;
}
console.assert(returnBookError2, "Should throw error for member without loan");

// Test returnBook with multiple copies
library2.checkout("978-0134685991", "Alice");
library2.checkout("978-0134685991", "Alice");
const aliceLoansWithThreeCopies = library2.loans("Alice");
console.assert(aliceLoansWithThreeCopies.length === 1, "Alice should have 1 ISBN with 3 copies");
console.assert(aliceLoansWithThreeCopies[0] === "978-0134685991", "Alice should have Effective Java");

library2.returnBook("978-0134685991", "Alice");
const aliceLoansAfterFirstReturn = library2.loans("Alice");
console.assert(aliceLoansAfterFirstReturn.length === 1, "Alice should still have 1 ISBN after one return");
console.assert(aliceLoansAfterFirstReturn[0] === "978-0134685991", "Alice should still have Effective Java");

library2.returnBook("978-0134685991", "Alice");
const aliceLoansAfterSecondReturn = library2.loans("Alice");
console.assert(aliceLoansAfterSecondReturn.length === 1, "Alice should still have 1 ISBN after second return");
console.assert(aliceLoansAfterSecondReturn[0] === "978-0134685991", "Alice should still have Effective Java");

library2.returnBook("978-0134685991", "Alice");
const aliceLoansAfterThirdReturn = library2.loans("Alice");
console.assert(aliceLoansAfterThirdReturn.length === 0, "Alice should have 0 loans after third return");

console.log("All returnBook and loans tests passed!");

// Test file for Matrix class
const { Matrix } = require('./s3_matrix.js');

// Test 1: Create a valid matrix
const matrix1 = new Matrix([[1, 2, 3], [4, 5, 6]]);
console.assert(matrix1.shape()[0] === 2 && matrix1.shape()[1] === 3, "Test 1 failed: Matrix shape should be 2x3");

// Test 2: Test get method
console.assert(matrix1.get(0, 0) === 1, "Test 2 failed: get(0,0) should return 1");
console.assert(matrix1.get(1, 2) === 6, "Test 2 failed: get(1,2) should return 6");

// Test 3: Test toArray method
const arrayCopy = matrix1.toArray();
console.assert(arrayCopy[0][0] === 1 && arrayCopy[1][2] === 6, "Test 3 failed: toArray should return a copy");

// Test 4: Test error for invalid rows (no rows)
let errorCaught1 = false;
try {
  new Matrix();
} catch (e) {
  errorCaught1 = true;
}
console.assert(errorCaught1, "Test 4 failed: Should throw error for no rows");

// Test 5: Test error for invalid rows (empty rows)
let errorCaught2 = false;
try {
  new Matrix([]);
} catch (e) {
  errorCaught2 = true;
}
console.assert(errorCaught2, "Test 5 failed: Should throw error for empty rows");

// Test 6: Test error for invalid rows (rows of different lengths)
let errorCaught3 = false;
try {
  new Matrix([[1, 2], [3, 4, 5]]);
} catch (e) {
  errorCaught3 = true;
}
console.assert(errorCaught3, "Test 6 failed: Should throw error for rows of different lengths");

// Test 7: Test error for invalid rows (empty row)
let errorCaught4 = false;
try {
  new Matrix([[], [1, 2]]);
} catch (e) {
  errorCaught4 = true;
}
console.assert(errorCaught4, "Test 7 failed: Should throw error for empty rows");

// Test 8: Test error for invalid elements (non-finite numbers)
let errorCaught5 = false;
try {
  new Matrix([[1, 2], [3, NaN]]);
} catch (e) {
  errorCaught5 = true;
}
console.assert(errorCaught5, "Test 8 failed: Should throw error for non-finite numbers");

// Test 9: Test error for invalid elements (non-numbers)
let errorCaught6 = false;
try {
  new Matrix([["1", "2"], ["3", "4"]]);
} catch (e) {
  errorCaught6 = true;
}
console.assert(errorCaught6, "Test 9 failed: Should throw error for non-numbers");

// Test 10: Test error for get with invalid indices
let errorCaught7 = false;
try {
  matrix1.get(2, 0);
} catch (e) {
  errorCaught7 = true;
}
console.assert(errorCaught7, "Test 10 failed: Should throw error for get with invalid row index");

let errorCaught8 = false;
try {
  matrix1.get(0, 3);
} catch (e) {
  errorCaught8 = true;
}
console.assert(errorCaught8, "Test 10 failed: Should throw error for get with invalid column index");

console.log("All Matrix asserts passed!");
// Test 7: Test evaluate function from s5_expr.js
const { evaluate } = require('./s5_expr.js');

try {
    // Test basic operations
    console.assert(evaluate("2 + 3") === 5, "Test 7 failed: Basic addition");
    console.assert(evaluate("10 - 4") === 6, "Test 7 failed: Basic subtraction");
    console.assert(evaluate("3 * 7") === 21, "Test 7 failed: Basic multiplication");
    console.assert(evaluate("15 / 3") === 5, "Test 7 failed: Basic division");
    
    // Test precedence
    console.assert(evaluate("2 + 3 * 4") === 14, "Test 7 failed: Multiplication before addition");
    console.assert(evaluate("10 - 6 / 2") === 7, "Test 7 failed: Division before subtraction");
    
    // Test left-to-right evaluation for same precedence
    console.assert(evaluate("10 - 4 - 2") === 4, "Test 7 failed: Left-to-right evaluation");
    console.assert(evaluate("12 / 3 * 2") === 8, "Test 7 failed: Left-to-right evaluation");
    
    // Test decimals
    console.assert(evaluate("3.5 + 2.1") === 5.6, "Test 7 failed: Decimal addition");
    console.assert(evaluate("7.5 / 2.5") === 3, "Test 7 failed: Decimal division");
    
    // Test spaces
    console.assert(evaluate(" 2 + 3 ") === 5, "Test 7 failed: Spaces handling");
    
    // Test parentheses
    console.assert(evaluate("(2 + 3) * 4") === 20, "Test 7 failed: Parentheses");
    console.assert(evaluate("2 * (3 + 4)") === 14, "Test 7 failed: Parentheses");
    
    // Test error cases
    let errorCaught = false;
    try {
        evaluate("2 / 0");
    } catch (e) {
        errorCaught = true;
    }
    console.assert(errorCaught, "Test 7 failed: Division by zero should throw error");
    
    errorCaught = false;
    try {
        evaluate("2 +");
    } catch (e) {
        errorCaught = true;
    }
    console.assert(errorCaught, "Test 7 failed: Invalid expression should throw error");
    
    errorCaught = false;
    try {
        evaluate("2 + + 3");
    } catch (e) {
        errorCaught = true;
    }
    console.assert(errorCaught, "Test 7 failed: Consecutive operators should throw error");
    
    errorCaught = false;
    try {
        evaluate("2 + 3)");
    } catch (e) {
        errorCaught = true;
    }
    console.assert(errorCaught, "Test 7 failed: Unbalanced parentheses should throw error");
    
    errorCaught = false;
    try {
        evaluate("2 + 3(");
    } catch (e) {
        errorCaught = true;
    }
    console.assert(errorCaught, "Test 7 failed: Invalid parentheses should throw error");
    
    errorCaught = false;
    try {
        evaluate("2 + 3 *");
    } catch (e) {
        errorCaught = true;
    }
    console.assert(errorCaught, "Test 7 failed: Incomplete expression should throw error");
    
    errorCaught = false;
    try {
        evaluate("2 + 3 & 4");
    } catch (e) {
        errorCaught = true;
    }
    console.assert(errorCaught, "Test 7 failed: Invalid characters should throw error");
    
    console.log("All tests passed!");
} catch (e) {
    console.error("Test failed:", e.message);
}
// Test 8: Test Cache class from s7_cache.js
const { Cache } = require('./s7_cache.js');

// Test 1: Cache constructor validation
try {
    new Cache(0);
    console.assert(false, "Test 1 failed: Should throw error for zero capacity");
} catch (e) {
    console.assert(e.message === "Capacity must be a positive integer", "Test 1 failed: Wrong error message for zero capacity");
}

try {
    new Cache(-1);
    console.assert(false, "Test 1 failed: Should throw error for negative capacity");
} catch (e) {
    console.assert(e.message === "Capacity must be a positive integer", "Test 1 failed: Wrong error message for negative capacity");
}

try {
    new Cache(1.5);
    console.assert(false, "Test 1 failed: Should throw error for non-integer capacity");
} catch (e) {
    console.assert(e.message === "Capacity must be a positive integer", "Test 1 failed: Wrong error message for non-integer capacity");
}

console.assert(new Cache(1) instanceof Cache, "Test 1 failed: Cache constructor should create Cache instance");

// Test 2: Basic set and get operations
const cache = new Cache(2);
cache.set("a", 1);
cache.set("b", 2);
console.assert(cache.get("a") === 1, "Test 2 failed: Basic get should work");
console.assert(cache.get("b") === 2, "Test 2 failed: Basic get should work");

// Test 3: Cache size
console.assert(cache.size() === 2, "Test 3 failed: Cache size should be 2");

// Test 4: Cache has method
console.assert(cache.has("a") === true, "Test 4 failed: has() should return true for existing key");
console.assert(cache.has("c") === false, "Test 4 failed: has() should return false for missing key");

// Test 5: Cache eviction (LRU)
cache.set("c", 3);
console.assert(cache.get("a") === undefined, "Test 5 failed: Least recently used item should be evicted");
console.assert(cache.get("b") === 2, "Test 5 failed: Most recently used item should still be there");
console.assert(cache.get("c") === 3, "Test 5 failed: New item should be accessible");

// Test 6: Update existing key (should move to most recently used)
cache.set("b", 20);
console.assert(cache.get("b") === 20, "Test 6 failed: Updating existing key should work");
cache.set("d", 4);
console.assert(cache.get("c") === undefined, "Test 6 failed: LRU eviction should work after update");

// Test 7: Get should also count as use
cache.set("e", 5);
cache.set("f", 6);
console.assert(cache.get("e") === 5, "Test 7 failed: get should count as use");
cache.set("g", 7);
console.assert(cache.get("f") === undefined, "Test 7 failed: get should trigger LRU eviction");

console.log("All Cache tests passed!");
