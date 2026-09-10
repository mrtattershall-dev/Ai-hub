export class BootScene extends Scene {
  onEnter() {
    this.t = 0;
    this.tips = [
      "TIP: Chain light attacks, then finish with heavy to launch foes.",
      "TIP: Dodge through attacks for invincibility frames.",
      "TIP: Hidden emblems unlock cheats and gallery art.",
    ];
    this.tip = this.tips[(Math.random() * this.tips.length) | 0];
  }

  update(dt) {
    this.t += dt;
    if (this.app.input.pressed("confirm") || this.t >= DURATION) {
      this.app.audio.sfx("confirm");
      this.app.scenes.replace(new TitleScene(this.app));
    }
  }

  render(ctx) {
    const W = CONFIG.view.width;
    const H = CONFIG.view.height;
    ctx.fillStyle = "#05060b";
    ctx.fillRect(0, 0, W, H);

    const p = Math.min(1, this.t / (DURATION - 0.4));
    title(ctx, "MNEMONIC VAULT", W / 2, H / 2 - 40, { size: 40, glow: "#4fd1ff" });
    text(ctx, "RESTORING ARCHIVE", W / 2, H / 2 + 6, {
      size: 14, align: "center", color: "#8b95b8",
    });
    bar(ctx, W / 2 - 180, H / 2 + 24, 360, 12, p, "#4fd1ff");
    text(ctx, `${Math.round(p * 100)}%`, W / 2, H / 2 + 58, {
      size: 12, align: "center", color: "#4fd1ff",
    });
    text(ctx, this.tip, W / 2, H - 50, { size: 13, align: "center", color: "#566089" });
  }
}