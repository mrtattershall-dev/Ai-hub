/**
 * gallery.js — the Archive Terminal: emblems, cheats, echo logs, sound test.
 *
 * A tabbed "extras" browser that reads unlock definitions (data/unlocks.json)
 * and cross-references the player's progression to show what has been recovered.
 * Cheats that are unlocked can be toggled live; the sound test plays any track
 * through the audio engine. Reachable from both the title and the hub.
 *
 * @module scenes/gallery
 */

import { Scene } from "../engine/scene.js";
import { panel, text, title } from "../ui/widgets.js";
import { CONFIG } from "../config.js";

const W = CONFIG.view.width;
const H = CONFIG.view.height;
const TABS = ["EMBLEMS", "CHEATS", "ECHO LOGS", "SOUND TEST"];

export class GalleryScene extends Scene {
  onEnter() {
    this.tab = 0;
    this.index = 0;
    this.app.audio.sfx("confirm");
    // Available only when a save is loaded; title-screen access shows a stub.
    this.hasSave = !!this.app.progression.data;
  }

  _rows() {
    const d = this.app.data.unlocks;
    const prog = this.app.progression;
    switch (this.tab) {
      case 0: return d.emblems.map((e) => ({
        name: e.name, got: this.hasSave && prog.hasEmblem(e.id),
        desc: e.blurb, art: e.art,
      }));
      case 1: return d.cheats.map((c) => ({
        name: c.name, got: this.hasSave && prog.isUnlocked(c.id),
        desc: c.desc, cheatId: c.id, active: this.hasSave && prog.cheatOn(c.id),
      }));
      case 2: return d.echoLogs.map((l) => ({
        name: l.name, got: this.hasSave && prog.data.echoLogs.includes(l.id),
        desc: l.text,
      }));
      case 3: return d.soundtest.map((s) => ({ name: s.name, got: true, trackId: s.id }));
      default: return [];
    }
  }

  update() {
    const input = this.app.input;
    const rows = this._rows();
    if (input.pressed("cancel")) { this.app.audio.sfx("cancel"); this.app.scenes.pop(); return; }
    if (input.pressed("left")) { this.tab = (this.tab + TABS.length - 1) % TABS.length; this.index = 0; this.app.audio.sfx("cursor"); }
    if (input.pressed("right")) { this.tab = (this.tab + 1) % TABS.length; this.index = 0; this.app.audio.sfx("cursor"); }
    if (input.pressed("up")) { this.index = (this.index + rows.length - 1) % rows.length; this.app.audio.sfx("cursor"); }
    if (input.pressed("down")) { this.index = (this.index + 1) % rows.length; this.app.audio.sfx("cursor"); }
    if (input.pressed("confirm")) this._activate(rows[this.index]);
  }

  _activate(row) {
    if (!row) return;
    if (row.trackId) { this.app.audio.playMusic(row.trackId); this.app.audio.sfx("cursor"); return; }
    if (row.cheatId) {
      if (!row.got) { this.app.audio.sfx("cancel"); return; }
      this.app.progression.setCheat(row.cheatId, !this.app.progression.cheatOn(row.cheatId));
      this.app.audio.sfx("emblem");
    }
  }

  render(ctx) {
    ctx.fillStyle = "#0a0e1c";
    ctx.fillRect(0, 0, W, H);
    title(ctx, "ARCHIVE TERMINAL", W / 2, 50, { size: 30, glow: "#ff5d8f" });

    // Tab bar.
    const tabW = 200;
    const startX = W / 2 - (TABS.length * tabW) / 2;
    TABS.forEach((name, i) => {
      const x = startX + i * tabW;
      const active = i === this.tab;
      panel(ctx, x + 6, 76, tabW - 12, 36, { glow: active ? 10 : 1, edge: active ? "#4fd1ff" : "#2a3450" });
      text(ctx, name, x + tabW / 2, 100, {
        size: 14, align: "center", color: active ? "#fff" : "#8b95b8", weight: active ? 700 : 600,
      });
    });

    const rows = this._rows();
    // List on the left.
    panel(ctx, 60, 130, 420, H - 200, { glow: 4 });
    rows.forEach((row, i) => {
      const y = 165 + i * 42;
      const selected = i === this.index;
      const color = !row.got ? "#566089" : selected ? "#fff" : "#b8c0e0";
      if (selected) {
        ctx.fillStyle = "rgba(79,209,255,0.12)";
        ctx.fillRect(72, y - 22, 396, 36);
      }
      const label = row.got ? row.name : "??? LOCKED";
      text(ctx, label, 90, y, { size: 17, color, baseline: "middle", weight: selected ? 700 : 600 });
      if (row.active) text(ctx, "● ON", 456, y, { size: 13, align: "right", color: "#7dffb0", baseline: "middle" });
    });

    // Detail on the right.
    panel(ctx, 510, 130, W - 570, H - 200, { glow: 6 });
    const sel = rows[this.index];
    if (sel) {
      text(ctx, sel.got ? sel.name : "LOCKED ENTRY", 536, 175, {
        size: 22, weight: 700, color: sel.got ? "#ffd86b" : "#566089",
      });
      // Faux "concept art" swatch.
      panel(ctx, 536, 195, W - 626, 150, { edge: "#2a3450", fill: "rgba(0,0,0,0.3)" });
      if (sel.got) {
        text(ctx, sel.art ?? "▣", 536 + (W - 626) / 2, 270, {
          size: 14, align: "center", color: "#8b95b8", baseline: "middle",
        });
      } else {
        text(ctx, "Recover this entry to view.", 536 + (W - 626) / 2, 270, {
          size: 14, align: "center", color: "#566089", baseline: "middle",
        });
      }
      if (sel.got && sel.desc) {
        wrap(ctx, sel.desc, 536, 380, W - 640, 24, { size: 15, color: "#b8c0e0" });
      }
      if (sel.cheatId && sel.got) {
        text(ctx, "ENTER to toggle", 536, H - 110, { size: 13, color: "#7dffb0" });
      }
      if (sel.trackId) {
        text(ctx, "ENTER to play", 536, H - 110, { size: 13, color: "#7dffb0" });
      }
    }

    text(ctx, "◀ ▶ tabs    ▲ ▼ select    ENTER use    ESC back", W / 2, H - 30, {
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
