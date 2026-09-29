const debounce = require('./t10_debounce.js');

function testDebounce() {
  let callCount = 0;
  const debouncedFunction = debounce(() => {
    callCount++;
  }, 100);

  debouncedFunction();
  debouncedFunction();
  debouncedFunction();

  setTimeout(() => {
    if (callCount === 1) {
      console.log('Test passed: Only the last call in a burst runs.');
    } else {
      console.log('Test failed: Expected 1 call, but got ' + callCount);
    }
  }, 200);
}

testDebounce();