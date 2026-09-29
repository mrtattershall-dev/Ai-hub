#!/usr/bin/env python3

# Test the new life_run and is_still functions

import r7_grid

# Test pattern: a simple glider
glider = [
    [False, True, False],
    [False, False, True],
    [True, True, True]
]

print("Original glider pattern:")
for row in glider:
    print(row)

# Test is_still function
print("\nTesting is_still on glider:")
result = r7_grid.is_still(glider)
print(f"is_still(glider) = {result}")

# Test life_run function
print("\nTesting life_run on glider for 3 steps:")
result = r7_grid.life_run(glider, 3)
for row in result:
    print(row)

# Test with a stable pattern (block)
block = [
    [True, True],
    [True, True]
]

print("\nOriginal block pattern:")
for row in block:
    print(row)

print("\nTesting is_still on block:")
result = r7_grid.is_still(block)
print(f"is_still(block) = {result}")

print("\nTesting life_run on block for 5 steps:")
result = r7_grid.life_run(block, 5)
for row in result:
    print(row)