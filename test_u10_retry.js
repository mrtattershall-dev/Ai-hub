const { retry } = require('./u10_retry');

// Test 1: Successful function should return the result immediately
async function testSuccess() {
  const result = await retry(async () => {
    return 'success';
  }, 3);
  
  console.assert(result === 'success', 'Test 1 failed: Should return successful result');
  console.log('Test 1 passed: Successful function returns result immediately');
}

// Test 2: Function that fails all attempts should throw the last error
async function testFailure() {
  let errorCaught = false;
  let lastError;
  
  try {
    await retry(async () => {
      throw new Error('Failed attempt');
    }, 3);
  } catch (error) {
    errorCaught = true;
    lastError = error;
  }
  
  console.assert(errorCaught, 'Test 2 failed: Should have thrown an error');
  console.assert(lastError.message === 'Failed attempt', 'Test 2 failed: Should throw the last error');
  console.log('Test 2 passed: Failed function throws last error after all attempts');
}

// Test 3: Function that succeeds on the second attempt should work
async function testSuccessOnRetry() {
  let attemptCount = 0;
  
  const result = await retry(async () => {
    attemptCount++;
    if (attemptCount < 2) {
      throw new Error('First attempt failed');
    }
    return 'success on retry';
  }, 3);
  
  console.assert(result === 'success on retry', 'Test 3 failed: Should return result on retry');
  console.assert(attemptCount === 2, 'Test 3 failed: Should have attempted twice');
  console.log('Test 3 passed: Function succeeds on retry');
}

// Run all tests
async function runTests() {
  try {
    await testSuccess();
    await testFailure();
    await testSuccessOnRetry();
    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed:', error.message);
    process.exit(1);
  }
}

runTests();