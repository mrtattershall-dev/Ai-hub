const { Library } = require('./s1_library.js');

console.log("Creating library...");
const library = new Library();

console.log("Adding 3 copies of 'Effective Java'");
library.addBook("978-0134685991", "Effective Java", 3);
console.log("Total copies:", library.copies("978-0134685991"));
console.log("Available copies:", library.available("978-0134685991"));

console.log("Adding 2 more copies");
library.addBook("978-0134685991", "Effective Java", 2);
console.log("Total copies:", library.copies("978-0134685991"));
console.log("Available copies:", library.available("978-0134685991"));

console.log("Adding 1 more copy");
library.addBook("978-0134685991", "Effective Java", 1);
console.log("Total copies:", library.copies("978-0134685991"));
console.log("Available copies:", library.available("978-0134685991"));

console.log("Checking out 1 copy for Alice");
library.checkout("978-0134685991", "Alice");
console.log("Available copies after checkout:", library.available("978-0134685991"));

console.log("Checking out another copy for Bob (should fail)");
try {
    library.checkout("978-0134685991", "Bob");
    console.log("Checkout succeeded - this should not happen");
} catch (e) {
    console.log("Checkout failed as expected:", e.message);
}