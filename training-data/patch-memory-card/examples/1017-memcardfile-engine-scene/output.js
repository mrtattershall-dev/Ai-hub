/**
 * scene.js — scene base class + a stack-based scene manager.
 *
 * The game is a stack of scenes. Pushing the Pause scene over the Level scene
 * lets us draw the paused world underneath the menu (Pause sets
 * `transparent = true`). Only the top scene receives `update`, but every scene
 * from the topmost opaque one upward is rendered. This is the classic
 * console-menu pattern and keeps transitions trivial.
 *
 * @module engine/scene
 */

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

export class SceneManager {
  constructor(app) {
    this.app = app;
    /** @type {Scene[]} */
    this.stack = [];
  }

  get current() {
    return this.stack[this.stack.length - 1] ?? null;
  }

  /** Replace the entire stack with a single scene (hard navigation). */
  replace(scene, params) {
    while (this.stack.length) this.stack.pop().onExit();
    this.push(scene, params);
  }

  /** Push a scene on top (the previous one is paused but kept). */
  push(scene, params) {
    this.stack.push(scene);
    scene.onEnter(params);
  }

  /** Pop the top scene, returning to the one beneath. */
  pop() {
    const scene = this.stack.pop();
    scene?.onExit();
    return scene;
  }

  update(dt) {
    this.current?.update(dt);
  }

  render(ctx, alpha) {
    // Find the lowest scene we must draw: everything above the topmost opaque.
    let start = this.stack.length - 1;
    while (start > 0 && this.stack[start].transparent) start--;
    for (let i = start; i < this.stack.length; i++) {
      this.stack[i].render(ctx, alpha);
    }
  }
}
