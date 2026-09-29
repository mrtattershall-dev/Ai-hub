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