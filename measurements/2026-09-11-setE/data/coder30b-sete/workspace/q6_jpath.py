def get(data, path, default=None):
    """
    Get a value from nested data structure using dot-notation path.
    
    Args:
        data: The data structure (dict, list, or scalar)
        path: Dot-notation path like 'a.b.0.c'
        default: Default value to return if path is missing (optional)
        
    Returns:
        The value at the specified path, or default if path is missing
    """
    # Split the path into components
    components = path.split('.')
    
    current = data
    for component in components:
        try:
            # Handle wildcard '*'
            if component == '*':
                # If current is a list, get all elements
                if isinstance(current, (list, tuple)):
                    # Return a list of results for each element
                    results = []
                    for item in current:
                        # Create a temporary path with the remaining components
                        remaining_path = '.'.join(components[components.index(component)+1:])
                        if remaining_path:
                            # Recursively get the value for each item
                            try:
                                result = get(item, remaining_path, default)
                                results.append(result)
                            except KeyError:
                                # If the remaining path doesn't exist for this item, 
                                # add default if provided, otherwise skip
                                if default is not None:
                                    results.append(default)
                        else:
                            # If no remaining path, just return the item itself
                            results.append(item)
                    return results
                # If current is a dict, get all values
                elif isinstance(current, dict):
                    # Return a list of results for each value
                    results = []
                    for key, value in current.items():
                        # Create a temporary path with the remaining components
                        remaining_path = '.'.join(components[components.index(component)+1:])
                        if remaining_path:
                            # Recursively get the value for each value
                            try:
                                result = get(value, remaining_path, default)
                                results.append(result)
                            except KeyError:
                                # If the remaining path doesn't exist for this value, 
                                # add default if provided, otherwise skip
                                if default is not None:
                                    results.append(default)
                        else:
                            # If no remaining path, just return the value itself
                            results.append(value)
                    return results
                else:
                    # '*' can only be used on lists or dicts
                    if default is not None:
                        return default
                    raise KeyError(f"Path {path} is invalid: '*' can only be used on lists or dicts, got {type(current).__name__}")
            # Try to convert to integer for list indexing
            elif component.isdigit():
                index = int(component)
                if not isinstance(current, (list, tuple)):
                    if default is not None:
                        return default
                    raise KeyError(f"Path {path} is invalid: cannot index into {type(current).__name__}")
                if index < 0 or index >= len(current):
                    if default is not None:
                        return default
                    raise KeyError(f"Path {path} is invalid: index {index} out of range")
                current = current[index]
            else:
                # Treat as dictionary key
                if not isinstance(current, dict):
                    if default is not None:
                        return default
                    raise KeyError(f"Path {path} is invalid: cannot access key '{component}' on {type(current).__name__}")
                if component not in current:
                    if default is not None:
                        return default
                    raise KeyError(f"Path {path} is invalid: key '{component}' not found")
                current = current[component]
        except (KeyError, IndexError, TypeError) as e:
            # Return default if provided, otherwise re-raise with path information
            if default is not None:
                return default
            raise KeyError(f"Path {path} is invalid: {str(e)}")
    
    return current

def set_path(data, path, value):
    """
    Set a value in nested data structure using dot-notation path.
    
    Args:
        data: The data structure (dict, list, or scalar)
        path: Dot-notation path like 'a.b.0.c'
        value: The value to set
        
    Returns:
        The modified data structure
        
    Raises:
        IndexError: If list index is out of bounds (past the end)
        TypeError: If trying to index into non-indexable type
    """
    # Split the path into components
    components = path.split('.')
    
    current = data
    # Navigate to the parent of the target location
    for i, component in enumerate(components[:-1]):
        try:
            # Check if component is a digit (list index)
            if component.isdigit():
                index = int(component)
                # If current is not a list/tuple, we need to create one
                if not isinstance(current, (list, tuple)):
                    # Create a new list and update current
                    current[component] = []
                    current = current[component]
                else:
                    # If current is a list/tuple, check if we can access the index
                    if index < 0:
                        raise IndexError(f"Path {path} is invalid: index {index} out of range")
                    # If index is at the end or one past the end, we can extend
                    if index == len(current):
                        # Extend the list with None values to reach the desired index
                        current.extend([None] * (index - len(current) + 1))
                        current = current[index]
                    elif index < len(current):
                        current = current[index]
                    else:
                        raise IndexError(f"Path {path} is invalid: index {index} out of range")
            else:
                # Treat as dictionary key
                if not isinstance(current, dict):
                    # Create a new dict and update current
                    current[component] = {}
                    current = current[component]
                else:
                    # If current is a dict, check if key exists
                    if component not in current:
                        current[component] = {}
                    current = current[component]
        except (KeyError, IndexError, TypeError) as e:
            raise KeyError(f"Path {path} is invalid: {str(e)}")
    
    # Set the final value
    last_component = components[-1]
    if last_component.isdigit():
        index = int(last_component)
        if not isinstance(current, (list, tuple)):
            raise TypeError(f"Path {path} is invalid: cannot index into {type(current).__name__}")
        if index < 0:
            raise IndexError(f"Path {path} is invalid: index {index} out of range")
        # If index is at the end or one past the end, we can extend
        if index == len(current):
            # Extend the list with None values to reach the desired index
            current.extend([None] * (index - len(current) + 1))
            current[index] = value
        elif index < len(current):
            current[index] = value
        else:
            raise IndexError(f"Path {path} is invalid: index {index} out of range")
    else:
        if not isinstance(current, dict):
            raise TypeError(f"Path {path} is invalid: cannot access key '{last_component}' on {type(current).__name__}")
        current[last_component] = value
    
    return data

