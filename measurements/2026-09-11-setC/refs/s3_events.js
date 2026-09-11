// Reference solution (final state of chain 3) - used only to prove checks-C.mjs can pass.
class EventBus {
  constructor() { this.map = new Map(); }
  _list(event) { if (!this.map.has(event)) this.map.set(event, []); return this.map.get(event); }
  on(event, fn) { this._list(event).push({ fn, once: false }); return this; }
  once(event, fn) { this._list(event).push({ fn, once: true }); return this; }
  off(event, fn) { const l = this.map.get(event); if (!l) return this; const i = l.findIndex((x) => x.fn === fn); if (i >= 0) l.splice(i, 1); return this; }
  emit(event, ...args) {
    const l = (this.map.get(event) || []).slice();
    let first = null;
    for (const x of l) {
      if (x.once) { const live = this.map.get(event); const i = live.indexOf(x); if (i >= 0) live.splice(i, 1); }
      try { x.fn(...args); } catch (e) { if (!first) first = e; }
    }
    if (first) throw first;
    return l.length;
  }
  listenerCount(event) { return (this.map.get(event) || []).length; }
}
module.exports = { EventBus };
