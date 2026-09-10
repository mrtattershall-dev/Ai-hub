/**
 * Simulation time: a Clock that accumulates minutes into hours and days, a DayNight phase
 * derived from the hour, and a Scheduler that fires one-shot events at target times. The
 * clock advances; the phase and scheduler read it without modifying it.
 */
function assert(cond, msg) { if (!cond) throw new Error('FAIL: ' + msg); }

class Clock {
  constructor() { this.minute = 0; this.hour = 0; this.day = 0; }
  advance(minutes) {
    this.minute += minutes;
    while (this.minute >= 60) { this.minute -= 60; this.hour += 1; }
    while (this.hour >= 24) { this.hour -= 24; this.day += 1; }
  }
  totalMinutes() { return (this.day * 24 + this.hour) * 60 + this.minute; }
}

class DayNight {
  phase(hour) {
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  }
}

class Scheduler {
  constructor(clock) { this.clock = clock; this.events = []; }
  at(day, hour, cb) { this.events.push({ when: (day * 24 + hour) * 60, cb, fired: false }); }
  poll() {
    const now = this.clock.totalMinutes();
    let fired = 0;
    for (const e of this.events) if (!e.fired && now >= e.when) { e.fired = true; e.cb(); fired += 1; }
    return fired;
  }
}

// --- self-checking demo ---
const clock = new Clock();
const cycle = new DayNight();
const scheduler = new Scheduler(clock);

let rang = 0;
scheduler.at(0, 8, () => { rang += 1; });                      // an event at 08:00 on day 0

clock.advance(60 * 7);                                         // 07:00
assert(clock.hour === 7 && cycle.phase(clock.hour) === 'morning', 'it is morning at 7am');
assert(scheduler.poll() === 0, 'the event is not due yet');
clock.advance(120);                                           // 09:00
assert(scheduler.poll() === 1 && rang === 1, 'the event fires once past 08:00');
assert(scheduler.poll() === 0, 'the one-shot event does not fire again');
clock.advance(60 * 20);                                       // +20h -> rolls into the next day
assert(clock.day === 1, 'the day advances after 24 hours');
console.log('simulation/time-cycle OK');
