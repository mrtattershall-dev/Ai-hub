The `flatten` function processes an object with nested arrays by recursively traversing the object and creating a new object with dot-separated keys for nested properties. For example, given the input `{ a: [1, 2] }`, the function will produce `{ 'a.0': 1, 'a.1': 2 }`.

This behavior is documented to ensure that the function consistently handles arrays within objects as described.