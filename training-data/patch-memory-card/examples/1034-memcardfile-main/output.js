/**
 * main.js — application entry point and the shared `App` context.
 *
 * Responsibilities:
 *   1. Build the `App` object every system reads from (canvas, input, audio,
 *      event bus, save + progression, loaded data, scene manager).
 *   2. Satisfy the browser audio gate (Web Audio needs a user gesture), then
 *      load the data tables and hand control to the Boot scene.
 *   3. Run the fixed-timestep loop, honouring combat "hitstop" freezes and
 *      accumulating play time.
 *
 * The App object is passed into every scene and entity, which keeps globals out
 * of the codebase: dependencies are explicit and the whole graph is reachable
 * from this one object — handy when reading the project cold.
 *
 * @module main
 */

import { CONFIG } from "./config.js";
import { EventBus } from "./engine/events.js";
import { Input } from "./engine/input.js";
import { AudioEngine } from "./engine/audio.js";
import { GameLoop } from "./engine/loop.js";
import { SceneManager } from "./engine/scene.js";
import { SaveSystem } from "./systems/save.js";
import { Progression } from "./systems/progression.js";
import { Hitstop } from "./systems/combat.js";
import { BootScene } from "./scenes/boot.js";

/** @typedef {ReturnType<typeof createApp>} App */

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

/** Load every data table in parallel. Paths are relative to index.html. */
async function loadData() {
  const files = ["levels", "enemies", "upgrades", "unlocks", "dialogue", "items"];
  const entries = await Promise.all(
    files.map(async (name) => {
      const res = await fetch(`data/${name}.json`);
      if (!res.ok) throw new Error(`Failed to load data/${name}.json (${res.status})`);
      return [name, await res.json()];
    })
  );
  return Object.fromEntries(entries);
}

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

/** Last-resort error card drawn straight to the canvas. */
function drawFatal(app, message) {
  const { ctx } = app;
  ctx.fillStyle = "#05060b";
  ctx.fillRect(0, 0, app.width, app.height);
  ctx.fillStyle = "#ff5d8f";
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.textAlign = "center";
  message.split("\n").forEach((line, i) => {
    ctx.fillText(line, app.width / 2, app.height / 2 - 20 + i * 30);
  });
}

boot();
