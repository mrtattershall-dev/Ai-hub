/**
 * shop.js — the hub vendor (Cogsworth). Spend Memory Shards on upgrades.
 *
 * Reads upgrade definitions from data/upgrades.json and drives purchases
 * through progression.buyUpgrade, which applies the effect and persists. Items
 * show as owned, locked (prerequisite not met), affordable, or too expensive.
 * Buying immediately affects the player on the next stage (derived stats in
 * progression.js read the purchased flags).
 *
 * @module scenes/shop
 */

import { Scene } from "../engine/scene.js";
import { panel, text, title } from "../ui/widgets.js";
import { CONFIG } from "../config.js";

const W = CONFIG.view.width;
const H = CONFIG.view.height;

export class ShopScene extends Scene {
  onEnter() {
    this.items = this.app.data.upgrades;
    this.index = 0;
    this.flash = null; // {text, color, t}
    this.app.audio.sfx("confirm");
  }

  update(dt) {
    const input = this.app.input;
    if (this.flash) { this.flash.t -= dt; if (this.flash.t <= 0) this.flash = null; }

    if (input.pressed("up")) { this.index = (this.index + this.items.length - 1) % this.items.length; this.app.audio.sfx("cursor"); }
    if (input.pressed("down")) { this.index = (this.index + 1) % this.items.length; this.app.audio.sfx("cursor"); }
    if (input.pressed("cancel")) { this.app.audio.sfx("cancel"); this.app.scenes.pop(); return; }
    if (input.pressed("confirm")) this._buy();
  }

  _status(def) {
    const prog = this.app.progression;
    if (prog.has(def.id)) return "owned";
    if (def.requires && !prog.has(def.requires)) return "locked";
    if (!prog.canAfford(def.cost)) return "poor";
    return "buyable";
  }

  _buy() {
    const def = this.items[this.index];
    const status = this._status(def);
    if (status === "owned") { this._flash("ALREADY OWNED", "#8b95b8"); this.app.audio.sfx("cancel"); return; }
    if (status === "locked") { this._flash("REQUIRES PREREQUISITE", "#ff5d8f"); this.app.audio.sfx("cancel"); return; }
    if (status === "poor") { this._flash("NOT ENOUGH SHARDS", "#ff5d8f"); this.app.audio.sfx("cancel"); return; }
    if (this.app.progression.buyUpgrade(def)) {
      this._flash(`PURCHASED: ${def.name}`, "#7dffb0");
      this.app.audio.sfx("emblem");
    }
  }

  _flash(text, color) {
    this.flash = { text, color, t: 1.8 };
  }

  render(ctx) {
    ctx.fillStyle = "#0a0e1c";
    ctx.fillRect(0, 0, W, H);
    title(ctx, "SALVAGE VENDOR", W / 2, 56, { size: 32, glow: "#ffd86b" });

    // Shard balance.
    panel(ctx, W - 230, 30, 200, 44, { glow: 6, edge: "#4fd1ff" });
    text(ctx, "SHARDS", W - 210, 50, { size: 12, color: "#8b95b8" });
    text(ctx, `${this.app.progression.data.shards}`, W - 50, 60, {
      size: 24, align: "right", weight: 700, color: "#4fd1ff",
    });

    // Upgrade list.
    const listX = 70;
    const top = 110;
    this.items.forEach((def, i) => {
      const y = top + i * 56;
      const selected = i === this.index;
      const status = this._status(def);
      const edge = { owned: "#7dffb0", locked: "#566089", poor: "#ff5d8f", buyable: "#ffd86b" }[status];
      panel(ctx, listX, y, 520, 48, { glow: selected ? 12 : 2, edge: selected ? "#fff" : edge });
      text(ctx, def.name, listX + 18, y + 22, { size: 18, weight: 700, color: selected ? "#fff" : "#e8edff" });
      text(ctx, def.category.toUpperCase(), listX + 18, y + 40, { size: 11, color: "#8b95b8" });
      const tag = status === "owned" ? "OWNED"
        : status === "locked" ? "LOCKED"
        : `${def.cost} ◆`;
      text(ctx, tag, listX + 502, y + 30, { size: 18, align: "right", color: edge, weight: 700 });
    });

    // Description of the selected upgrade.
    const sel = this.items[this.index];
    panel(ctx, 610, 110, W - 680, 260, { glow: 6 });
    text(ctx, sel.name, 632, 150, { size: 20, weight: 700, color: "#ffd86b" });
    wrap(ctx, sel.desc, 632, 184, W - 730, 24, { size: 15, color: "#b8c0e0" });
    if (sel.requires) {
      const req = this.app.data.upgrades.find((u) => u.id === sel.requires);
      text(ctx, `Requires: ${req?.name ?? sel.requires}`, 632, 340, { size: 13, color: "#ff5d8f" });
    }

    if (this.flash) {
      ctx.globalAlpha = Math.min(1, this.flash.t);
      text(ctx, this.flash.text, W / 2, H - 70, { size: 20, align: "center", color: this.flash.color, weight: 700 });
      ctx.globalAlpha = 1;
    }
    text(ctx, "ENTER  buy      ESC  leave", W / 2, H - 30, {
      size: 13, align: "center", color: "#566089",
    });
  }
}

function wrap(ctx, str, x, y, maxW, lineH, opts) {
  ctx.font = `${opts.weight ?? 600} ${opts.size}px "Segoe UI", system-ui, sans-serif`;
  const words = str.split(" ");
  let line = "", ly = y;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      text(ctx, line, x, ly, opts); line = w; ly += lineH;
    } else line = test;
  }
  if (line) text(ctx, line, x, ly, opts);
}
