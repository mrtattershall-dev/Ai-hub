const { tokenize, evaluate } = require('./s6_parser.js');

// Test tokenize function
console.log('Testing tokenize function:');
try {
  console.log('tokenize("2 + 3"):', tokenize('2 + 3'));
  console.log('tokenize("2 * (3 + 4)"):', tokenize('2 * (3 + 4)'));
  console.log('tokenize("10 / 2 - 3"):', tokenize('10 / 2 - 3'));
} catch (e) {
  console.error('Tokenize error:', e.message);
}

// Test evaluate function
console.log('\nTesting evaluate function:');
try {
  console.log('evaluate("2 + 3"):', evaluate('2 + 3'));
  console.log('evaluate("2 * (3 + 4)"):', evaluate('2 * (3 + 4)'));
  console.log('evaluate("10 / 2 - 3"):', evaluate('10 / 2 - 3'));
  console.log('evaluate("2 + 3 * 4"):', evaluate('2 + 3 * 4'));
  console.log('evaluate("(2 + 3) * 4"):', evaluate('(2 + 3) * 4'));
  console.log('evaluate("-3"):', evaluate('-3'));
  console.log('evaluate("-(2+1)"):', evaluate('-(2+1)'));
  console.log('evaluate("4*-2"):', evaluate('4*-2'));
  console.log('evaluate("2--1"):', evaluate('2--1'));
} catch (e) {
  console.error('Evaluate error:', e.message);
}

// Test error cases
console.log('\nTesting error cases:');
try {
  evaluate('2 + + 3');
} catch (e) {
  console.log('Expected error for "2 + + 3":', e.message);
}

try {
  evaluate('2 / 0');
} catch (e) {
  console.log('Expected error for "2 / 0":', e.message);
}

try {
  evaluate('2 + 3)');
} catch (e) {
  console.log('Expected error for "2 + 3)":', e.message);
}