const Library = require('./s1_library.js');

const testLibrary = new Library();

// Test adding books
testLibrary.addBook('978-3-16-148410-0', 'Book One', 3);
testLibrary.addBook('978-1-23-456789-7', 'Book Two', 2);

// Test available method
console.log(testLibrary.available('978-3-16-148410-0')); // Should print 3
console.log(testLibrary.available('978-1-23-456789-7')); // Should print 2
console.log(testLibrary.available('978-0-00-000000-0')); // Should print 0

// Test checkout method
testLibrary.checkout('978-3-16-148410-0', 'Member A');
console.log(testLibrary.available('978-3-16-148410-0')); // Should print 2

// Test checkout with no copies available
try {
    testLibrary.checkout('978-3-16-148410-0', 'Member B');
    testLibrary.checkout('978-3-16-148410-0', 'Member C');
    testLibrary.checkout('978-3-16-148410-0', 'Member D'); // Should throw an error
} catch (error) {
    console.log(error.message); // Should print 'No copies available'
}

// Test checkout with unknown ISBN
try {
    testLibrary.checkout('978-0-00-000000-0', 'Member E'); // Should throw an error
} catch (error) {
    console.log(error.message); // Should print 'Unknown ISBN'
}

// Test checkout with member already having the book
try {
    testLibrary.checkout('978-3-16-148410-0', 'Member A'); // Should throw an error
} catch (error) {
    console.log(error.message); // Should print 'Member already has this book'
}

// Test available method after checkouts
console.log(testLibrary.available('978-3-16-148410-0')); // Should print 2
console.log(testLibrary.available('978-1-23-456789-7')); // Should print 2