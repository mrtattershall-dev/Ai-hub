const Library = require('./s1_library.js');

const library = new Library();

// Test adding a book
library.addBook('12345', 'Book One', 3);
console.log(`Copies of 'Book One': ${library.copies('12345')}`); // Should be 3

// Test available method
console.log(`Available copies of 'Book One': ${library.available('12345')}`); // Should be 3

// Test checkout method
library.checkout('12345', 'Alice');
console.log(`Available copies of 'Book One' after checkout: ${library.available('12345')}`); // Should be 2

// Test checkout method with same member
try {
    library.checkout('12345', 'Alice');
} catch (error) {
    console.log(error.message); // Should be 'Member already has this book'
}

// Test checkout method with unknown ISBN
try {
    library.checkout('99999', 'Bob');
} catch (error) {
    console.log(error.message); // Should be 'Unknown ISBN'
}

// Test checkout method with no copies available
library.checkout('12345', 'Bob');
library.checkout('12345', 'Charlie');
try {
    library.checkout('12345', 'David');
} catch (error) {
    console.log(error.message); // Should be 'No copies available'
}

// Test available method with unknown ISBN
console.log(`Available copies of 'Unknown Book': ${library.available('99999')}`); // Should be 0