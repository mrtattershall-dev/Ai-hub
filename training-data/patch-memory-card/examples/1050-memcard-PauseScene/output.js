export class PauseScene extends Scene {
  constructor(app, params = {}) {
    super(app);
    this.transparent = true;
    this.ctxName = params.context ?? "level";
    this.levelId = params.levelId;
  }

  onEnter() {
    this.index = 0;
    this.app.audio.sfx("cursor");
    this.items = [{ label: "RESUME" }, { label: "AUDIO" }];
    if (this.ctxName === "level") {
      this.items.push({ label: "RESTART STAGE" });
      this.items.push({ label: "QUIT TO HUB" });
    } else {
      this.items.push({ label: "QUIT TO TITLE" });
    }
    this.adjustingAudio = false;
  }

  update() {
    const input = this.app.input;

    if (this.adjustingAudio) {
      const vol = this.app.audio.volumes.master;
      if (input.pressed("left")) this.app.audio.setVolume("master", Math.max(0, vol - 0.1));
      if (input.pressed("right")) this.app.audio.setVolume("master", Math.min(1, vol + 0.1));
      if (input.pressed("confirm") || input.pressed("cancel")) {
        this.adjustingAudio = false;
        this.app.audio.sfx("cursor");
      }
      return;
    }

    if (input.pressed("up")) { this.index = (this.index + this.items.length - 1) % this.items.length; this.app.audio.sfx("cursor"); }
    if (input.pressed("down")) { this.index = (this.index + 1) % this.items.length; this.app.audio.sfx("cursor"); }
    if (input.pressed("pause") || input.pressed("cancel")) { this._resume(); return; }
    if (input.pressed("confirm")) this._select();
  }

  _resume() {
    this.app.audio.sfx("cancel");
    this.app.scenes.pop();
  }

  async _select() {
    const label = this.items[this.index].label;
    this.app.audio.sfx("confirm");
    switch (label) {
      case "RESUME": this._resume(); break;
      case "AUDIO": this.adjustingAudio = true; break;
      case "RESTART STAGE": {
        const { LevelScene } = await import("./level.js");
        this.app.scenes.replace(new LevelScene(this.app, { levelId: this.levelId }));
        break;
      }
      case "QUIT TO HUB": {
        const { HubScene } = await import("./hub.js");
        this.app.scenes.replace(new HubScene(this.app));
        break;
      }
      case "QUIT TO TITLE": {
        this.app.progression.persist();
        const { TitleScene } = await import("./title.js");
        this.app.scenes.replace(new TitleScene(this.app));
        break;
      }
    }
  }

  render(ctx) {
    // Dim the world underneath.
    ctx.fillStyle = "rgba(5,6,11,0.72)";
    ctx.fillRect(0, 0, W, H);

    panel(ctx, W / 2 - 180, H / 2 - 160, 360, 320, { glow: 16 });
    title(ctx, "PAUSED", W / 2, H / 2 - 120, { size: 32 });

    if (this.adjustingAudio) {
      text(ctx, "MASTER VOLUME", W / 2, H / 2 - 30, { size: 18, align: "center" });
      bar(ctx, W / 2 - 120, H / 2, 240, 16, this.app.audio.volumes.master, "#4fd1ff");
      text(ctx, "◀ / ▶ adjust    ENTER done", W / 2, H / 2 + 50, {
        size: 13, align: "center", color: "#8b95b8",
      });
    } else {
      menu(ctx, this.items, this.index, W / 2 - 110, H / 2 - 60, { gap: 46 });
    }
  }
}