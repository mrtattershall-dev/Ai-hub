// Reference solution (final state of chain r3) - used only to prove checks-D.mjs can pass.
class TaskGraph {
  constructor() { this.tasks = new Map(); }
  add(id, duration) {
    if (this.tasks.has(id)) throw new Error('duplicate task: ' + id);
    if (!(typeof duration === 'number' && Number.isFinite(duration) && duration > 0)) throw new Error('duration must be a positive number');
    this.tasks.set(id, { duration, deps: new Set() });
  }
  has(id) { return this.tasks.has(id); }
  size() { return this.tasks.size; }
  _t(id) { const t = this.tasks.get(id); if (!t) throw new Error('unknown task: ' + id); return t; }
  _reaches(from, target) {
    const seen = new Set(); const stack = [from];
    while (stack.length) { const x = stack.pop(); if (x === target) return true; if (seen.has(x)) continue; seen.add(x); for (const d of this.tasks.get(x).deps) stack.push(d); }
    return false;
  }
  depend(id, onId) {
    const t = this._t(id); this._t(onId);
    if (id === onId) throw new Error('a task cannot depend on itself');
    if (this._reaches(onId, id)) throw new Error('cycle: ' + onId + ' already depends on ' + id);
    t.deps.add(onId);
  }
  order() {
    const ids = [...this.tasks.keys()]; const done = new Set(); const out = [];
    while (out.length < ids.length) {
      const next = ids.find((id) => !done.has(id) && [...this.tasks.get(id).deps].every((d) => done.has(d)));
      if (next === undefined) throw new Error('cycle');
      done.add(next); out.push(next);
    }
    return out;
  }
  _finish() { const f = new Map(); for (const id of this.order()) { const t = this.tasks.get(id); let s = 0; for (const d of t.deps) s = Math.max(s, f.get(d)); f.set(id, s + t.duration); } return f; }
  earliestStart(id) { const t = this._t(id); const f = this._finish(); let s = 0; for (const d of t.deps) s = Math.max(s, f.get(d)); return s; }
  totalTime() { let m = 0; for (const v of this._finish().values()) m = Math.max(m, v); return m; }
  criticalPath() {
    if (!this.tasks.size) return [];
    const f = this._finish(); let end = null;
    for (const [id, v] of f) if (end === null || v > f.get(end)) end = id;
    const path = [end]; let cur = end;
    while (this.tasks.get(cur).deps.size) {
      const start = f.get(cur) - this.tasks.get(cur).duration; let pick = null;
      for (const d of this.tasks.get(cur).deps) if (f.get(d) === start) { pick = d; break; }
      path.unshift(pick); cur = pick;
    }
    return path;
  }
  remove(id) { this._t(id); this.tasks.delete(id); for (const t of this.tasks.values()) t.deps.delete(id); }
  toJSON() { return { tasks: [...this.tasks].map(([id, t]) => ({ id, duration: t.duration, deps: [...t.deps] })) }; }
  static fromJSON(data) {
    const g = new TaskGraph();
    for (const t of data.tasks) g.add(t.id, t.duration);
    for (const t of data.tasks) for (const d of t.deps || []) g.depend(t.id, d);
    return g;
  }
  ready(doneIds) { const done = new Set(doneIds); return [...this.tasks.keys()].filter((id) => !done.has(id) && [...this.tasks.get(id).deps].every((d) => done.has(d))); }
}
module.exports = { TaskGraph };
