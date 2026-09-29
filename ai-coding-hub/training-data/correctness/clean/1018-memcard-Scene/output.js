export class Scene {
  /** @param {import('../main.js').App} app shared game context */
  constructor(app) {
    this.app = app;
    /** When true, the scene below is also rendered (overlay menus). */
    this.transparent = false;
  }

  /** Called when the scene becomes active. `params` come from push/replace. */
  onEnter(_params) {}
  /** Called right before the scene is removed. Use to unsubscribe events. */
  onExit() {}
  /** Fixed-timestep update. Only the top scene receives this. */
  update(_dt) {}
  /** Per-frame draw. `alpha` is the interpolation factor (0..1) for smoothing. */
  render(_ctx, _alpha) {}
}