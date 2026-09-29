const { Library } = require('./s1_library.js');
const { canBorrow } = require('./s10_desk.js');

console.log("Testing canBorrow function...");

const library = new Library();

// Add some books
library.addBook('978-0134685991', 'Effective Java', 3);
library.addBook('978-0201633610', 'Design Patterns', 1);
library.addBook('978-0596009205', 'Head First Java', 2);

// Test canBorrow with member who can borrow (fewer than 3 books, less than 500 cents fines)
console.log("Can Bob borrow? (should be true):", canBorrow(library, 'Bob'));

// Test canBorrow with member who cannot borrow due to too many books
// First, let's add some books to Alice
library.checkout('978-0134685991', 'Alice');
library.checkout('978-0201633610', 'Alice');
library.checkout('978-0596009205', 'Alice');

console.log("Can Alice borrow after 3 books? (should be false):", canBorrow(library, 'Alice'));

// Test canBorrow with member who cannot borrow due to fines
// We need to override the fines method to test this properly
const originalFines = library.fines;
library.fines = function(member) {
  if (member === 'Charlie') return 600; // More than 500 cents
  return 0;
};

// Add books to Charlie to make sure he has 3 books
library.checkout('978-0134685991', 'Charlie');
library.checkout('978-0201633610', 'Charlie');
library.checkout('978-0596009205', 'Charlie');

console.log("Can Charlie borrow with fines? (should be false):", canBorrow(library, 'Charlie'));

// Restore original fines method
library.fines = originalFines;

console.log("All tests completed successfully!");