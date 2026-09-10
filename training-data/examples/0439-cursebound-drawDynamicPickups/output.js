function drawDynamicPickups(ctx, zoneId, camX, camY) {
  const zone = ZONES[zoneId];
  if (!zone || !zone.mapData) return;
  const { cols, rows } = zone.mapData;
  const t   = G.frame;
  const bob = Math.sin(t * 0.08) * 2 | 0;          /* vertical bob ±2px */
  const pulse = Math.sin(t * 0.12) * 0.5 + 0.5;    /* 0–1 glow pulse    */

  const tx0 = Math.max(0,         ( camX           / NES.TILE) | 0);
  const tx1 = Math.min(cols - 1, (((camX + NES.W)  / NES.TILE) | 0) + 1);
  const ty0 = Math.max(0,         ( camY           / NES.TILE) | 0);
  const ty1 = Math.min(rows - 1, (((camY + NES.H)  / NES.TILE) | 0) + 1);

  const wName = zone.weaponPickup || 'sword';

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const id = zone.mapData.data[ty * cols + tx];
      if (id !== T.LORE && id !== T.WEAPON) continue;

      const px = tx * NES.TILE - camX;
      const py = ty * NES.TILE - camY + bob;   /* bob applies to both */

      if (id === T.WEAPON) {
        /* ── NES weapon pedestal: stone base + glowing item ── */
        /* Base pedestal — 2 stone tiers */
        ctx.fillStyle = '#2c1808';
        ctx.fillRect(px + 1, py + 11, 14, 5);   /* lower tier */
        ctx.fillStyle = '#4c2c10';
        ctx.fillRect(px + 3, py + 9,  10, 3);   /* upper tier */
        ctx.fillStyle = PAL.STONE_MID;
        ctx.fillRect(px + 3, py + 9,  10, 1);   /* tier highlight */

        /* Weapon selector glow — palette cycle, NES-authentic */
        if (pulse > 0.3 && G.frame % 2 === 0) {
          const _wpCycle = [PAL.GOLD, PAL.PALE_GOLD, PAL.STONE_LITE];
          ctx.fillStyle = _wpCycle[Math.floor(G.frame / 4) % 3];
          ctx.fillRect(px + 2, py + 2, 12, 2);  /* 1px top highlight, not fill */
          ctx.fillRect(px + 2, py + 8, 12, 1);  /* 1px bottom */
        }

        /* Draw weapon-specific icon */
        ctx.save();
        ctx.translate(px + 8, py + 6);   /* centre of weapon area */
        _drawWeaponIcon(ctx, wName, pulse);
        ctx.restore();
      }

      if (id === T.LORE) {
        /* ── NES lore stone: floating rune tablet ── */
        /* Stone tablet base */
        ctx.fillStyle = '#181828';
        ctx.fillRect(px + 2,  py + 4,  12, 10);
        ctx.fillStyle = '#282840';
        ctx.fillRect(px + 3,  py + 4,  10, 9);
        ctx.fillStyle = '#383858';
        ctx.fillRect(px + 3,  py + 4,  10, 1);   /* top edge highlight */

        /* Rune diamond — colour shifts with pulse */
        const runeR = Math.floor(80  + pulse * 50)  .toString(16).padStart(2,'0');
        const runeG = Math.floor(80  + pulse * 80)  .toString(16).padStart(2,'0');
        const runeB = Math.floor(180 + pulse * 60)  .toString(16).padStart(2,'0');
        ctx.fillStyle = `#${runeR}${runeG}${runeB}`;
        /* Diamond shape */
        ctx.fillRect(px + 8,  py + 5,  2,  2);
        ctx.fillRect(px + 6,  py + 7,  6,  2);
        ctx.fillRect(px + 4,  py + 9,  9,  2);  /* widest row */
        ctx.fillRect(px + 6,  py + 11, 6,  2);
        ctx.fillRect(px + 8,  py + 13, 2,  1);
        /* Core spark */
        if (pulse > 0.6) {
          ctx.fillStyle = PAL.WHITE;
          ctx.fillRect(px + 8, py + 9, 2, 2);
        }

        /* Corner stones of tablet */
        ctx.fillStyle = '#484868';
        ctx.fillRect(px + 2,  py + 4,  2, 2);
        ctx.fillRect(px + 12, py + 4,  2, 2);
        ctx.fillRect(px + 2,  py + 12, 2, 2);
        ctx.fillRect(px + 12, py + 12, 2, 2);
      }
    }
  }
}