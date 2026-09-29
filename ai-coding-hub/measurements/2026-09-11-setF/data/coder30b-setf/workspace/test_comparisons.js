const { evaluate } = require('./s5_expr.js');

// Test comparison operators
console.log('Testing comparison operators:');
console.log('1 + 1 == 2:', evaluate('1 + 1 == 2'));
console.log('2 < 1:', evaluate('2 < 1'));
console.log('5 > 3:', evaluate('5 > 3'));
console.log('3 <= 3:', evaluate('3 <= 3'));
console.log('7 >= 10:', evaluate('7 >= 10'));
console.log('4 == 4:', evaluate('4 == 4'));
console.log('5 != 3:', evaluate('5 != 3'));
console.log('1 + 2 < 4:', evaluate('1 + 2 < 4'));
console.log('1 + 2 == 3:', evaluate('1 + 2 == 3'));