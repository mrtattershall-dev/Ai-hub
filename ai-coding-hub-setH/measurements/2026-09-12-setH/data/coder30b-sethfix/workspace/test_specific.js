const { evaluate: exprEvaluate } = require('./s5_expr.js');
const { Cache } = require('./s7_cache.js');
const { Library } = require('./s1_library.js');
const { memberLine } = require('./s10_desk.js');

try {
    const result1 = exprEvaluate('-(2+3)*2');
    console.log('-(2+3)*2 =', result1);
    if (result1 === -10) {
        console.log('✅ Expression evaluation works');
    } else {
        console.log('❌ Expression evaluation failed');
        process.exit(1);
    }

    const result2 = exprEvaluate('2*-3');
    console.log('2*-3 =', result2);
    if (result2 === -6) {
        console.log('✅ Expression evaluation works');
    } else {
        console.log('❌ Expression evaluation failed');
        process.exit(1);
    }

    // Test Cache class
    const cache = new Cache(2);
    cache.set('a', 1);
    cache.set('b', 2);
    if (cache.get('a') === 1) {
        console.log('✅ Cache basic get works');
    } else {
        console.log('❌ Cache basic get failed');
        process.exit(1);
    }
    
    // Test peek method
    if (cache.peek('a') === 1) {
        console.log('✅ Cache peek works');
    } else {
        console.log('❌ Cache peek failed');
        process.exit(1);
    }
    
    // Test that peek doesn't affect LRU order
    cache.set('c', 3);
    if (cache.get('b') === 2) {
        console.log('✅ Cache peek does not affect LRU order');
    } else {
        console.log('❌ Cache peek affects LRU order');
        process.exit(1);
    }

    // Test availability function
    const library = new Library();
    library.addBook('123', 'Book 1', 2);
    library.addBook('456', 'Book 2', 1);
    
    // Test member with no loans
    const result3 = memberLine(library, 'Alice');
    if (result3 === 'Alice: none') {
        console.log('✅ memberLine with no loans returns "member: none"');
    } else {
        console.log('❌ memberLine with no loans should return "member: none", got "' + result3 + '"');
        process.exit(1);
    }

    // Test member with loans
    library.checkout('123', 'Alice');
    library.checkout('456', 'Alice');
    const result4 = memberLine(library, 'Alice');
    if (result4 === 'Alice: 123, 456') {
        console.log('✅ memberLine with loans returns "member: isbn1, isbn2"');
    } else {
        console.log('❌ memberLine with loans should return "member: isbn1, isbn2", got "' + result4 + '"');
        process.exit(1);
    }

    console.log('✅ All memberLine tests pass!');
} catch (error) {
    console.error('Test failed with error:', error);
    process.exit(1);
}