function match(pattern, path) {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    const params = {};
if (patternParts.length > pathParts.length) {
    return null;
}
if (patternParts[patternParts.length - 1] === '*') {
    return params;
}
if (patternParts.length !== pathParts.length) {
    return null;
}

    for (let i = 0; i < patternParts.length; i++) {
        const patternPart = patternParts[i];
        const pathPart = pathParts[i];
if (patternPart.startsWith(':')) {
    const paramName = patternPart.slice(1);
    if (pathPart) {
        params[paramName] = pathPart;
    } else {
        return null;
    }
} else if (patternPart !== pathPart) {
    return null;
}
    }

    return params;
}

// Asserts
const assert = require('assert');

assert.deepStrictEqual(match('/u/:id', '/u/7'), { id: '7' });
assert.strictEqual(match('/u/:id', '/u/'), null);
assert.strictEqual(match('/u/:id', '/u/7/extra'), null);
assert.strictEqual(match('/u/:id', '/user/7'), null);
assert.deepStrictEqual(match('/u/:id/edit', '/u/7/edit'), { id: '7' });
assert.strictEqual(match('/u/:id/edit', '/u/7/delete'), null);
// Test cases
const testCases = [
    { pattern: "test/*", path: "test/path/to/resource", expected: {} },
    { pattern: "test/*", path: "test/another/path", expected: {} },
    { pattern: "test/*", path: "test", expected: null },
    { pattern: "test/*", path: "test/path/to/resource/with/more/parts", expected: {} },
    { pattern: "test/path/*", path: "test/path/to/resource", expected: {} },
    { pattern: "test/path/*", path: "test/path", expected: null },
    { pattern: "test/path/*", path: "test/path/to/resource/with/more/parts", expected: {} },
    { pattern: "test/path/to/*", path: "test/path/to/resource", expected: {} },
    { pattern: "test/path/to/*", path: "test/path/to", expected: null },
    { pattern: "test/path/to/*", path: "test/path/to/resource/with/more/parts", expected: {} },
];

testCases.forEach(({ pattern, path, expected }, index) => {
    const result = match(pattern, path);
    assert.deepStrictEqual(result, expected, `Test case ${index + 1} failed: match(${pattern}, ${path})`);
});

console.log("All test cases passed.");
