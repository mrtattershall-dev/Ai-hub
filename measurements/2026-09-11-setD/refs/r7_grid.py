# Reference solution (final state of chain r7) - used only to prove checks-D.mjs can pass.
import heapq
from collections import deque

DIRS4 = [(-1, 0), (1, 0), (0, -1), (0, 1)]
DIAG = [(-1, -1), (-1, 1), (1, -1), (1, 1)]


def _lines(text):
    lines = text.splitlines()
    if not lines or any(len(l) != len(lines[0]) for l in lines):
        raise ValueError("all lines must have the same length")
    return lines


def parse_grid(text):
    grid = []
    for l in _lines(text):
        if any(ch not in ".#" for ch in l):
            raise ValueError("only '.' and '#' are allowed")
        grid.append([ch == "." for ch in l])
    return grid


def _inside(grid, r, c):
    return 0 <= r < len(grid) and 0 <= c < len(grid[0])


def _open(grid, r, c):
    return _inside(grid, r, c) and bool(grid[r][c])


def neighbors(grid, r, c, diagonal=False):
    out = [(r + dr, c + dc) for dr, dc in DIRS4 if _open(grid, r + dr, c + dc)]
    if diagonal:
        for dr, dc in DIAG:
            if _open(grid, r + dr, c + dc) and (_open(grid, r + dr, c) or _open(grid, r, c + dc)):
                out.append((r + dr, c + dc))
    return out


def _check(grid, cell):
    if not _open(grid, cell[0], cell[1]):
        raise ValueError(f"{cell} is outside the grid or a wall")


def _walk(prev, cur):
    path = []
    while cur is not None:
        path.append(cur)
        cur = prev[cur]
    return path[::-1]


def shortest_path(grid, start, goal, diagonal=False):
    start, goal = tuple(start), tuple(goal)
    _check(grid, start)
    _check(grid, goal)
    prev = {start: None}
    q = deque([start])
    while q:
        cur = q.popleft()
        if cur == goal:
            return _walk(prev, cur)
        for n in neighbors(grid, *cur, diagonal=diagonal):
            if n not in prev:
                prev[n] = cur
                q.append(n)
    return None


def render(grid, path=None):
    on = set(map(tuple, path or []))
    return "\n".join("".join("*" if (r, c) in on else ("." if v else "#") for c, v in enumerate(row)) for r, row in enumerate(grid))


def parse_costs(text):
    out = []
    for l in _lines(text):
        row = []
        for ch in l:
            if ch == "#":
                row.append(0)
            elif ch == ".":
                row.append(1)
            elif ch in "123456789":
                row.append(int(ch))
            else:
                raise ValueError(f"bad cell {ch!r}")
        out.append(row)
    return out


def cheapest_path(costs, start, goal):
    start, goal = tuple(start), tuple(goal)
    _check(costs, start)
    _check(costs, goal)
    dist, prev, heap = {start: 0}, {start: None}, [(0, start)]
    while heap:
        d, cur = heapq.heappop(heap)
        if cur == goal:
            return d, _walk(prev, cur)
        if d > dist[cur]:
            continue
        for n in neighbors(costs, *cur):
            nd = d + costs[n[0]][n[1]]
            if nd < dist.get(n, float("inf")):
                dist[n], prev[n] = nd, cur
                heapq.heappush(heap, (nd, n))
    return None


def reachable(grid, start):
    start = tuple(start)
    seen, q = {start}, deque([start])
    while q:
        for n in neighbors(grid, *q.popleft()):
            if n not in seen:
                seen.add(n)
                q.append(n)
    return seen


def count_regions(grid):
    seen, count = set(), 0
    for r, row in enumerate(grid):
        for c, v in enumerate(row):
            if v and (r, c) not in seen:
                count += 1
                seen |= reachable(grid, (r, c))
    return count


def life_step(grid):
    out = []
    for r in range(len(grid)):
        new = []
        for c in range(len(grid[0])):
            n = sum(1 for dr in (-1, 0, 1) for dc in (-1, 0, 1) if (dr or dc) and _inside(grid, r + dr, c + dc) and grid[r + dr][c + dc])
            new.append(n == 3 or (bool(grid[r][c]) and n == 2))
        out.append(new)
    return out


def life_run(grid, n):
    for _ in range(n):
        grid = life_step(grid)
    return grid


def is_still(grid):
    return life_step(grid) == [[bool(v) for v in row] for row in grid]


def to_text(grid):
    return "\n".join("".join("." if v else "#" for v in row) for row in grid)
