/**
 * Casual run state: a Lives counter that ends the run at zero, a Score with a tracked best,
 * and a GameState machine the two feed into. Losing the last life flips the state to
 * game-over; the state machine reads the systems but they never reach into it.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class Lives {
  constructor(n) { this.count = n; }
  lose() { this.count = Math.max(0, this.count - 1); return this.count; }
  get gameOver() { return this.count === 0; }
}

class Score {
  constructor() { this.value = 0; this.best = 0; }
  add(n) { this.value += n; if (this.value > this.best) this.best = this.value; return this.value; }
  reset() { this.value = 0; }
}

class GameState {
  constructor(lives, score) { this.lives = lives; this.score = score; this.phase = 'playing'; }
  update() {
    if (this.lives.gameOver) this.phase = 'gameover';
    return this.phase;
  }
}

// --- self-checking demo ---
const lives = new Lives(3);
const score = new Score();
const state = new GameState(lives, score);

score.add(100);
assert(score.best === 100, 'best score tracks the running total');
lives.lose(); lives.lose();
assert(state.update() === 'playing', 'still playing with one life left');
lives.lose();
assert(state.update() === 'gameover', 'game over once lives reach zero');
score.reset();
assert(score.value === 0 && score.best === 100, 'a reset clears the score but keeps the best');
console.log('casual/lives-score OK');
