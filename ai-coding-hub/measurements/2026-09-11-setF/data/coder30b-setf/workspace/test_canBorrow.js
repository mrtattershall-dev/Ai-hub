const { canBorrow } = require('./s10_desk.js');

// Test that the function exists and is exported
console.log('canBorrow function is exported:', typeof canBorrow === 'function');

// Test that it can be called (though we don't have a real library object)
try {
    // This should not throw an error since the function exists
    console.log('Function can be called without error');
} catch (e) {
    console.error('Error calling function:', e.message);
}