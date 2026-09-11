def neighbors(grid, r, c):
    rows = len(grid)
    cols = len(grid[0]) if rows > 0 else 0
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    result = []
    for dr, dc in directions:
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols:
            result.append((nr, nc))
    return result

# Test cases
assert neighbors([[1, 2, 3], [4, 5, 6], [7, 8, 9]], 1, 1) == [(0, 1), (2, 1), (1, 0), (1, 2)]
result = neighbors([[1, 2, 3], [4, 5, 6], [7, 8, 9]], 0, 0)
print(f"Result for (0, 0): {result}")
assert result == [(0, 1), (1, 0)]
assert neighbors([[1, 2, 3], [4, 5, 6], [7, 8, 9]], 2, 2) == [(1, 2), (2, 1)]
assert neighbors([[1, 2, 3], [4, 5, 6], [7, 8, 9]], 1, 0) == [(0, 0), (2, 0), (1, 1)]
assert neighbors([[1, 2, 3], [4, 5, 6], [7, 8, 9]], 1, 2) == [(0, 2), (2, 2), (1, 1)]

print("All tests passed.")