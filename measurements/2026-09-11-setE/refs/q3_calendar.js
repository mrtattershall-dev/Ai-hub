// Reference solution (final state of chain q3) - used only to prove checks-E.mjs can pass.
function formatTime(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1440) throw new Error('bad minutes ' + minutes);
  return String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
}
function parseTime(text) {
  const m = /^(\d\d):(\d\d)$/.exec(String(text));
  if (!m || +m[1] > 23 || +m[2] > 59) throw new Error('bad time ' + text);
  return +m[1] * 60 + +m[2];
}
class Calendar {
  constructor() { this.m = new Map(); }
  static _check(start, end) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end) throw new Error(`bad range ${start}-${end}`);
  }
  add(id, start, end) {
    Calendar._check(start, end);
    if (this.m.has(id)) throw new Error('duplicate id ' + id);
    if (this.conflicts(start, end).length) throw new Error('overlaps ' + this.conflicts(start, end).join(', '));
    this.m.set(id, { id, start, end });
  }
  get(id) { const x = this.m.get(id); return x ? { ...x } : null; }
  list() { return [...this.m.values()].sort((a, b) => a.start - b.start || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((x) => ({ ...x })); }
  conflicts(start, end, except) { return this.list().filter((x) => x.id !== except && x.start < end && start < x.end).map((x) => x.id); }
  remove(id) { return this.m.delete(id); }
  move(id, newStart) {
    const x = this.m.get(id); if (!x) throw new Error('unknown id ' + id);
    const end = newStart + (x.end - x.start);
    Calendar._check(newStart, end);
    if (this.conflicts(newStart, end, id).length) throw new Error('overlaps');
    x.start = newStart; x.end = end;
  }
  freeSlots(dayStart, dayEnd, minLength) {
    const gaps = []; let t = dayStart;
    for (const x of this.list()) {
      if (x.end <= dayStart || x.start >= dayEnd) continue;
      if (x.start > t) gaps.push([t, x.start]);
      t = Math.max(t, x.end);
    }
    if (dayEnd > t) gaps.push([t, dayEnd]);
    return gaps.filter(([a, b]) => b - a >= minLength);
  }
  firstFree(duration, after = 0) { const g = this.freeSlots(after, 1440, duration); return g.length ? g[0][0] : null; }
  toText() { return this.list().map((x) => `${formatTime(x.start)}-${formatTime(x.end)} ${x.id}`).join('\n'); }
  static fromText(text) {
    const c = new Calendar(); if (!text) return c;
    for (const line of String(text).split('\n')) {
      const m = /^(\d\d:\d\d)-(\d\d:\d\d) (.+)$/.exec(line); if (!m) throw new Error('malformed line: ' + line);
      c.add(m[3], parseTime(m[1]), parseTime(m[2]));
    }
    return c;
  }
}
module.exports = { Calendar, formatTime, parseTime };
