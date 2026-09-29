/**
 * events.js — a minimal synchronous publish/subscribe bus.
 *
 * Systems communicate through named events rather than reaching into each
 * other directly. Example: the player emits "enemy:killed" and both the rank
 * tracker and the audio engine react, without the player knowing either exists.
 * This keeps the dependency graph shallow — important for readability and for
 * adding new reactions later without editing the emitter.
 *
 * @module engine/events
 */

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event. Returns an unsubscribe function for convenient
   * cleanup (e.g. when a scene exits).
   * @returns {() => void}
   */
  on(type, handler) {
    let set = this._listeners.get(type);
    if (!set) this._listeners.set(type, (set = new Set()));
    set.add(handler);
    return () => this.off(type, handler);
  }

  /** Subscribe once; auto-removes after the first emit. */
  once(type, handler) {
    const off = this.on(type, (payload) => {
      off();
      handler(payload);
    });
    return off;
  }

  off(type, handler) {
    this._listeners.get(type)?.delete(handler);
  }

  /** Fire an event. Handler exceptions are isolated so one bad listener
   *  cannot break the rest of the frame. */
  emit(type, payload) {
    const set = this._listeners.get(type);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] handler for "${type}" threw:`, err);
      }
    }
  }

  /** Remove every listener (used on hard resets). */
  clear() {
    this._listeners.clear();
  }
}
