function compare(a, b) {
    // Split the version strings into components
    const aParts = a.split('-');
    const bParts = b.split('-');
    const aVersion = aParts[0].split('.').map(Number);
    const bVersion = bParts[0].split('.').map(Number);
    const aPreRelease = aParts[1] ? aParts[1].split('.') : [];
    const bPreRelease = bParts[1] ? bParts[1].split('.') : [];

    // Compare version numbers
    for (let i = 0; i < Math.max(aVersion.length, bVersion.length); i++) {
        if (aVersion[i] > bVersion[i]) return 1;
        if (aVersion[i] < bVersion[i]) return -1;
    }

    // Compare pre-release identifiers
if (aPreRelease.length === 0 && bPreRelease.length === 0) return 0;
if (aPreRelease.length === 0) return 1;
if (bPreRelease.length === 0) return -1;

// Compare pre-release identifiers
for (let i = 0; i < Math.max(aPreRelease.length, bPreRelease.length); i++) {
    const aPre = isNaN(aPreRelease[i]) ? aPreRelease[i] : parseInt(aPreRelease[i], 10);
    const bPre = isNaN(bPreRelease[i]) ? bPreRelease[i] : parseInt(bPreRelease[i], 10);

    if (aPre > bPre) return 1;
    if (aPre < bPre) return -1;
}

    for (let i = 0; i < Math.max(aPreRelease.length, bPreRelease.length); i++) {
        const aPre = isNaN(aPreRelease[i]) ? aPreRelease[i] : Number(aPreRelease[i]);
        const bPre = isNaN(bPreRelease[i]) ? bPreRelease[i] : Number(bPreRelease[i]);

        if (typeof aPre === 'number' && typeof bPre === 'number') {
            if (aPre > bPre) return 1;
            if (aPre < bPre) return -1;
        } else if (typeof aPre === 'string' && typeof bPre === 'string') {
            if (aPre > bPre) return 1;
            if (aPre < bPre) return -1;
        } else if (typeof aPre === 'number') {
            return -1;
        } else {
            return 1;
        }
    }

    return 0;
}

// Asserts will go here
const assert = require('assert');

// Test cases
assert(compare('1.0.0', '1.0.0') === 0, '1.0.0 should equal 1.0.0');
assert(compare('1.0.0', '1.0.1') === -1, '1.0.0 should be less than 1.0.1');
assert(compare('1.0.1', '1.0.0') === 1, '1.0.1 should be greater than 1.0.0');
assert(compare('1.10.0', '1.2.0') === 1, '1.10.0 should be greater than 1.2.0');
assert(compare('1.2.0', '1.10.0') === -1, '1.2.0 should be less than 1.10.0');
assert(compare('1.0.0-alpha', '1.0.0') === -1, '1.0.0-alpha should be less than 1.0.0');
assert(compare('1.0.0', '1.0.0-alpha') === 1, '1.0.0 should be greater than 1.0.0-alpha');
assert(compare('1.0.0-beta', '1.0.0-alpha') === 1, '1.0.0-beta should be greater than 1.0.0-alpha');
assert(compare('1.0.0-alpha', '1.0.0-beta') === -1, '1.0.0-alpha should be less than 1.0.0-beta');
assert(compare('1.0.0-rc', '1.0.0-beta') === 1, '1.0.0-rc should be greater than 1.0.0-beta');
assert(compare('1.0.0-beta', '1.0.0-rc') === -1, '1.0.0-beta should be less than 1.0.0-rc');

console.log('All tests passed!');
