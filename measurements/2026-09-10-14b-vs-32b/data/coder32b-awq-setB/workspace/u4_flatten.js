function flatten(obj, prefix = '', result = {}) {
    for (let key in obj) {
        if (obj.hasOwnProperty(key)) {
            const newKey = prefix ? `${prefix}.${key}` : key;
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                flatten(obj[key], newKey, result);
            } else {
                result[newKey] = obj[key];
            }
        }
    }
    return result;
}

module.exports = flatten;
const assert = require('assert');

// Test cases
assert.deepStrictEqual(flatten({ a: { b: 1 } }), { 'a.b': 1 });
assert.deepStrictEqual(flatten({ a: { b: { c: 2 } } }), { 'a.b.c': 2 });
assert.deepStrictEqual(flatten({ a: 1, b: { c: 2, d: { e: 3 } } }), { 'a': 1, 'b.c': 2, 'b.d.e': 3 });
assert.deepStrictEqual(flatten({}), {});
assert.deepStrictEqual(flatten({ a: 1, b: 2 }), { 'a': 1, 'b': 2 });

console.log('All tests passed.');
assert.deepStrictEqual(flatten({ a: [1, 2] }), { 'a.0': 1, 'a.1': 2 });
