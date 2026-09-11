// Reference solution (final state of chain q7) - used only to prove checks-E.mjs can pass.
class TextBuffer {
  constructor(text = '', opts = {}) {
    this.t = String(text); this.undoS = []; this.redoS = []; this.group = null;
    this.maxUndo = opts && opts.maxUndo ? opts.maxUndo : Infinity;
  }
  text() { return this.t; }
  _apply(op, forward) {
    const [out, into] = forward ? [op.del, op.ins] : [op.ins, op.del];
    this.t = this.t.slice(0, op.pos) + into + this.t.slice(op.pos + out.length);
  }
  _record(ops) {
    if (this.group) { this.group.push(...ops); return; }
    this.undoS.push(ops);
    while (this.undoS.length > this.maxUndo) this.undoS.shift();
    this.redoS = [];
  }
  _edit(pos, delLen, ins) { const op = { pos, del: this.t.slice(pos, pos + delLen), ins }; this._apply(op, true); this._record([op]); }
  insert(pos, str) {
    if (!Number.isInteger(pos) || pos < 0 || pos > this.t.length) throw new Error('position out of range: ' + pos);
    this._edit(pos, 0, String(str));
  }
  remove(pos, length) {
    if (!Number.isInteger(pos) || !Number.isInteger(length) || pos < 0 || length < 0 || pos + length > this.t.length) throw new Error('range out of bounds');
    this._edit(pos, length, '');
  }
  undo() { const ops = this.undoS.pop(); if (!ops) return false; for (const op of [...ops].reverse()) this._apply(op, false); this.redoS.push(ops); return true; }
  redo() { const ops = this.redoS.pop(); if (!ops) return false; for (const op of ops) this._apply(op, true); this.undoS.push(ops); return true; }
  lines() { return this.t.split('\n'); }
  lineCol(pos) {
    if (!Number.isInteger(pos) || pos < 0 || pos > this.t.length) throw new Error('position out of range: ' + pos);
    const before = this.t.slice(0, pos).split('\n');
    return { line: before.length - 1, col: before[before.length - 1].length };
  }
  posOf(line, col) {
    const ls = this.lines();
    if (!Number.isInteger(line) || !Number.isInteger(col) || line < 0 || line >= ls.length || col < 0 || col > ls[line].length) throw new Error('out of range');
    let p = 0; for (let i = 0; i < line; i++) p += ls[i].length + 1;
    return p + col;
  }
  find(str, from = 0) { return this.t.indexOf(str, from); }
  findAll(str) { const out = []; if (!str) return out; let i = this.t.indexOf(str); while (i >= 0) { out.push(i); i = this.t.indexOf(str, i + str.length); } return out; }
  replaceAll(search, replacement) {
    const at = this.findAll(search); if (!at.length) return 0;
    this.beginGroup(); for (const p of [...at].reverse()) this._edit(p, search.length, String(replacement)); this.endGroup();
    return at.length;
  }
  beginGroup() { if (!this.group) this.group = []; }
  endGroup() { const g = this.group; this.group = null; if (g && g.length) this._record(g); }
  wordAt(pos) {
    const isW = (c) => c !== undefined && /[A-Za-z0-9_]/.test(c);
    let s, e;
    if (isW(this.t[pos])) { s = pos; e = pos; } else if (isW(this.t[pos - 1])) { s = pos - 1; e = pos - 1; } else return '';
    while (s > 0 && isW(this.t[s - 1])) s--;
    while (e < this.t.length - 1 && isW(this.t[e + 1])) e++;
    return this.t.slice(s, e + 1);
  }
  toJSON() { return { text: this.t, undo: this.undoS, redo: this.redoS, maxUndo: Number.isFinite(this.maxUndo) ? this.maxUndo : null }; }
  static fromJSON(data) {
    const b = new TextBuffer(data.text, data.maxUndo ? { maxUndo: data.maxUndo } : {});
    b.undoS = (data.undo || []).map((ops) => ops.map((o) => ({ ...o })));
    b.redoS = (data.redo || []).map((ops) => ops.map((o) => ({ ...o })));
    return b;
  }
  stats() { return { chars: this.t.length, words: (this.t.match(/[A-Za-z0-9_]+/g) || []).length, lines: this.t === '' ? 0 : this.lines().length }; }
}
module.exports = { TextBuffer };
