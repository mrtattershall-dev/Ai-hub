// u7_semver.js

function compare(a, b) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);

    for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
        const partA = partsA[i] || 0;
        const partB = partsB[i] || 0;

        if (partA < partB) return -1;
        if (partA > partB) return 1;
    }

    const preA = a.split('-')[1];
    const preB = b.split('-')[1];

    if (preA && preB) {
        const prePartsA = preA.split('.').map(Number);
        const prePartsB = preB.split('.').map(Number);

        for (let i = 0; i < Math.max(prePartsA.length, prePartsB.length); i++) {
            const prePartA = prePartsA[i] || 0;
            const prePartB = prePartsB[i] || 0;

            if (prePartA < prePartB) return -1;
            if (prePartA > prePartB) return 1;
        }
    } else if (preA) {
        return -1;
    } else if (preB) {
        return 1;
    }

    return 0;
}

// Assertions
console.assert(compare('1.0.0', '1.0.0') === 0, 'Test 1 failed');
console.assert(compare('1.0.0', '1.0.1') === -1, 'Test 2 failed');
console.assert(compare('1.0.1', '1.0.0') === 1, 'Test 3 failed');
console.assert(compare('1.10.0', '1.2.0') === 1, 'Test 4 failed');
console.assert(compare('1.2.0', '1.10.0') === -1, 'Test 5 failed');
console.assert(compare('1.0.0-alpha', '1.0.0') === -1, 'Test 6 failed');
console.assert(compare('1.0.0', '1.0.0-alpha') === 1, 'Test 7 failed');
console.assert(compare('1.0.0-alpha', '1.0.0-alpha') === 0, 'Test 8 failed');
console.assert(compare('1.0.0-alpha', '1.0.0-beta') === -1, 'Test 9 failed');
console.assert(compare('1.0.0-beta', '1.0.0-alpha') === 1, 'Test 10 failed');
console.assert(compare('1.0.0-beta', '1.0.0-beta') === 0, 'Test 11 failed');
console.assert(compare('1.0.0-beta', '1.0.0-beta.1') === -1, 'Test 12 failed');
console.assert(compare('1.0.0-beta.1', '1.0.0-beta') === 1, 'Test 13 failed');
console.assert(compare('1.0.0-beta.1', '1.0.0-beta.1') === 0, 'Test 14 failed');
console.assert(compare('1.0.0-rc.1', '1.0.0-rc.2') === -1, 'Test 15 failed');
console.assert(compare('1.0.0-rc.2', '1.0.0-rc.1') === 1, 'Test 16 failed');
console.assert(compare('1.0.0-rc.2', '1.0.0-rc.2') === 0, 'Test 17 failed');
console.assert(compare('1.0.0', '1.0.0-rc.1') === 1, 'Test 18 failed');
console.assert(compare('1.0.0-rc.1', '1.0.0') === -1, 'Test 19 failed');
console.assert(compare('1.0.0', '1.0.0-alpha.1') === 1, 'Test 20 failed');
console.assert(compare('1.0.0-alpha.1', '1.0.0') === -1, 'Test 21 failed');
console.assert(compare('1.0.0-alpha.1', '1.0.0-alpha.2') === -1, 'Test 22 failed');
console.assert(compare('1.0.0-alpha.2', '1.0.0-alpha.1') === 1, 'Test 23 failed');
console.assert(compare('1.0.0-alpha.2', '1.0.0-alpha.2') === 0, 'Test 24 failed');

console.log('All tests passed!');