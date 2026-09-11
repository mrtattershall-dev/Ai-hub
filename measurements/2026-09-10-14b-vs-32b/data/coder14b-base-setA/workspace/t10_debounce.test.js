const debounce = require('./t10_debounce.js');
const assert = require('assert');

function testDebounce() {
  let callCount = 0;
  const debounced = debounce(() => {
    callCount++;
  }, 100);

  debounced();
  debounced();
  debounced();

  setTimeout(() => {
    assert.strictEqual(callCount, 1);
    console.log('Test passed!');
  }, 200);
}

testDebounce();