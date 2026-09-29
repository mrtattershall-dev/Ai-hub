# Test the r7_grid functionality including the new diagonal parameter
import r7_grid

# Test case 1: Basic grid parsing
try:
    grid_text = """
.....
.....
.....
.....
.....
"""
    grid = r7_grid.parse_grid(grid_text)
    print(f"Test 1 - Grid parsing:")
    print(f"  Grid size: {len(grid)} rows, {len(grid[0]) if grid else 0} cols")
    print(f"  Grid parsed successfully: {len(grid) > 0}")
except Exception as e:
    print(f"Test 1 failed with error: {e}")

# Test case 2: Basic shortest_path without diagonal (existing behavior)
try:
    grid_text = """
.....
.#.#.
.....
.....
.....
"""
    grid = r7_grid.parse_grid(grid_text)
    start = (0, 0)
    goal = (4, 4)
    path = r7_grid.shortest_path(grid, start, goal)
    print(f"Test 2 - Shortest path without diagonal:")
    print(f"  Path found: {path is not None}")
    if path:
        print(f"  Path length: {len(path)}")
        print(f"  Path: {path}")
except Exception as e:
    print(f"Test 2 failed with error: {e}")

# Test case 3: Shortest_path with diagonal=True
try:
    grid_text = """
.....
.#.#.
.....
.....
.....
"""
    grid = r7_grid.parse_grid(grid_text)
    start = (0, 0)
    goal = (4, 4)
    path = r7_grid.shortest_path(grid, start, goal, diagonal=True)
    print(f"Test 3 - Shortest path with diagonal=True:")
    print(f"  Path found: {path is not None}")
    if path:
        print(f"  Path length: {len(path)}")
        print(f"  Path: {path}")
except Exception as e:
    print(f"Test 3 failed with error: {e}")

# Test case 4: Diagonal path should be shorter when possible
try:
    grid_text = """
.....
.....
.....
.....
.....
"""
    grid = r7_grid.parse_grid(grid_text)
    start = (0, 0)
    goal = (4, 4)
    path_no_diag = r7_grid.shortest_path(grid, start, goal, diagonal=False)
    path_with_diag = r7_grid.shortest_path(grid, start, goal, diagonal=True)
    print(f"Test 4 - Path comparison:")
    print(f"  Path without diagonal: {len(path_no_diag) if path_no_diag else 'None'} steps")
    print(f"  Path with diagonal: {len(path_with_diag) if path_with_diag else 'None'} steps")
except Exception as e:
    print(f"Test 4 failed with error: {e}")

# Test case 5: Diagonal path with blocked corners
try:
    grid_text = """
.....
.#.#.
.#.#.
.....
.....
"""
    grid = r7_grid.parse_grid(grid_text)
    start = (0, 0)
    goal = (4, 4)
    path_with_diag = r7_grid.shortest_path(grid, start, goal, diagonal=True)
    print(f"Test 5 - Diagonal with blocked corners:")
    print(f"  Path found: {path_with_diag is not None}")
    if path_with_diag:
        print(f"  Path length: {len(path_with_diag)}")
        print(f"  Path: {path_with_diag}")
except Exception as e:
    print(f"Test 5 failed with error: {e}")