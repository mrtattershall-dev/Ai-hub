function startLoop(app, dbg) {
  const loop = new GameLoop(
    (dt) => {
      app.input.poll();

      // Combat hitstop freezes gameplay for a few frames on impact.
      if (!Hitstop.consume(dt)) {
        app.scenes.update(dt);
      }
      if (app.progression.data) app.progression.addPlayTime(dt);

      // Debug toggle.
      if (app.input.pressed("debug")) {
        app.debug = !app.debug;
        dbg.classList.toggle("on", app.debug);
        document.getElementById("overlay-fx").classList.toggle("on", app.debug && false);
      }
      app.input.endFrame();
    },
    (alpha) => {
      const { ctx } = app;
      ctx.clearRect(0, 0, app.width, app.height);
      app.scenes.render(ctx, alpha);
      if (app.debug) {
        app.fps = loop.fps;
        dbg.textContent =
          `fps ${loop.fps}\nscene ${app.scenes.current?.constructor.name}\n` +
          `device ${app.input.lastDevice}`;
      }
    }
  );
  app.loop = loop;
  loop.start();
}