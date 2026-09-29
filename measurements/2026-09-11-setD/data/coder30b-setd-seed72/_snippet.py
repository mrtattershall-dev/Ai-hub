import r7_grid

# Test parse_costs function
test_grid = """
.....
.#.#.
.....
"""

parsed = r7_grid.parse_costs(test_grid)
print("Parsed grid:")
for row in parsed:
    print(row)

# Test with a more complex example including digits
test_grid2 = """
123
4#5
678
"""
parsed2 = r7_grid.parse_costs(test_grid2)
print("\nParsed grid 2:")
for row in parsed2:
    print(row)

# Test cheapest_path function
costs = [
    [1, 1, 1, 1, 1],
    [1, 0, 1, 0, 1],
    [1, 1, 1, 1, 1]
]
start = (0, 0)
goal = (2, 4)
result = r7_grid.cheapest_path(costs, start, goal)
print(f"\nCheapest path from {start} to {goal}: {result}")

# Test with a path that should fail
costs2 = [
    [1, 1, 1],
    [0, 0, 0],
    [1, 1, 1]
]
start2 = (0, 0)
goal2 = (2, 2)
result2 = r7_grid.cheapest_path(costs2, start2, goal2)
print(f"Cheapest path from {start2} to {goal2}: {result2}")