#!/usr/bin/env python3

import r7_grid

# Test the life_step function
def test_life_step():
    # Create a simple 3x3 grid with a glider pattern
    grid = [
        [False, True, False],
        [False, False, True],
        [True, True, True]
    ]
    
    print("Original grid:")
    for row in grid:
        print(row)
    
    # Apply one step of life
    new_grid = r7_grid.life_step(grid)
    
    print("\nNew grid after one step:")
    for row in new_grid:
        print(row)
    
    # Verify the grid was not modified in place
    print("\nOriginal grid after life_step (should be unchanged):")
    for row in grid:
        print(row)
    
    return new_grid

if __name__ == "__main__":
    test_life_step()