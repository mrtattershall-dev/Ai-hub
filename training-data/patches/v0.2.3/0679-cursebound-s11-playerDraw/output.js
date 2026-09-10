function playerDraw(ctx) {
  const p = G.player;
  if (!p) return;

  const sx = Math.round(p.x - Camera.x) - 1;
  const sy = Math.round(p.y - Camera.y) - 1;

  const spriteVisible = !(p.iFrames > 0 && (p.iFrames % 6) < 3);

  if (spriteVisible) {
    ctx.save();
    if (p.facing === -1) {
      ctx.translate(sx + 16, sy);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(sx, sy);
    }

    /* ── Hood — with highlight ridge ── */
    ctx.fillStyle = PAL.CLOAK_DARK;
    ctx.fillRect(5, 0, 6, 2);
    ctx.fillRect(4, 2, 8, 3);
    ctx.fillRect(3, 4, 10, 2);
    /* Hood highlight — left-side lit edge */
    ctx.fillStyle = PAL.CLOAK_MID;
    ctx.fillRect(5, 0, 2, 2);
    ctx.fillRect(4, 2, 2, 3);

    /* ── Face ── */
    ctx.fillStyle = PAL.SKIN;
    ctx.fillRect(4, 4, 8, 4);
    /* Cheekbone shadow */
    ctx.fillStyle = '#c08050';
    ctx.fillRect(4, 6, 2, 2);

    /* ── Eyes — direction-aware glow ── */
    ctx.fillStyle = PAL.CLOAK_DARK;
    ctx.fillRect(5, 6, 2, 1);
    ctx.fillRect(9, 6, 2, 1);
    /* Subtle eye glow — curse mark */
    ctx.fillStyle = '#aa4422';
    ctx.fillRect(10, 6, 1, 1);

    /* ── Shoulder pauldron — left ── */
    ctx.fillStyle = PAL.CLOAK_MID;
    ctx.fillRect(1, 8, 14, 4);
    /* Shoulder highlight ridge */
    ctx.fillStyle = PAL.CLOAK_LITE;
    ctx.fillRect(2, 8, 4, 1);
    /* Right shoulder shadow */
    ctx.fillStyle = PAL.CLOAK_DARK;
    ctx.fillRect(12, 8, 2, 4);

    /* ── Cloak body — three-tone depth ── */
    ctx.fillStyle = PAL.CLOAK_MID;
    ctx.fillRect(2, 12, 12, 3);
    ctx.fillStyle = PAL.CLOAK_DARK;
    ctx.fillRect(2, 15, 12, 4);
    ctx.fillRect(3, 19, 10, 2);
    /* Centre fold crease */
    ctx.fillStyle = '#141430';
    ctx.fillRect(7, 12, 1, 7);

    /* ── Belt — horizontal gold strip ── */
    ctx.fillStyle = '#6c4010';
    ctx.fillRect(3, 12, 10, 1);
    ctx.fillStyle = PAL.GOLD;
    ctx.fillRect(6, 12, 4, 1);   /* belt buckle */

    /* ── Boots ── */
    const walking  = p.onGround && Math.abs(p.vx) > 0.1;
    const legShift = walking ? (p.animFrame % 2 === 0 ? -1 : 1) : 0;
    /* Boot body */
    ctx.fillStyle = '#1a1010';
    ctx.fillRect(3, 21 - legShift, 5, 5);
    ctx.fillRect(8, 21 + legShift, 5, 5);
    /* Boot toe — slightly brighter */
    ctx.fillStyle = '#2a2020';
    ctx.fillRect(3, 24 - legShift, 5, 2);
    ctx.fillRect(8, 24 + legShift, 5, 2);
    /* Boot highlight */
    ctx.fillStyle = '#3a3030';
    ctx.fillRect(3, 21 - legShift, 2, 1);
    ctx.fillRect(8, 21 + legShift, 2, 1);

    /* ── Attack animations — per weapon ── */
    if (p.attackTimer > 0) {
      const wName   = p.weapons[p.weaponIdx] || 'sword';
      const tNorm   = 1 - (p.attackTimer / (WEAPON_DEF_EXT[wName] || WEAPON_DEF[wName] || WEAPON_DEF.sword).recovery);

      if (wName === 'sword') {
        /* Sword: forward thrust — slides out then retracts */
        const ext = tNorm < 0.5 ? tNorm * 2 : 2 - tNorm * 2;
        const off = Math.round(ext * 6);
        ctx.fillStyle = PAL.GOLD;
        ctx.fillRect(12,     9,  3, 6);          /* crossguard */
        ctx.fillStyle = PAL.SWORD_GREY;
        ctx.fillRect(15,     10, 6 + off, 3);    /* blade extends */
        ctx.fillStyle = '#d0d0d0';
        ctx.fillRect(15,     10, 3,       1);    /* blade upper highlight */
        ctx.fillStyle = PAL.WHITE;
        ctx.fillRect(20 + off, 11, 1, 1);        /* tip glint */

      } else if (wName === 'bone_whip') {
        /* Whip: sweeping arc from handle to tip */
        const arc = tNorm;
        const tipX = Math.round(12 + arc * 18);
        const tipY = Math.round(8 - Math.sin(arc * Math.PI) * 10);
        ctx.fillStyle = PAL.STONE_HIGH;
        ctx.fillRect(12, 8, 2, 4);               /* handle */
        /* Chain segments along arc */
        for (let s = 0; s < 5; s++) {
          const t2 = s / 5;
          const cx2 = Math.round(14 + t2 * (tipX - 14));
          const cy2 = Math.round(9  - Math.sin(t2 * Math.PI * arc) * 8);
          ctx.fillStyle = (s % 2 === 0) ? PAL.LIGHTGRAY : PAL.STONE_MID;
          ctx.fillRect(cx2, cy2, 2, 2);
        }
        ctx.fillStyle = PAL.PALE_GOLD;
        ctx.fillRect(tipX, tipY, 2, 2);          /* tip spike */
        ctx.fillStyle = PAL.WHITE;
        ctx.fillRect(tipX, tipY, 1, 1);

      } else if (wName === 'cursed_dagger') {
        /* Dagger: arm extends forward quickly — projectile fired separately */
        ctx.fillStyle = PAL.CLOAK_LITE;
        ctx.fillRect(13, 11, 8, 2);              /* arm thrust */
        ctx.fillStyle = '#6644aa';
        ctx.fillRect(13, 10, 8, 1);              /* curse glint on arm */

      } else if (wName === 'holy_axe') {
        /* Axe: raised overhead then forward throw arc */
        const phase = tNorm < 0.3 ? 'raise' : 'throw';
        if (phase === 'raise') {
          ctx.fillStyle = PAL.PALE_GOLD;
          ctx.fillRect(11, 2,  3, 8);            /* shaft raised */
          ctx.fillStyle = PAL.GOLD;
          ctx.fillRect(8,  1,  4, 5);            /* axe head up */
          ctx.fillStyle = PAL.WHITE;
          ctx.fillRect(8,  1,  2, 2);            /* blade glint */
        } else {
          const ext = (tNorm - 0.3) / 0.7;
          ctx.fillStyle = PAL.PALE_GOLD;
          ctx.fillRect(11, 2 + Math.round(ext * 8), 3, 8);  /* shaft angle */
          ctx.fillStyle = PAL.GOLD;
          ctx.fillRect(11 + Math.round(ext * 4), 1, 4, 5);  /* axe forward */
        }

      } else if (wName === 'void_scythe') {
        /* Scythe: wide sweep — simultaneous both directions shown as a broad arc */
        const sweep = Math.sin(tNorm * Math.PI);
        ctx.fillStyle = '#4a3060';
        ctx.fillRect(7, 6, 2, 10);              /* central staff */
        /* Left blade arc */
        ctx.fillStyle = '#8844cc';
        ctx.fillRect(Math.round(5 - sweep * 6), Math.round(6 - sweep * 2), 5, 2);
        /* Right blade arc */
        ctx.fillRect(Math.round(8 + sweep * 4), Math.round(6 - sweep * 2), 5, 2);
        /* Void particles */
        if (sweep > 0.5) {
          ctx.fillStyle = PAL.PALE_GOLD;
          ctx.fillRect(2, 4, 1, 1);
          ctx.fillRect(14, 4, 1, 1);
          ctx.fillRect(0, 8, 1, 1);
          ctx.fillRect(15, 8, 1, 1);
        }
      } else {
        /* Fallback — generic forward slash */
        ctx.fillStyle = PAL.GOLD;
        ctx.fillRect(12, 9, 3, 6);
        ctx.fillStyle = PAL.SWORD_GREY;
        ctx.fillRect(15, 10, 8, 3);
        ctx.fillStyle = PAL.WHITE;
        ctx.fillRect(22, 11, 1, 1);
      }
    }

    ctx.restore();
  }

  /* ── Pickup notification — fades out over last 20 frames ── */
  if (p.notifyTimer > 0) {
    const alpha = Math.min(1, p.notifyTimer / 20);
    ctx.globalAlpha = alpha;
    /* Small panel behind text */
    const nw = pxTextWidth(p.notifyText, 1) + 8;
    const nx = (sx + 8) - (nw >> 1);
    const ny = sy - 14;
    ctx.fillStyle = 'rgba(5,3,12,0.8)';
    ctx.fillRect(nx, ny, nw, 10);
    ctx.fillStyle = PAL.BLOOD_RED;
    ctx.fillRect(nx, ny, nw, 1);
    drawPxText(ctx, p.notifyText, sx + 8, ny + 3, 1, PAL.PALE_GOLD, 'center');
    ctx.globalAlpha = 1;
  }
}