if __name__ == "__main__":
    # Test cases
    data = {
        "a": {
            "b": [1, 2, {"c": "value"}]
        }
    }
    
    # These should work
    assert get(data, "a.b.0") == 1
    assert get(data, "a.b.2.c") == "value"
    
    # This should raise KeyError with path in message
    try:
        get(data, "a.b.5")
        assert False, "Should have raised KeyError"
    except KeyError as e:
        assert "a.b.5" in str(e)
    
    try:
        get(data, "a.x")
        assert False, "Should have raised KeyError"
    except KeyError as e:
        assert "a.x" in str(e)
def delete(data, path):
    """
    Delete a value from nested data structure using dot-notation path and return it.
    
    Args:
        data: The data structure (dict, list, or scalar)
        path: Dot-notation path like 'a.b.0.c'
        
    Returns:
        The value that was removed from the specified path
        
    Raises:
        KeyError: If path is missing
    """
    # Split the path into components
    components = path.split('.')
    
    current = data
    # Navigate to the parent of the target location
    for i, component in enumerate(components[:-1]):
        try:
            # Check if component is a digit (list index)
            if component.isdigit():
                index = int(component)
                if not isinstance(current, (list, tuple)):
                    raise KeyError(f"Path {path} is invalid: cannot index into {type(current).__name__}")
                if index < 0 or index >= len(current):
                    raise KeyError(f"Path {path} is invalid: index {index} out of range")
                current = current[index]
            else:
                # Treat as dictionary key
                if not isinstance(current, dict):
                    raise KeyError(f"Path {path} is invalid: cannot access key '{component}' on {type(current).__name__}")
                if component not in current:
                    raise KeyError(f"Path {path} is invalid: key '{component}' not found")
                current = current[component]
        except (KeyError, IndexError, TypeError) as e:
            raise KeyError(f"Path {path} is invalid: {str(e)}")
    
    # Remove and return the final value
    last_component = components[-1]
    if last_component.isdigit():
        index = int(last_component)
        if not isinstance(current, (list, tuple)):
            raise KeyError(f"Path {path} is invalid: cannot index into {type(current).__name__}")
        if index < 0 or index >= len(current):
            raise KeyError(f"Path {path} is invalid: index {index} out of range")
        return current.pop(index)
    else:
        if not isinstance(current, dict):
            raise KeyError(f"Path {path} is invalid: cannot access key '{last_component}' on {type(current).__name__}")
        if last_component not in current:
            raise KeyError(f"Path {path} is invalid: key '{last_component}' not found")
        return current.pop(last_component)
def find(data, predicate):
    """
    Find all leaf values in nested data structure that match a predicate.
    
    Args:
        data: The data structure (dict, list, or scalar)
        predicate: A function that takes a value and returns True if it matches
        
    Returns:
        A sorted list of dotted paths (strings) to leaf values that match the predicate
    """
    paths = []
    
    def _traverse(obj, path=""):
        if isinstance(obj, dict):
            for key, value in obj.items():
                new_path = f"{path}.{key}" if path else key
                _traverse(value, new_path)
        elif isinstance(obj, (list, tuple)):
            for i, value in enumerate(obj):
                new_path = f"{path}.{i}" if path else str(i)
                _traverse(value, new_path)
        else:
            # This is a leaf value (scalar, None, etc.)
            if predicate(obj):
                paths.append(path)
    
    _traverse(data)
    return sorted(paths)
