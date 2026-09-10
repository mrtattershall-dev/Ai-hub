/**
 * Casual match-3: a Board grid with match detection (runs of 3+), clearing, gravity, and
 * refill from an injected deterministic RNG, plus a Score that reacts to cleared tiles. The
 * board reports how many tiles it cleared; scoring lives in its own system and the RNG is
 * passed in so the board stays testable.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

function mulberry32(seed) {                                     // small deterministic PRNG
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Board {
  constructor(grid, rng, colors) {
    this.grid = grid; this.rng = rng; this.colors = colors;
    this.rows = grid.length; this.cols = grid[0].length;
  }
  findMatches() {
    const marks = new Set();
    const mark = (r, c) => marks.add(r + ',' + c);
    for (let r = 0; r < this.rows; r++)
      for (let c = 0; c < this.cols - 2; c++) {
        const v = this.grid[r][c];
        if (v != null && v === this.grid[r][c + 1] && v === this.grid[r][c + 2]) { mark(r, c); mark(r, c + 1); mark(r, c + 2); }
      }
    for (let c = 0; c < this.cols; c++)
      for (let r = 0; r < this.rows - 2; r++) {
        const v = this.grid[r][c];
        if (v != null && v === this.grid[r + 1][c] && v === this.grid[r + 2][c]) { mark(r, c); mark(r + 1, c); mark(r + 2, c); }
      }
    return marks;
  }
  clear(marks) {
    for (const k of marks) { const parts = k.split(','); this.grid[+parts[0]][+parts[1]] = null; }
    return marks.size;
  }
  collapse() {                                                 // gravity + refill per column
    for (let c = 0; c < this.cols; c++) {
      let write = this.rows - 1;
      for (let r = this.rows - 1; r >= 0; r--)
        if (this.grid[r][c] != null) { this.grid[write][c] = this.grid[r][c]; if (write !== r) this.grid[r][c] = null; write -= 1; }
      for (let r = write; r >= 0; r--) this.grid[r][c] = this.colors[Math.floor(this.rng() * this.colors.length)];
    }
  }
}

class Score {
  constructor() { this.value = 0; }
  cleared(n) { this.value += n * 10; return this.value; }
}

// --- self-checking demo ---
const grid = [
  ['r', 'g', 'b'],
  ['r', 'g', 'y'],
  ['r', 'y', 'b'],                                             // column 0 is r,r,r -> a match
];
const board = new Board(grid, mulberry32(42), ['r', 'g', 'b', 'y']);
const score = new Score();

const matches = board.findMatches();
assert(matches.size === 3, 'three tiles match down column 0');
score.cleared(board.clear(matches));
assert(score.value === 30, 'score is three cleared tiles x10');
board.collapse();
let full = true;
for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (board.grid[r][c] == null) full = false;
assert(full, 'gravity and refill leave no empty cells');
console.log('casual/match3-board OK');
