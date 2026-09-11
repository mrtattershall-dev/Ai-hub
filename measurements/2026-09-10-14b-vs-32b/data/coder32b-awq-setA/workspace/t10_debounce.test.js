const debounce = require('./t10_debounce.js');

let callCount = 0;

function testFunction() {
    callCount++;
}

const debouncedTestFunction = debounce(testFunction, 100);

// Simulate a burst of calls
debouncedTestFunction();
debouncedTestFunction();
debouncedTestFunction();

setTimeout(() => {
    console.log(`Expected 1 call, got ${callCount} calls`);
    process.exit(0);
}, 200);