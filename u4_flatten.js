function flatten(obj) {
  const result = {};
  
  function flattenHelper(currentObj, prefix = '') {
    for (const key in currentObj) {
      if (currentObj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof currentObj[key] === 'object' && currentObj[key] !== null && !Array.isArray(currentObj[key])) {
          flattenHelper(currentObj[key], newKey);
        } else {
          result[newKey] = currentObj[key];
        }
      }
    }
  }
  
  flattenHelper(obj);
  return result;
}

// Asserts
console.assert(JSON.stringify(flatten({ a: { b: 1 } })) === JSON.stringify({ 'a.b': 1 }), 'Test 1 failed');
console.assert(JSON.stringify(flatten({ a: { b: { c: 2 } } })) === JSON.stringify({ 'a.b.c': 2 }), 'Test 2 failed');
console.assert(JSON.stringify(flatten({ a: 1, b: 2 })) === JSON.stringify({ a: 1, b: 2 }), 'Test 3 failed');
console.assert(JSON.stringify(flatten({ a: { b: 1 }, c: { d: 2 } })) === JSON.stringify({ 'a.b': 1, 'c.d': 2 }), 'Test 4 failed');
console.assert(JSON.stringify(flatten({})) === JSON.stringify({}), 'Test 5 failed');
console.assert(JSON.stringify(flatten({ a: null })) === JSON.stringify({ a: null }), 'Test 6 failed');
console.assert(JSON.stringify(flatten({ a: [1, 2, 3] })) === JSON.stringify({ a: [1, 2, 3] }), 'Test 7 failed');

console.log('All asserts passed!');
module.exports = flatten;
console.assert(JSON.stringify(flatten({ a: [1, 2] })) === JSON.stringify({ a: [1, 2] }), 'Test 8 failed');
console.log('All asserts passed!');
module.exports = flatten;
