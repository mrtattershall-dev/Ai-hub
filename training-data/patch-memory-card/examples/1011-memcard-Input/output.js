export class Input {
  constructor(bindings = CONFIG.bindings) {
    this.bindings = bindings;
    this._down = new Set();      // currently-held key codes
    this._pressed = new Set();   // codes that went down this frame
    this._released = new Set();  // codes that went up this frame
    this._padDown = new Set();   // gamepad action names held last poll
    this._padPressed = new Set();
    this._axis = { x: 0, y: 0 }; // analog stick (-1..1)
    this.lastDevice = "keyboard";
    this._attach();
  }

  _attach() {
    addEventListener("keydown", (e) => {
      // Ignore auto-repeat for edge detection; allow held for `down`.
      if (this._isBound(e.code)) e.preventDefault();
      if (!e.repeat) this._pressed.add(e.code);
      this._down.add(e.code);
      this.lastDevice = "keyboard";
    });
    addEventListener("keyup", (e) => {
      this._down.delete(e.code);
      this._released.add(e.code);
    });
    // Releasing focus should not leave keys "stuck" down.
    addEventListener("blur", () => this._down.clear());
  }

  _isBound(code) {
    for (const codes of Object.values(this.bindings)) {
      if (codes.includes(code)) return true;
    }
    return false;
  }

  /** Poll connected gamepads. Call once per frame before reading actions. */
  poll() {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = [...pads].find((p) => p && p.connected);
    const nowDown = new Set();
    this._padPressed.clear();
    if (pad) {
      pad.buttons.forEach((b, i) => {
        if (b.pressed && PAD_BUTTONS[i]) nowDown.add(PAD_BUTTONS[i]);
      });
      // Left stick + d-pad combine into an analog axis.
      const ax = Math.abs(pad.axes[0]) > 0.18 ? pad.axes[0] : 0;
      const ay = Math.abs(pad.axes[1]) > 0.18 ? pad.axes[1] : 0;
      this._axis.x = ax || (nowDown.has("right") ? 1 : nowDown.has("left") ? -1 : 0);
      this._axis.y = ay || (nowDown.has("down") ? 1 : nowDown.has("up") ? -1 : 0);
      if (nowDown.size || Math.abs(ax) + Math.abs(ay) > 0) this.lastDevice = "gamepad";
    } else {
      this._axis.x = 0;
      this._axis.y = 0;
    }
    // edge detection for pad
    for (const a of nowDown) if (!this._padDown.has(a)) this._padPressed.add(a);
    this._padDown = nowDown;
  }

  /** Is the action currently held? */
  down(action) {
    const codes = this.bindings[action];
    if (codes) for (const c of codes) if (this._down.has(c)) return true;
    if (this._padDown.has(action)) return true;
    if (PAD_CONFIRM.has(action) && this._padDown.has("confirm")) return true;
    return false;
  }

  /** Did the action transition from up->down this frame? (one-shot) */
  pressed(action) {
    const codes = this.bindings[action];
    if (codes) for (const c of codes) if (this._pressed.has(c)) return true;
    if (this._padPressed.has(action)) return true;
    if (action === "confirm" && [...PAD_CONFIRM].some((a) => this._padPressed.has(a))) return true;
    if (action === "cancel" && [...PAD_CANCEL].some((a) => this._padPressed.has(a))) return true;
    return false;
  }

  released(action) {
    const codes = this.bindings[action];
    if (codes) for (const c of codes) if (this._released.has(c)) return true;
    return false;
  }

  /** Horizontal intent in [-1, 1] (keyboard is digital, pad is analog). */
  axisX() {
    if (this._axis.x) return this._axis.x;
    return (this.down("right") ? 1 : 0) - (this.down("left") ? 1 : 0);
  }

  axisY() {
    if (this._axis.y) return this._axis.y;
    return (this.down("down") ? 1 : 0) - (this.down("up") ? 1 : 0);
  }

  /** Rebind an action to a single new key code (used by Options). */
  rebind(action, code) {
    this.bindings[action] = [code];
  }

  /** Clear per-frame edge sets. Call at the very end of each frame. */
  endFrame() {
    this._pressed.clear();
    this._released.clear();
  }
}