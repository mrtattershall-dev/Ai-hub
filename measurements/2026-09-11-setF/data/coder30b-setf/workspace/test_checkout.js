const { Library } = require('./s1_library.js');

const library = new Library();
library.addBook('978-0-123456-78-9', 'Test Book', 3);
console.log('Initial copies:', library.copies('978-0-123456-78-9'));
console.log('Available:', library.available('978-0-123456-78-9'));

library.checkout('978-0-123456-78-9', 'Alice');
console.log('After Alice checkout - Available:', library.available('978-0-123456-78-9'));

library.checkout('978-0-123456-78-9', 'Bob');
console.log('After Bob checkout - Available:', library.available('978-0-123456-78-9'));

library.checkout('978-0-123456-78-9', 'Charlie');
console.log('After Charlie checkout - Available:', library.available('978-0-123456-78-9'));

try {
  library.checkout('978-0-123456-78-9', 'David');
  console.log('ERROR: Should have failed');
} catch(e) {
  console.log('Correctly failed with:', e.message);
}