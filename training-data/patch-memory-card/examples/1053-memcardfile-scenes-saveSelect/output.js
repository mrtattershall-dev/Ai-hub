/**
 * saveSelect.js — three save slots with summaries (play time, %, rank, area).
 *
 * Reads slot summaries from the SaveSystem and lets the player pick one. An
 * empty slot starts a new game (creates + attaches a fresh save); a used slot
 * loads it. Either way we attach the chosen save to Progression and enter the
 * hub. Pressing the heavy-attack key arms a one-press delete on the slot.
 *
 * @module scenes/saveSelect
 */

import { Scene } from "../engine/scene.js";
import { panel, text, title } from "../ui/widgets.js";
import { CONFIG } from "../config.js";
import { HubScene } from "./hub.js";

const W = CONFIG.view.width;

export class SaveSelectScene extends Scene {
  onEnter() {
    this.transparent = false;
    this.refresh();
    this.index = 0;
    this.armedDelete = -1; // slot index armed for deletion
  }

  refresh() {
    this.slots = this.app.save.listSlots();
  }

  update() {
    const input = this.app.input;
    if (input.pressed("up")) { this.index = (this.index + 2) % 3; this.armedDelete = -1; this.app.audio.sfx("cursor"); }
    if (input.pressed("down")) { this.index = (this.index + 1) % 3; this.armedDelete = -1; this.app.audio.sfx("cursor"); }
    if (input.pressed("cancel")) { this.app.audio.sfx("cancel"); this.app.scenes.pop(); return; }

    // Delete flow: heavy arms, confirm/heavy again deletes.
    if (input.pressed("heavy") && !this.slots[this.index].empty) {
      if (this.armedDelete === this.index) {
        this.app.save.delete(this.slots[this.index].slot);
        this.app.audio.sfx("door");
        this.armedDelete = -1;
        this.refresh();
      } else {
        this.armedDelete = this.index;
        this.app.audio.sfx("cursor");
      }
      return;
    }

    if (input.pressed("confirm")) this._choose();
  }

  _choose() {
    const slot = this.slots[this.index];
    let data;
    if (slot.empty) {
      data = this.app.save.newSave(slot.slot);
      this.app.save.save(slot.slot, data);
    } else {
      data = slot.data;
    }
    this.app.progression.attach(data);
    this.app.audio.sfx("confirm");
    // Hard navigate into the hub (replace the whole stack).
    this.app.scenes.replace(new HubScene(this.app));
  }

  render(ctx) {
    ctx.fillStyle = "#0a0e1c";
    ctx.fillRect(0, 0, W, CONFIG.view.height);
    title(ctx, "SELECT MEMORY CARD", W / 2, 70, { size: 34 });

    this.slots.forEach((slot, i) => {
      const y = 130 + i * 116;
      const selected = i === this.index;
      panel(ctx, 120, y, W - 240, 100, {
        glow: selected ? 16 : 4,
        edge: selected ? "#4fd1ff" : "#2a3450",
      });
      text(ctx, `SLOT ${slot.slot}`, 150, y + 30, { size: 16, color: "#8b95b8" });
      if (slot.empty) {
        text(ctx, "— NEW GAME —", 150, y + 64, { size: 22, color: selected ? "#fff" : "#b8c0e0", weight: 700 });
      } else {
        const s = slot.summary;
        text(ctx, s.name, 150, y + 64, { size: 24, color: selected ? "#fff" : "#b8c0e0", weight: 700 });
        text(ctx, `${s.completion}% restored`, 360, y + 40, { size: 14, color: "#7dffb0" });
        text(ctx, `Time ${s.playTime}`, 360, y + 62, { size: 14, color: "#b8c0e0" });
        text(ctx, `Avg Rank ${s.avgRank}`, 360, y + 84, { size: 14, color: "#ffd86b" });
        text(ctx, `Emblems ${s.emblems}`, 560, y + 40, { size: 14, color: "#ffd86b" });
        text(ctx, `Area: ${s.lastArea}`, 560, y + 62, { size: 14, color: "#b8c0e0" });
        if (this.armedDelete === i) {
          text(ctx, "PRESS K AGAIN TO DELETE", W - 170, y + 84, { size: 12, align: "right", color: "#ff5d8f" });
        }
      }
    });

    text(ctx, "ENTER  select      K  delete      ESC  back", W / 2, CONFIG.view.height - 30, {
      size: 13, align: "center", color: "#566089",
    });
  }
}
