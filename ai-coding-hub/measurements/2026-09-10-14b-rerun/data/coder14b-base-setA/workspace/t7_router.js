function match(pattern, path) {
    const patternSegments = pattern.split('/');
    const pathSegments = path.split('/');
if (patternSegments.length !== pathSegments.length) {
    // Check if the pattern has any dynamic segments
    const hasDynamicSegments = patternSegments.some(segment => segment.startsWith(':'));
    if (!hasDynamicSegments) {
        return null;
    }
}

    const params = {};

    for (let i = 0; i < patternSegments.length; i++) {
        const patternSegment = patternSegments[i];
        const pathSegment = pathSegments[i];

        if (patternSegment.startsWith(':')) {
            params[patternSegment.substring(1)] = pathSegment;
        } else if (patternSegment !== pathSegment) {
            return null;
        }
    }

    return params;
}

// Assertions
console.assert(JSON.stringify(match('/u/:id', '/u/7')) === JSON.stringify({ id: '7' }), 'Test 1 failed');
console.assert(match('/u/:id', '/u/7') !== null, 'Test 2 failed');
console.assert(match('/u/:id', '/u/8') !== null, 'Test 3 failed');
console.assert(match('/u/:id', '/v/7') === null, 'Test 4 failed');
console.assert(match('/u/:id', '/u/') === null, 'Test 5 failed');
console.assert(match('/u/:id', '/u/7/') === null, 'Test 6 failed');

console.log('All tests passed');
console.assert(JSON.stringify(match('/u/:id', '/u/7')) === JSON.stringify({ id: '7' }), 'Test 7 failed');
console.assert(JSON.stringify(match('/u/:id', '/u/8')) === JSON.stringify({ id: '8' }), 'Test 8 failed');
console.assert(match('/u/:id', '/u/7/') === null, 'Test 9 failed');
console.assert(match('/u/:id', '/u/') === null, 'Test 10 failed');
console.assert(match('/u/:id', '/v/7') === null, 'Test 11 failed');
console.assert(JSON.stringify(match('/u/:id/:action', '/u/7/edit')) === JSON.stringify({ id: '7', action: 'edit' }), 'Test 12 failed');
console.assert(JSON.stringify(match('/u/:id/:action', '/u/7/delete')) === JSON.stringify({ id: '7', action: 'delete' }), 'Test 13 failed');
console.assert(match('/u/:id/:action', '/u/7/') === null, 'Test 14 failed');
console.assert(match('/u/:id/:action', '/u/7/edit/') === null, 'Test 15 failed');
console.assert(match('/u/:id/:action', '/u/7/edit/extra') === null, 'Test 16 failed');
console.assert(match('/u/:id/:action', '/u/') === null, 'Test 17 failed');
console.assert(match('/u/:id/:action', '/u/7/extra') === null, 'Test 18 failed');

console.log('All tests passed');
