const { compare } = require('./u7_semver');

// Test cases
console.log('Testing version comparison...');

// Test equal versions
console.assert(compare('1.0.0', '1.0.0') === 0, '1.0.0 should equal 1.0.0');
console.assert(compare('2.1.3', '2.1.3') === 0, '2.1.3 should equal 2.1.3');

// Test less than
console.assert(compare('1.0.0', '2.0.0') === -1, '1.0.0 should be less than 2.0.0');
console.assert(compare('1.0.0', '1.1.0') === -1, '1.0.0 should be less than 1.1.0');
console.assert(compare('1.0.0', '1.0.1') === -1, '1.0.0 should be less than 1.0.1');
console.assert(compare('1.0', '1.0.1') === -1, '1.0 should be less than 1.0.1');
console.assert(compare('1', '1.0.1') === -1, '1 should be less than 1.0.1');

// Test greater than
console.assert(compare('2.0.0', '1.0.0') === 1, '2.0.0 should be greater than 1.0.0');
console.assert(compare('1.1.0', '1.0.0') === 1, '1.1.0 should be greater than 1.0.0');
console.assert(compare('1.0.1', '1.0.0') === 1, '1.0.1 should be greater than 1.0.0');
console.assert(compare('1.0.1', '1.0') === 1, '1.0.1 should be greater than 1.0');
console.assert(compare('1.0.1', '1') === 1, '1.0.1 should be greater than 1');

// Test edge cases
console.assert(compare('1.0.0.0', '1.0.0') === 0, '1.0.0.0 should equal 1.0.0');
console.assert(compare('1.0.0', '1.0.0.0') === 0, '1.0.0 should equal 1.0.0.0');
console.assert(compare('1.2.3', '1.2.3.0') === 0, '1.2.3 should equal 1.2.3.0');

console.log('All tests passed!');