function playerDraw(ctx) {
  const p = G.player;
  if (!p) return;

  const sx = Math.round(p.x - Camera.x) - 1;
  const sy = Math.round(p.y - Camera.y) - 1;

  /* I-frame flicker: hide SPRITE every other 3-frame burst, but draw notification regardless */
  const spriteVisible = !(p.iFrames > 0 && (p.iFrames % 6) < 3);

  if (spriteVisible) {
    ctx.save();
    if (p.facing === -1) {
      ctx.translate(sx + 16, sy);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(sx, sy);
    }

    /* ── Hood ── */
    ctx.fillStyle = PAL.CLOAK_DARK;
    ctx.fillRect(5, 0, 6, 2);
    ctx.fillRect(4, 2, 8, 3);
    ctx.fillRect(3, 4, 10, 2);

    /* ── Face ── */
    ctx.fillStyle = PAL.SKIN;
    ctx.fillRect(4, 4, 8, 4);

    /* ── Eyes ── */
    ctx.fillStyle = PAL.CLOAK_DARK;
    ctx.fillRect(5, 6, 2, 1);
    ctx.fillRect(9, 6, 2, 1);

    /* ── Cloak upper body ── */
    ctx.fillStyle = PAL.CLOAK_MID;
    ctx.fillRect(1, 8, 14, 5);

    /* ── Cloak mid + lower ── */
    ctx.fillStyle = PAL.CLOAK_DARK;
    ctx.fillRect(2, 13, 12, 4);
    ctx.fillRect(3, 17, 10, 3);

    /* ── Legs ── */
    const walking  = p.onGround && Math.abs(p.vx) > 0.1;
    const legShift = walking ? (p.animFrame % 2 === 0 ? -1 : 1) : 0;
    ctx.fillStyle = PAL.CLOAK_DARK;
    ctx.fillRect(4, 20 - legShift, 4, 4);
    ctx.fillRect(8, 20 + legShift, 4, 4);

    /* ── Attack ── */
    if (p.attackTimer > 0) {
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(12, 9,  3, 6);
      ctx.fillStyle = PAL.SWORD_GREY;
      ctx.fillRect(15, 10, 8, 3);
      ctx.fillStyle = PAL.WHITE;
      ctx.fillRect(22, 11, 1, 1);
    }

    ctx.restore();
  }

  /* ── Pickup notification — always visible, fades out over last 20 frames ── */
  if (p.notifyTimer > 0) {
    const alpha = Math.min(1, p.notifyTimer / 20);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = PAL.PALE_GOLD;
    ctx.font        = '6px monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(p.notifyText, sx + 8, sy - 6);
    ctx.globalAlpha = 1;
    ctx.textAlign   = 'left';
  }
}