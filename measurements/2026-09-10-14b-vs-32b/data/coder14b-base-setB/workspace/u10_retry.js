// u10_retry.js

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
// Tests for retry function

const assert = require('assert');

async function testRetry() {
    let callCount = 0;

    // Test case 1: Function resolves on first attempt
    const resolveOnFirst = async () => {
        callCount++;
        return 'Success';
    };
    assert.strictEqual(await retry(resolveOnFirst, 3), 'Success');
    assert.strictEqual(callCount, 1);

    // Test case 2: Function resolves on second attempt
    callCount = 0;
    const resolveOnSecond = async () => {
        callCount++;
        if (callCount === 1) throw new Error('First attempt failed');
        return 'Success';
    };
    assert.strictEqual(await retry(resolveOnSecond, 3), 'Success');
    assert.strictEqual(callCount, 2);

    // Test case 3: Function resolves on third attempt
    callCount = 0;
    const resolveOnThird = async () => {
        callCount++;
        if (callCount < 3) throw new Error('First or second attempt failed');
        return 'Success';
    };
    assert.strictEqual(await retry(resolveOnThird, 3), 'Success');
    assert.strictEqual(callCount, 3);

    // Test case 4: Function fails all attempts
    callCount = 0;
    const alwaysFails = async () => {
        callCount++;
        throw new Error('Always fails');
    };
    try {
        await retry(alwaysFails, 3);
        assert.fail('Expected an error to be thrown');
    } catch (error) {
        assert.strictEqual(error.message, 'Always fails');
    }
    assert.strictEqual(callCount, 3);

    console.log('All tests passed!');
}

testRetry();
