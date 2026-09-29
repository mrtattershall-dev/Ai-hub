def parse_grid(text):
    """Parse a grid from text where '.' means open and '#' means wall.
    
    Args:
        text (str): Grid text with lines separated by newlines
        
    Returns:
        list[list[bool]]: Grid as list of rows of booleans (True = open)
        
    Raises:
        ValueError: If lines have different lengths or contain invalid characters
    """
    lines = text.strip().split('\n')
    if not lines or lines == ['']:
        return []
    
    # Check all lines have same length
    line_length = len(lines[0])
    for i, line in enumerate(lines):
        if len(line) != line_length:
            raise ValueError(f"Line {i} has length {len(line)}, expected {line_length}")
        
        # Check all characters are valid
        for j, char in enumerate(line):
            if char not in '.#':
                raise ValueError(f"Invalid character '{char}' at position ({i}, {j})")
    
    # Convert to list of lists of booleans
    grid = []
    for line in lines:
        row = []
        for char in line:
            row.append(char == '.')  # '.' is open (True), '#' is wall (False)
        grid.append(row)
    
    return grid


def shortest_path(grid, start, goal, diagonal=False):
    """Find the shortest path from start to goal in a grid.
    
    Args:
        grid (list[list[bool]]): Grid where True means open and False means wall
        start (tuple[int, int]): Starting position (row, col)
        goal (tuple[int, int]): Goal position (row, col)
        diagonal (bool): If True, allow diagonal moves (default: False)
        
    Returns:
        list[tuple[int, int]] or None: Shortest path as list of (row, col) cells, or None if no path exists
        
    Raises:
        ValueError: If start or goal is outside the grid or is a wall
    """
    if not grid or not grid[0]:
        raise ValueError("Grid is empty")
    
    rows = len(grid)
    cols = len(grid[0])
    
    # Check if start is valid
    start_row, start_col = start
    if start_row < 0 or start_row >= rows or start_col < 0 or start_col >= cols:
        raise ValueError("Start position is outside the grid")
    if not grid[start_row][start_col]:
        raise ValueError("Start position is a wall")
    
    # Check if goal is valid
    goal_row, goal_col = goal
    if goal_row < 0 or goal_row >= rows or goal_col < 0 or goal_col >= cols:
        raise ValueError("Goal position is outside the grid")
    if not grid[goal_row][goal_col]:
        raise ValueError("Goal position is a wall")
    
    # BFS to find shortest path
    from collections import deque
    
    # Queue stores (row, col, path)
    queue = deque([(start_row, start_col, [start])])
    visited = set([start])
    
    # Directions: up, down, left, right
    directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]
    
    # If diagonal moves are allowed, add diagonal directions
    if diagonal:
        # For diagonal moves, we need to check that at least one of the two cells beside 
        # that diagonal is open (to prevent "corner cutting")
        diagonal_directions = [(-1, -1), (-1, 1), (1, -1), (1, 1)]
        # Combine with orthogonal directions
        directions.extend(diagonal_directions)
    
    while queue:
        row, col, path = queue.popleft()
        
        # If we reached the goal, return the path
        if (row, col) == goal:
            return path
        
        # Explore neighbors
        for dr, dc in directions:
            new_row, new_col = row + dr, col + dc
            
            # Check if the new position is valid
            if (0 <= new_row < rows and 
                0 <= new_col < cols and 
                grid[new_row][new_col] and 
                (new_row, new_col) not in visited):
                
                # If diagonal move, check that at least one of the two adjacent cells is open
                if diagonal and (abs(dr) == 1 and abs(dc) == 1):
                    # Diagonal move: check if at least one of the two adjacent cells is open
                    # For diagonal move (dr, dc), the adjacent cells are (dr, 0) and (0, dc)
                    adj1_row, adj1_col = row + dr, col  # Same row, different col
                    adj2_row, adj2_col = row, col + dc  # Same col, different row
                    
                    # Check if at least one adjacent cell is open
                    if not (grid[adj1_row][adj1_col] and grid[adj2_row][adj2_col]):
                        continue  # Skip this diagonal move
                
                visited.add((new_row, new_col))
                new_path = path + [(new_row, new_col)]
                queue.append((new_row, new_col, new_path))
    
    # No path found
    return None
def render(grid, path=None):
    """Render a grid as text with '#' for walls, '.' for open cells, and '*' for path cells.
    
    Args:
        grid (list[list[bool]]): Grid where True means open and False means wall
        path (list[tuple[int, int]] or None): Optional path to highlight with '*'
        
    Returns:
        str: Grid rendered as text with lines separated by newlines
    """
    if not grid:
        return ""
    
    # Create a copy of the grid to avoid modifying the original
    rendered_grid = []
    for row in grid:
        rendered_grid.append(row[:])  # Shallow copy of each row
    
    # Mark path cells if provided
    if path:
        for row, col in path:
            if 0 <= row < len(grid) and 0 <= col < len(grid[0]):
                rendered_grid[row][col] = '*'  # Mark path cells
    
    # Convert to text representation
    lines = []
    for row in rendered_grid:
        line = ""
        for cell in row:
            if cell is True:  # Open cell
                line += '.'
            elif cell is False:  # Wall
                line += '#'
            elif cell == '*':  # Path cell
                line += '*'
        lines.append(line)
    
    return '\n'.join(lines)
