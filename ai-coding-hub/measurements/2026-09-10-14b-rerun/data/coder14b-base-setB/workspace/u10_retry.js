// u10_retry.js

/**
 * Calls an async function until it resolves or the attempts run out, then rethrows the last error.
 * @param {Function} fn - The async function to call.
 * @param {number} times - The number of attempts.
 * @returns {Promise} - The resolved value of the function or the last error.
 */
async function retry(fn, times) {
    let lastError;
    for (let i = 0; i < times; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}

module.exports = { retry };
// Assertions to test the retry function

const assert = require('assert');

async function testRetry() {
    let callCount = 0;

    // Test successful retry
    const successFn = async () => {
        callCount++;
        if (callCount < 3) {
            throw new Error('Simulated failure');
        }
        return 'Success';
    };

    try {
        const result = await retry(successFn, 5);
        assert.strictEqual(result, 'Success');
        console.log('Test 1 passed');
    } catch (error) {
        console.error('Test 1 failed:', error);
    }

    // Test failed retry
    const failureFn = async () => {
        callCount++;
        throw new Error('Simulated failure');
    };

    try {
        await retry(failureFn, 3);
        console.error('Test 2 failed: Expected an error');
    } catch (error) {
        assert.strictEqual(error.message, 'Simulated failure');
        console.log('Test 2 passed');
    }
}

testRetry();
