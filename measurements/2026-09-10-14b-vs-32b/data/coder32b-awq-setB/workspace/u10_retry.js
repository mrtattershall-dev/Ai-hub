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
const assert = require('assert');

async function testRetry() {
    let attemptCount = 0;
    const maxAttempts = 3;

    const failingFunction = async () => {
        attemptCount++;
        throw new Error('Function failed');
    };

    try {
        await retry(failingFunction, maxAttempts);
        assert.fail('Expected an error to be thrown');
    } catch (error) {
        assert.strictEqual(attemptCount, maxAttempts, `Expected ${maxAttempts} attempts, but got ${attemptCount}`);
        assert.strictEqual(error.message, 'Function failed', 'Expected the last error to be rethrown');
    }

    console.log('All tests passed');
}

testRetry();
