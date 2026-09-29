#!/usr/bin/env python3

import r7_grid

# Test case 1: Simple grid
grid_text1 = """
..#
.#.
...
"""

# Test case 2: Larger grid with walls
grid_text2 = """
....#
.#.#.
.....
.#...
"""

# Test case 3: Grid with no walls
grid_text3 = """
....
....
....
....
"""

def test_reachable():
    print("Testing reachable function...")
    
    # Test 1
    grid1 = r7_grid.parse_grid(grid_text1)
    print("Grid 1:")
    print(r7_grid.render(grid1))
    result1 = r7_grid.reachable(grid1, (0, 0))
    print(f"Reachable from (0,0): {result1}")
    
    # Test 2
    grid2 = r7_grid.parse_grid(grid_text2)
    print("\nGrid 2:")
    print(r7_grid.render(grid2))
    result2 = r7_grid.reachable(grid2, (0, 0))
    print(f"Reachable from (0,0): {result2}")
    
    # Test 3
    grid3 = r7_grid.parse_grid(grid_text3)
    print("\nGrid 3:")
    print(r7_grid.render(grid3))
    result3 = r7_grid.reachable(grid3, (0, 0))
    print(f"Reachable from (0,0): {result3}")
    
    # Test 4: Start position on wall
    result4 = r7_grid.reachable(grid1, (1, 1))
    print(f"Reachable from (1,1) [wall]: {result4}")
    
    # Test 5: Start position outside grid
    result5 = r7_grid.reachable(grid1, (10, 10))
    print(f"Reachable from (10,10) [outside]: {result5}")

if __name__ == "__main__":
    test_reachable()