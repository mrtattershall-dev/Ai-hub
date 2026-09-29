const { shelfLine, availability, memberLine } = require('./s10_desk.js');
const { Library } = require('./s1_library.js');

// Test the memberLine function
const library = new Library();
library.addBook("978-0134685991", "Effective Java", 3);
library.addBook("978-0201633610", "Design Patterns", 1);

// Test with member who has no loans
console.log(memberLine(library, "Alice")); // Should output: "Alice: none"

// Test with member who has loans
library.checkout("978-0134685991", "Alice");
console.log(memberLine(library, "Alice")); // Should output: "Alice: 978-0134685991"

library.checkout("978-0201633610", "Alice");
console.log(memberLine(library, "Alice")); // Should output: "Alice: 978-0134685991, 978-0201633610"