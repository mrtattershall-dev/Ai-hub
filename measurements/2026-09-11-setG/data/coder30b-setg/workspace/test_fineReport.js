const { Library } = require('./s1_library.js');
const { fineReport } = require('./s10_desk.js');

// Create a test library
const library = new Library();

// Add some test members with fines
library.checkout('Alice', '978-0134685991');
library.checkout('Bob', '978-0134685991');
library.checkout('Charlie', '978-0134685991');

// Add fines to members
library.fine('Alice', 150);  // $1.50
library.fine('Bob', 75);     // $0.75
library.fine('Charlie', 225); // $2.25

// Test the function
const members = ['Alice', 'Bob', 'Charlie', 'David'];
const result = fineReport(library, members);
console.log('Result:');
console.log(result);