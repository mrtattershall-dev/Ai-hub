def _find(path, obj):
    """Find a value in a nested dictionary by path."""
    keys = path.split('.')
    for key in keys:
        if isinstance(obj, dict) and key in obj:
            obj = obj[key]
        else:
            return None
    return obj

def delete(path, obj):
    """Delete a value in a nested dictionary by path."""
    keys = path.split('.')
    for key in keys[:-1]:
        if isinstance(obj, dict) and key in obj:
            obj = obj[key]
        else:
            return False
    if isinstance(obj, dict) and keys[-1] in obj:
        del obj[keys[-1]]
        return True
    return False

def diff(a, b):
    """Find the differences between two nested dictionaries."""
    result = {}
    for key in a:
        if key not in b:
            result[key] = a[key]
        elif isinstance(a[key], dict) and isinstance(b[key], dict):
            sub_diff = diff(a[key], b[key])
            if sub_diff:
                result[key] = sub_diff
    for key in b:
        if key not in a:
            result[key] = b[key]
    return result

def find(path, obj):
    """Find a value in a nested dictionary by path."""
    keys = path.split('.')
    for key in keys:
        if isinstance(obj, dict) and key in obj:
            obj = obj[key]
        else:
            return None
    return obj

def flatten(obj, parent_key='', sep='.'):
    """Flatten a nested dictionary."""
    items = []
    for k, v in obj.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)

def get(path, obj):
    """Get a value from a nested dictionary by path."""
    keys = path.split('.')
    for key in keys:
        if isinstance(obj, dict) and key in obj:
            obj = obj[key]
        else:
            return None
    return obj

def set_path(path, value, obj):
    """Set a value in a nested dictionary by path."""
    keys = path.split('.')
    for key in keys[:-1]:
        if isinstance(obj, dict) and key in obj:
            obj = obj[key]
        else:
            obj[key] = {}
            obj = obj[key]
    if isinstance(obj, dict):
        obj[keys[-1]] = value
    return obj

def unflatten(obj, sep='.'):
    """Unflatten a dictionary."""
    result = {}
    for key, value in obj.items():
        keys = key.split(sep)
        set_path(keys, value, result)
    return result

def merge(a, b):
    """
    Deep merge of two dictionaries. Nested dicts merge, anything else from b wins.
    Lists are replaced, not merged. Neither input is changed.
    """
    result = a.copy()
    for key, value in b.items():
        if key in result and isinstance(result[key], dict) and isinstance(value, dict):
            result[key] = merge(result[key], value)
        else:
            result[key] = value
    return result

# Test case
if __name__ == "__main__":
    a = {'a': 1, 'b': {'c': 2, 'd': 3}, 'e': [4, 5]}
    b = {'b': {'c': 4}, 'f': 6, 'e': [7]}
    merged = merge(a, b)
    print(merged)  # Expected output: {'a': 1, 'b': {'c': 4, 'd': 3}, 'e': [7], 'f': 6}