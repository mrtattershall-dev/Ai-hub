// Import the modules
const tempModule = require('./t1_temp.js');
const intervalsModule = require('./t4_intervals.js');

// Test t1_temp.js exports
console.log('Testing t1_temp.js...');

// Test cToK function
try {
  const result = tempModule.kToC(273.15);
  console.assert(result === 0, `kToC(273.15) should return 0, got ${result}`);
  console.log('✓ kToC(273.15) = 0');
} catch (e) {
  console.error('✗ kToC test failed:', e.message);
}

try {
  const result = tempModule.kToC(373.15);
  console.assert(result === 100, `kToC(373.15) should return 100, got ${result}`);
  console.log('✓ kToC(373.15) = 100');
} catch (e) {
  console.error('✗ kToC test failed:', e.message);
}

// Test t4_intervals.js exports
console.log('Testing t4_intervals.js...');

// Test isEven function
try {
  const result = intervalsModule.isEven(2);
  console.assert(result === true, `isEven(2) should return true, got ${result}`);
  console.log('✓ isEven(2) = true');
} catch (e) {
  console.error('✗ isEven test failed:', e.message);
}

try {
  const result = intervalsModule.isEven(3);
  console.assert(result === false, `isEven(3) should return false, got ${result}`);
  console.log('✓ isEven(3) = false');
} catch (e) {
  console.error('✗ isEven test failed:', e.message);
}

// Test isOdd function
try {
  const result = intervalsModule.isOdd(3);
  console.assert(result === true, `isOdd(3) should return true, got ${result}`);
  console.log('✓ isOdd(3) = true');
} catch (e) {
  console.error('✗ isOdd test failed:', e.message);
}

try {
  const result = intervalsModule.isOdd(2);
  console.assert(result === false, `isOdd(2) should return false, got ${result}`);
  console.log('✓ isOdd(2) = false');
} catch (e) {
  console.error('✗ isOdd test failed:', e.message);
}

// Test isInRange function
try {
  const result = intervalsModule.isInRange(5, 1, 10);
  console.assert(result === true, `isInRange(5, 1, 10) should return true, got ${result}`);
  console.log('✓ isInRange(5, 1, 10) = true');
} catch (e) {
  console.error('✗ isInRange test failed:', e.message);
}

try {
  const result = intervalsModule.isInRange(0, 1, 10);
  console.assert(result === false, `isInRange(0, 1, 10) should return false, got ${result}`);
  console.log('✓ isInRange(0, 1, 10) = false');
} catch (e) {
  console.error('✗ isInRange test failed:', e.message);
}

console.log('All tests completed successfully!');