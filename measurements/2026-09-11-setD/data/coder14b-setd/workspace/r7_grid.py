def parse_grid(text):
    lines = text.strip().split('\n')
    if not lines:
        raise ValueError("Input text is empty")
    
    grid = []
    for line in lines:
        if not all(c in '.#' for c in line):
            raise ValueError("Input contains invalid characters")
        grid.append([c == '.' for c in line])
    
    if not all(len(row) == len(grid[0]) for row in grid):
        raise ValueError("Input lines differ in length")
    
    return grid
def neighbors(grid, r, c):
    rows, cols = len(grid), len(grid[0])
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    result = []
    
    for dr, dc in directions:
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc]:
            result.append((nr, nc))
    
    return result
if __name__ == "__main__":
    # Test parse_grid
    grid_text = """
.....
.#...
.....
"""
    expected_grid = [
        [True, True, True, True, True],
        [False, True, False, True, False],
        [True, True, True, True, True]
    ]
    assert parse_grid(grid_text) == expected_grid

    # Test neighbors
    assert neighbors(grid, 1, 1) == [(0, 1), (2, 1), (1, 0), (1, 2)]
    assert neighbors(grid, 0, 0) == [(1, 0), (0, 1)]
    assert neighbors(grid, 2, 2) == [(1, 2), (2, 1)]
