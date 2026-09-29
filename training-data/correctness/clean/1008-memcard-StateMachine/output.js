export class StateMachine {
  /**
   * @param {object} owner   the object the states act upon (player/enemy)
   * @param {Record<string, object>} states  map of name -> state definition
   * @param {string} initial starting state name
   */
  constructor(owner, states, initial) {
    this.owner = owner;
    this.states = states;
    this.current = initial;
    /** seconds spent in the current state */
    this.timer = 0;
    this.previous = null;
    states[initial]?.enter?.(owner, this, null);
  }

  /** Transition to `name`. No-op if already there (unless force=true). */
  change(name, force = false) {
    if (!force && name === this.current) return;
    if (!this.states[name]) {
      console.warn(`[FSM] unknown state "${name}"`);
      return;
    }
    const prev = this.current;
    this.states[prev]?.exit?.(this.owner, this, name);
    this.previous = prev;
    this.current = name;
    this.timer = 0;
    this.states[name]?.enter?.(this.owner, this, prev);
  }

  /** Advance the active state. If its update returns a name, transition to it. */
  update(dt) {
    this.timer += dt;
    const next = this.states[this.current]?.update?.(this.owner, dt, this);
    if (next && next !== this.current) this.change(next);
  }

  is(name) {
    return this.current === name;
  }
}