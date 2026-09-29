# Flatten Function Behavior

The `flatten` function recursively flattens an object with nested arrays into a single array. It takes three parameters:
- `obj`: The object to flatten.
- `parentKey`: The parent key for nested properties (default is an empty string).
- `result`: The resulting flattened object (default is an empty object).

For example, given the input `{ a: [1, 2] }`, the function will return `{ 'a.0': 1, 'a.1': 2 }`.