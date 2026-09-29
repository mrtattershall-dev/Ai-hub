def life_step(grid):
    rows = len(grid)
    cols = len(grid[0])
    new_grid = [[False] * cols for _ in range(rows)]

    for r in range(rows):
        for c in range(cols):
            live_neighbors = sum(grid[nr][nc] for nr, nc in neighbors(grid, r, c) if 0 <= nr < rows and 0 <= nc < cols)
            print(f"Cell ({r}, {c}): Live Neighbors = {live_neighbors}, Current State = {grid[r][c]}, New State = {new_grid[r][c]}")
            
            if grid[r][c]:
                if live_neighbors in (2, 3):
                    new_grid[r][c] = True
            else:
                if live_neighbors == 3:
                    new_grid[r][c] = True

    return new_grid
def neighbors(grid, r, c, diagonal=False):
    rows = len(grid)
    cols = len(grid[0])
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    if diagonal:
        directions.extend([(-1, -1), (-1, 1), (1, -1), (1, 1)])
    return [(r + dr, c + dc) for dr, dc in directions if 0 <= r + dr < rows and 0 <= c + dc < cols]
def count_regions(grid):
    def dfs(r, c, visited):
        stack = [(r, c)]
        while stack:
            nr, nc = stack.pop()
            if 0 <= nr < len(grid) and 0 <= nc < len(grid[0]) and grid[nr][nc] and (nr, nc) not in visited:
                visited.add((nr, nc))
                for dr, dc in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    stack.append((nr + dr, nc + dc))
    
    visited = set()
    region_count = 0
    for r in range(len(grid)):
        for c in range(len(grid[0])):
            if grid[r][c] and (r, c) not in visited:
                dfs(r, c, visited)
                region_count += 1
    return region_count
def is_still(grid):
    new_grid = life_step(grid)
    return new_grid == grid
def life_run(grid, n):
    for _ in range(n):
        grid = life_step(grid)
    return grid
def to_text(grid):
    return '\n'.join(''.join('.' if cell else '#' for cell in row) for row in grid)
