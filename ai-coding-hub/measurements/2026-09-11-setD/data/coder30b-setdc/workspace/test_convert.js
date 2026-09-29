const { convertMoney } = require('./r8_money.js');

// Test cases
try {
    // Test basic conversion
    const result1 = convertMoney(10000, 'USD', 'EUR', { USD: 1, EUR: 1.1 });
    console.log('Test 1 - 100 USD to EUR:', result1, 'cents');
    
    // Test with different amounts
    const result2 = convertMoney(5000, 'USD', 'EUR', { USD: 1, EUR: 1.1 });
    console.log('Test 2 - 50 USD to EUR:', result2, 'cents');
    
    // Test with same currency
    const result3 = convertMoney(10000, 'USD', 'USD', { USD: 1, EUR: 1.1 });
    console.log('Test 3 - 100 USD to USD:', result3, 'cents');
    
    // Test error for unknown source currency
    try {
        convertMoney(10000, 'GBP', 'USD', { USD: 1, EUR: 1.1 });
        console.log('ERROR: Should have thrown for unknown source currency');
    } catch (e) {
        console.log('Test 4 - Correctly threw error for unknown source currency:', e.message);
    }
    
    // Test error for unknown target currency
    try {
        convertMoney(10000, 'USD', 'GBP', { USD: 1, EUR: 1.1 });
        console.log('ERROR: Should have thrown for unknown target currency');
    } catch (e) {
        console.log('Test 5 - Correctly threw error for unknown target currency:', e.message);
    }
    
    console.log('All tests completed successfully!');
} catch (error) {
    console.error('Test failed:', error.message);
}