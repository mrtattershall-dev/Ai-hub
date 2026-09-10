/**
 * Casual power-ups: a Timer that advances and fires one-shot alarms, and a PowerUpSystem
 * that activates timed effects and removes them when their alarm elapses. Effects schedule
 * themselves on the timer; the timer knows nothing about what an effect does.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class Timer {
  constructor() { this.now = 0; this.alarms = []; }
  at(delay, cb) { this.alarms.push({ time: this.now + delay, cb, done: false }); }
  advance(dt) {
    this.now += dt;
    for (const a of this.alarms) if (!a.done && this.now >= a.time) { a.done = true; a.cb(); }
    this.alarms = this.alarms.filter(a => !a.done);
  }
}

class PowerUpSystem {
  constructor(timer) { this.timer = timer; this.active = new Set(); }
  activate(name, duration) {
    this.active.add(name);
    this.timer.at(duration, () => this.active.delete(name));
  }
  has(name) { return this.active.has(name); }
}

// --- self-checking demo ---
const timer = new Timer();
const power = new PowerUpSystem(timer);

power.activate('shield', 300);
assert(power.has('shield'), 'the power-up is active immediately');
timer.advance(200);
assert(power.has('shield'), 'it is still active before its duration elapses');
timer.advance(150);                                            // total 350 > 300
assert(!power.has('shield'), 'it expires once the duration passes');
assert(timer.alarms.length === 0, 'the elapsed alarm is cleaned up');
console.log('casual/powerup-timer OK');
