const pauseScreen = (() => {
  /* ── Guide content — weapon + lore entries ── */
  const GUIDE_ENTRIES = [
    {
      type: 'header',
      text: 'WEAPONS',
    },
    {
      type:  'weapon',
      name:  'RUSTED SWORD',
      icon:  'sword',
      zone:  'ALWAYS EQUIPPED',
      desc1: 'SHORT FORWARD SLASH.',
      desc2: 'RELIABLE. NEVER LOST.',
    },
    {
      type:  'weapon',
      name:  'BONE WHIP',
      icon:  'bone_whip',
      zone:  'ZONE 1 - ENTRY HALL',
      desc1: 'LONG ARC. HITS HIGH.',
      desc2: 'REACHES OVER ENEMIES.',
    },
    {
      type:  'weapon',
      name:  'CURSED DAGGER',
      icon:  'cursed_dagger',
      zone:  'ZONE 2 - THE CRYPT',
      desc1: 'THROWN PROJECTILE.',
      desc2: 'FAST. HITS LOW TARGETS.',
    },
    {
      type:  'weapon',
      name:  'HOLY AXE',
      icon:  'holy_axe',
      zone:  'ZONE 3 - CLOCKTOWER',
      desc1: 'ARCING THROW. HITS HIGH',
      desc2: 'THEN FALLS. KILLS FLYERS.',
    },
    {
      type:  'weapon',
      name:  'VOID SCYTHE',
      icon:  'void_scythe',
      zone:  'ZONE 4 - THE SANCTUM',
      desc1: 'WIDE SWEEP. BOTH SIDES.',
      desc2: 'DESTROYS PROJECTILES.',
    },
    {
      type: 'header',
      text: 'COLLECTIBLES',
    },
    {
      type:  'item',
      name:  'LORE STONE',
      icon:  'lore',
      zone:  'ALL ZONES',
      desc1: 'GLOWING BLUE TABLET.',
      desc2: 'REVEALS THE CURSE STORY.',
    },
    {
      type: 'header',
      text: 'THE HAND',
    },
    {
      type:  'item',
      name:  'THE HAND',
      icon:  'hand',
      zone:  'APPEARS AFTER 90 SECS',
      desc1: 'CANNOT BE KILLED.',
      desc2: 'ANY WEAPON STUNS 3 SECS.',
    },
    {
      type: 'header',
      text: 'OBJECTIVE',
    },
    {
      type:  'item',
      name:  'BREAK THE CURSE',
      icon:  null,
      zone:  '',
      desc1: 'REACH THE THRONE ROOM.',
      desc2: 'FIVE ZONES. ONE WAY OUT.',
    },
  ];

  let showGuide  = false;
  let guideLine  = 0;           /* scroll index into GUIDE_ENTRIES */
  const VISIBLE  = 4;           /* entries visible at once in guide */

  /* ── Draw a single weapon/item icon in the guide — reuses _drawWeaponIcon ── */
  function drawGuideIcon(ctx, iconName, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    switch(iconName) {
      case 'sword':
        ctx.fillStyle = PAL.SWORD_GREY;
        ctx.fillRect(-1,-5, 2, 9);
        ctx.fillStyle = PAL.GOLD;
        ctx.fillRect(-3,-1, 6, 2);
        ctx.fillStyle = '#8c6030';
        ctx.fillRect(-1, 1, 2, 3);
        ctx.fillStyle = PAL.WHITE;
        ctx.fillRect(-1,-5, 1, 2);
        break;
      case 'bone_whip':
        ctx.fillStyle = PAL.LIGHTGRAY;
        for(let i=0;i<4;i++) ctx.fillRect(-5+i*3,-2+i, 2, 2);
        ctx.fillStyle = PAL.STONE_HIGH;
        ctx.fillRect(-6,-3, 3, 2);
        break;
      case 'cursed_dagger':
        ctx.fillStyle = PAL.CLOAK_LITE;
        ctx.fillRect(-5,-1, 8, 2);
        ctx.fillStyle = PAL.STONE_HIGH;
        ctx.fillRect(2,-2, 2, 4);
        ctx.fillStyle = '#8866ff';
        ctx.fillRect(-5, 0, 7, 1);
        break;
      case 'holy_axe':
        ctx.fillStyle = PAL.PALE_GOLD;
        ctx.fillRect(-2,-5, 4, 8);
        ctx.fillStyle = PAL.GOLD;
        ctx.fillRect(-5,-5, 3, 6);
        ctx.fillStyle = PAL.WHITE;
        ctx.fillRect(-5,-5, 2, 2);
        break;
      case 'void_scythe':
        ctx.fillStyle = '#4a3060';
        ctx.fillRect(-1,-5, 2, 9);
        ctx.fillStyle = '#aa66ff';
        ctx.fillRect(-5,-5, 5, 2);
        ctx.fillRect(-5,-5, 2, 5);
        ctx.fillStyle = PAL.WHITE;
        ctx.fillRect(-5,-5, 2, 1);
        break;
      case 'lore':
        ctx.fillStyle = '#283848';
        ctx.fillRect(-4,-5, 8, 10);
        ctx.fillStyle = '#4466cc';
        ctx.fillRect(-2,-3, 4, 6);
        ctx.fillStyle = PAL.WHITE;
        ctx.fillRect(-1,-1, 2, 2);
        break;
      case 'hand':
        ctx.fillStyle = PAL.STONE_MID;
        ctx.fillRect(-4,-2, 8, 6);
        ctx.fillStyle = PAL.STONE_HIGH;
        ctx.fillRect(-4,-5, 2, 4);
        ctx.fillRect(-1,-6, 2, 5);
        ctx.fillRect( 2,-5, 2, 4);
        break;
    }
    ctx.restore();
  }

  return {
    cursor:    0,
    options:   ['RESUME', 'GUIDE', 'QUIT TO TITLE'],

    reset() {
      this.cursor = 0;
      showGuide   = false;
      guideLine   = 0;
    },

    update() {
      if (showGuide) {
        /* B or START closes guide back to pause menu */
        if (INPUT.B.just || INPUT.START.just) {
          showGuide = false;
          return;
        }
        const maxScroll = Math.max(0, GUIDE_ENTRIES.length - VISIBLE);
        if (INPUT.DOWN.just) guideLine = Math.min(maxScroll, guideLine + 1);
        if (INPUT.UP.just)   guideLine = Math.max(0,         guideLine - 1);
        return;
      }

      /* Normal pause menu */
      if (INPUT.DOWN.just) this.cursor = (this.cursor + 1) % this.options.length;
      if (INPUT.UP.just)   this.cursor = (this.cursor - 1 + this.options.length) % this.options.length;
      if (INPUT.A.just || INPUT.START.just) {
        if (this.cursor === 0) { setState(STATE.PLAYING); return; }
        if (this.cursor === 1) { showGuide = true; guideLine = 0; return; }
        if (this.cursor === 2) { setState(STATE.TITLE); return; }
      }
      /* B always resumes */
      if (INPUT.B.just) { setState(STATE.PLAYING); }
    },

    draw(ctx) {
      /* Dim game world underneath */
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      ctx.fillRect(0, 0, NES.W, NES.H);

      if (showGuide) {
        this._drawGuide(ctx);
      } else {
        this._drawPause(ctx);
      }
    },

    _drawPause(ctx) {
      const PX = 64, PY = 70, PW = 128, PH = 80;
      drawNESPanel(ctx, PX, PY, PW, PH, {
        bg: '#090714', border: PAL.PALE_GOLD, hi: '#2a2040', corners: true,
      });

      drawPxText(ctx, 'PAUSED', NES.W/2, PY+8, 1, PAL.PALE_GOLD, 'center', true);

      ctx.fillStyle = PAL.BLOOD_RED;
      ctx.fillRect(PX+8, PY+17, PW-16, 1);

      this.options.forEach((opt, i) => {
        const sel   = i === this.cursor;
        const color = sel ? PAL.PALE_GOLD : PAL.HUD_TEXT;
        const ty    = PY + 26 + i * 15;
        if (sel && Math.floor(G.frame/15)%2===0) {
          drawPxText(ctx, '>', PX+10, ty, 1, PAL.CURSOR);
        }
        drawPxText(ctx, opt, NES.W/2, ty, 1, color, 'center', sel);
      });

      drawPxText(ctx, 'B=RESUME', NES.W/2, PY+PH-8, 1, '#2a2a3a', 'center');
    },

    _drawGuide(ctx) {
      /* Full-width guide panel */
      const PX = 4, PY = 4, PW = NES.W-8, PH = NES.H-HUD_H-8;
      drawNESPanel(ctx, PX, PY, PW, PH, {
        bg: '#05030c', border: PAL.PALE_GOLD, hi: '#1a1030', corners: true,
      });

      /* Title bar */
      drawPxText(ctx, 'GUIDE', NES.W/2, PY+6, 1, PAL.PALE_GOLD, 'center', true);
      ctx.fillStyle = PAL.BLOOD_RED;
      ctx.fillRect(PX+6, PY+14, PW-12, 1);

      /* Visible entries */
      const entryH  = 36;
      const startY  = PY + 18;
      const visible = GUIDE_ENTRIES.slice(guideLine, guideLine + VISIBLE);

      visible.forEach((entry, vi) => {
        const ey = startY + vi * entryH;

        if (entry.type === 'header') {
          /* Section header — full-width separator */
          ctx.fillStyle = '#1a1030';
          ctx.fillRect(PX+6, ey, PW-12, entryH - 2);
          ctx.fillStyle = PAL.BLOOD_RED;
          ctx.fillRect(PX+6, ey, PW-12, 1);
          drawPxText(ctx, entry.text, NES.W/2, ey+6, 1, PAL.FIRE_RED, 'center');
          ctx.fillStyle = PAL.BLOOD_RED;
          ctx.fillRect(PX+6, ey+entryH-3, PW-12, 1);
          return;
        }

        /* Entry row background */
        const rowAlpha = (vi + guideLine) % 2 === 0 ? '#0a0818' : '#0e0c1c';
        ctx.fillStyle = rowAlpha;
        ctx.fillRect(PX+6, ey, PW-12, entryH - 1);

        /* Icon box */
        const iconBoxX = PX + 10;
        const iconBoxY = ey + 4;
        ctx.fillStyle = '#181028';
        ctx.fillRect(iconBoxX, iconBoxY, 16, 16);
        ctx.fillStyle = '#2a1848';
        ctx.fillRect(iconBoxX, iconBoxY, 16, 1);
        ctx.fillRect(iconBoxX, iconBoxY, 1, 16);
        if (entry.icon) drawGuideIcon(ctx, entry.icon, iconBoxX+8, iconBoxY+8);

        /* Name + zone label */
        const textX = iconBoxX + 20;
        drawPxText(ctx, entry.name, textX, ey+5,  1, PAL.PALE_GOLD);
        drawPxText(ctx, entry.zone, textX, ey+13, 1, '#5a4878');

        /* Description lines */
        drawPxText(ctx, entry.desc1, textX, ey+21, 1, PAL.LIGHTGRAY);
        drawPxText(ctx, entry.desc2, textX, ey+29, 1, '#888898');
      });

      /* Scroll indicators */
      const maxScroll = Math.max(0, GUIDE_ENTRIES.length - VISIBLE);
      if (guideLine > 0) {
        drawPxText(ctx, '[UP]', NES.W/2, startY - 6, 1, PAL.MIDGRAY, 'center');
        /* Up arrow pixel art */
        ctx.fillStyle = PAL.MIDGRAY;
        ctx.fillRect(NES.W/2 - 1, startY - 8, 2, 1);
        ctx.fillRect(NES.W/2 - 3, startY - 7, 6, 1);
      }
      if (guideLine < maxScroll) {
        const bottomY = startY + VISIBLE * entryH + 2;
        ctx.fillStyle = PAL.MIDGRAY;
        ctx.fillRect(NES.W/2 - 3, bottomY,   6, 1);
        ctx.fillRect(NES.W/2 - 1, bottomY+1, 2, 1);
      }

      /* Scroll progress bar */
      const barH    = PH - 24;
      const barX    = PX + PW - 8;
      const barY    = PY + 18;
      ctx.fillStyle = '#1a1030';
      ctx.fillRect(barX, barY, 3, barH);
      if (maxScroll > 0) {
        const thumbH = Math.max(6, (VISIBLE / GUIDE_ENTRIES.length) * barH) | 0;
        const thumbY = barY + ((guideLine / maxScroll) * (barH - thumbH)) | 0;
        ctx.fillStyle = PAL.PALE_GOLD;
        ctx.fillRect(barX, thumbY, 3, thumbH);
      }

      /* Close hint */
      drawPxText(ctx, 'B=BACK', NES.W/2, PY+PH-6, 1, '#2a2a3a', 'center');
    },
  };
})();