#!/usr/bin/env python3

# Test the render function in r7_grid.py
import r7_grid

# Create a simple test grid with consistent line lengths using only '.' and '#' 
test_grid_text = """....
.#..
....
#.#."""

# Parse the grid
grid = r7_grid.parse_grid(test_grid_text)

# Create a simple path
path = [(0, 0), (0, 1), (1, 1), (2, 1)]

# Test render function
result = r7_grid.render(grid, path)
print("Rendered grid with path:")
print(repr(result))
print("Rendered grid with path (formatted):")
print(result)

# Test render function without path
result_no_path = r7_grid.render(grid)
print("\nRendered grid without path:")
print(repr(result_no_path))
print("Rendered grid without path (formatted):")
print(result_no_path)
# Test the read_counts function in r2_text.py
import r2_text

# Test with a simple text file
try:
    # This should work if the file exists
    counts = r2_text.read_counts('test_file.txt')
    print("Word counts from file:", counts)
except FileNotFoundError:
    print("File not found - this is expected for a non-existent file")

# Create a test file for the function
with open('test_file.txt', 'w') as f:
    f.write("Hello world! This is a test file with hello and world.")

# Test the function with the created file
counts = r2_text.read_counts('test_file.txt')
print("Word counts from test_file.txt:", counts)

# Test with non-existent file
try:
    r2_text.read_counts('non_existent_file.txt')
except FileNotFoundError as e:
    print("Correctly raised FileNotFoundError:", e)
# Test the to_text function
print("\nTesting to_text function:")
test_grid = [
    [True, True, False, True],
    [False, True, True, False],
    [True, False, True, True]
]

# Test to_text function
text_result = r7_grid.to_text(test_grid)
print("Grid to text result:")
print(repr(text_result))
print("Formatted:")
print(text_result)

# Test round-trip: parse_grid(to_text(g)) == g
round_trip = r7_grid.parse_grid(text_result)
print("\nRound-trip test:")
print("Original grid:")
for row in test_grid:
    print(row)
print("Parsed from text:")
for row in round_trip:
    print(row)
print("Round-trip successful:", test_grid == round_trip)

# Test empty grid
empty_grid = []
empty_text = r7_grid.to_text(empty_grid)
print("\nEmpty grid test:")
print("Empty grid to text:", repr(empty_text))
print("Empty grid round-trip:", r7_grid.parse_grid(empty_text) == empty_grid)
