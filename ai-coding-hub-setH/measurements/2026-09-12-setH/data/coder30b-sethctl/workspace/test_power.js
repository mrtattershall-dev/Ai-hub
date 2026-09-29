const { evaluate } = require('./s5_expr.js');

try {
  console.log('Testing power operator:');
  console.log('2^3^2 =', evaluate('2^3^2'));
  console.log('-2^2 =', evaluate('-2^2'));
  console.log('2^3 =', evaluate('2^3'));
  console.log('4^2 =', evaluate('4^2'));
} catch (e) {
  console.error('Error:', e.message);
}