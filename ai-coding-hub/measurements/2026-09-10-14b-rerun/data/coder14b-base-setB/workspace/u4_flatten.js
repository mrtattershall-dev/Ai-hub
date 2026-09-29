const assert = require('assert');

function flatten(obj, parentKey = '', result = {}) {
    for (const key in obj) {
        const newKey = parentKey ? `${parentKey}.${key}` : key;
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            flatten(obj[key], newKey, result);
        } else {
            result[newKey] = obj[key];
        }
    }
    return result;
}

// Tests
function runTests() {
    assert.deepStrictEqual(flatten({}), {});
    assert.deepStrictEqual(flatten({ a: 1 }), { a: 1 });
    assert.deepStrictEqual(flatten({ a: { b: 1 } }), { 'a.b': 1 });
    assert.deepStrictEqual(flatten({ a: { b: { c: 1 } } }), { 'a.b.c': 1 });
    assert.deepStrictEqual(flatten({ a: 1, b: { c: 2 } }), { a: 1, 'b.c': 2 });
    console.log('All tests passed!');
}

runTests();