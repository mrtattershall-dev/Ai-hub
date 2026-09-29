export const Hitstop = {
  _remaining: 0,
  add(seconds) {
    this._remaining = Math.max(this._remaining, seconds);
  },
  get active() {
    return this._remaining > 0;
  },
  consume(dt) {
    if (this._remaining <= 0) return false;
    this._remaining -= dt;
    return true;
  },
  clear() {
    this._remaining = 0;
  },
};