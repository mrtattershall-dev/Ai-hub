const { Library } = require('./s1_library.js');

const library = new Library();
library.addBook("978-0134685991", "Effective Java", 6);

console.log("Before checkout - available:", library.available("978-0134685991"));
console.log("Checking out for Alice");
library.checkout("978-0134685991", "Alice");
console.log("After first checkout - available:", library.available("978-0134685991"));

console.log("Checking out again for Bob (should work since 5 available)");
try {
    library.checkout("978-0134685991", "Bob");
    console.log("Second checkout succeeded - available:", library.available("978-0134685991"));
} catch (e) {
    console.log("Second checkout failed:", e.message);
}

console.log("Checking out again for Alice (should fail)");
try {
    library.checkout("978-0134685991", "Alice");
    console.log("Alice checkout succeeded");
} catch (e) {
    console.log("Alice checkout failed:", e.message);
}