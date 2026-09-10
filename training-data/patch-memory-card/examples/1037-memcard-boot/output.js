async function boot() {
  const app = createApp();

  // Optional debug overlay element.
  const dbg = document.createElement("div");
  dbg.className = "debug-overlay";
  document.getElementById("stage").appendChild(dbg);

  // --- Audio/start gate ---------------------------------------------------
  const gate = document.getElementById("gate");
  const startGame = async () => {
    if (app._started) return;
    app._started = true;
    app.audio.init();
    gate.classList.add("hide");
    setTimeout(() => gate.remove(), 600);

    try {
      app.data = await loadData();
    } catch (err) {
      console.error(err);
      drawFatal(app, "Could not load game data.\nRun via run.bat / serve.py (not file://).");
      return;
    }
    // Consume the Enter/Space that opened the gate so it doesn't leak into the
    // first frame of the boot scene.
    app.input.endFrame();
    app.scenes.replace(new BootScene(app));
    startLoop(app, dbg);
  };

  gate.addEventListener("click", startGame);
  addEventListener("keydown", (e) => {
    if (["Enter", "Space"].includes(e.code)) startGame();
  });
}