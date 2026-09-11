# flatten function behavior

The `flatten` function takes an object and flattens its nested structure into a single-level object with dot-notation keys.

## Key behaviors:

1. **Nested objects**: Gets flattened recursively using dot notation
   - Input: `{ a: { b: 1 } }`
   - Output: `{ 'a.b': 1 }`

2. **Arrays within objects**: Arrays are preserved as-is (not flattened)
   - Input: `{ a: [1, 2] }`
   - Output: `{ a: [1, 2] }`

3. **Primitive values**: Copied directly
   - Input: `{ a: 1, b: 2 }`
   - Output: `{ a: 1, b: 2 }`

4. **Null values**: Preserved
   - Input: `{ a: null }`
   - Output: `{ a: null }`

5. **Empty objects**: Return empty result
   - Input: `{}`  
   - Output: `{}`

## Why arrays are not flattened

The current implementation treats arrays as terminal values rather than structures to be flattened. This is consistent with the function's design to flatten nested object structures, not array contents.