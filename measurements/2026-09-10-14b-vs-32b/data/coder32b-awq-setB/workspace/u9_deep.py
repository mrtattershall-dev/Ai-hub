def deep_get(data, path):
    keys = path.split('.')
    for key in keys:
        if isinstance(data, dict) and key in data:
            data = data[key]
        elif isinstance(data, list) and key.isdigit() and int(key) < len(data):
            data = data[int(key)]
        else:
            return None
    return data

# Asserts will go here
# Asserts for testing
assert deep_get({'a': {'b': [1, 2, {'c': 3}]}}, 'a.b.0.c') == None
assert deep_get({'a': {'b': [1, 2, {'c': 3}]}}, 'a.b.2.c') == 3
assert deep_get({'a': {'b': [1, 2, {'c': 3}]}}, 'a.b.2.d') == None
assert deep_get({'a': {'b': [1, 2, {'c': 3}]}}, 'a.b.3') == None
assert deep_get({'a': {'b': [1, 2, {'c': 3}]}}, 'a.b') == [1, 2, {'c': 3}]
assert deep_get({'a': {'b': [1, 2, {'c': 3}]}}, 'a.x') == None
assert deep_get({'a': {'b': [1, 2, {'c': 3}]}}, 'x') == None
assert deep_get([], '0') == None
assert deep_get([{'a': 1}], '0.a') == 1
assert deep_get([{'a': 1}], '1.a') == None
