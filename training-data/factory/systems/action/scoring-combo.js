/**
 * Action scoring: a ComboMeter that grows while hits land inside a timing window and resets
 * when the window lapses, and a Score that awards points scaled by the meter's multiplier.
 * Score asks the meter for the current factor; the meter never touches the score.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class ComboMeter {
  constructor(windowMs) { this.window = windowMs; this.count = 0; this.last = -Infinity; }
  hit(now) {
    if (now - this.last <= this.window) this.count += 1; else this.count = 1;
    this.last = now;
    return this.count;
  }
  multiplier() { return 1 + Math.floor(this.count / 5); }       // +1x for every 5-combo
}

class Score {
  constructor(meter) { this.meter = meter; this.value = 0; }
  award(base, now) {
    this.meter.hit(now);
    this.value += base * this.meter.multiplier();
    return this.value;
  }
}

// --- self-checking demo ---
const meter = new ComboMeter(1000);
const score = new Score(meter);

score.award(10, 0);                                              // combo 1, x1 -> +10
assert(score.value === 10, 'first hit scores at x1');
for (let t = 200; t <= 800; t += 200) score.award(10, t);       // combos 2..5 inside window
assert(meter.count === 5, 'combo reaches five with rapid hits');
score.award(10, 1000);                                          // combo 6, x2 -> +20
assert(meter.multiplier() === 2, 'multiplier is x2 at a 6-combo');
const before = score.value;
score.award(10, 5000);                                          // window lapsed -> reset
assert(meter.count === 1, 'combo resets after a long gap');
assert(score.value === before + 10, 'the reset hit scores back at x1');
console.log('action/scoring-combo OK');
