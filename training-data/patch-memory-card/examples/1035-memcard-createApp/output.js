function createApp() {
  const canvas = document.getElementById("screen");
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  const app = {
    canvas,
    ctx,
    width: CONFIG.view.width,
    height: CONFIG.view.height,
    bus: new EventBus(),
    input: new Input(),
    audio: new AudioEngine(),
    save: new SaveSystem(),
    /** @type {any} */ data: null,        // loaded JSON tables
    /** @type {Progression} */ progression: null,
    /** @type {SceneManager} */ scenes: null,
    debug: false,
    fps: 0,
  };
  app.progression = new Progression(app);
  app.scenes = new SceneManager(app);
  return app;
}