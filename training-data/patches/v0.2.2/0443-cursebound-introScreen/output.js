const introScreen = (() => {
  const PAGES = [
    [
      'THREE HUNDRED YEARS AGO,',
      'A RITUAL WAS PERFORMED',
      'IN THE THRONE ROOM',
      'OF THIS CASTLE.',
      '',
      'IT WENT WRONG.',
    ],
    [
      'YOU DIED THAT NIGHT.',
      '',
      'THE CURSE CARVED YOUR NAME',
      'INTO THE CASTLE STONE.',
      'IT HAS KEPT THE CANDLES LIT',
      'EVER SINCE.',
    ],
    [
      'EVERY HUNDRED YEARS,',
      'THE CURSE PULLS THE DEAD BACK.',
      'YOU HAVE RETURNED.',
      '',
      'REACH THE THRONE ROOM.',
      'BREAK THE CURSE. BE FREE.',
    ],
  ];

  const PAGE_HOLD    = 220;   /* frames to show each page fully before advancing */
  const CHAR_DELAY   = 3;     /* frames per character (typewriter effect) */
  const FADE_FRAMES  = 30;    /* cross-fade between pages */

  let page       = 0;
  let charCount  = 0;   /* how many chars of current page are shown */
  let holdTimer  = 0;   /* counts down after page fully shown */
  let fadeTimer  = 0;   /* 0=solid, >0=fading out */
  let walkX      = -16; /* player pixel X, starts off-screen left */
  let frameTimer = 0;
  let animFrame  = 0;
  let done       = false;

  /* Total characters on current page */
  function totalChars(p) {
    return PAGES[p].join('').length;
  }

  /* Get visible text for current page based on charCount */
  function visibleLines(p) {
    let remaining = charCount;
    return PAGES[p].map(line => {
      if (remaining <= 0) return '';
      const show = line.slice(0, remaining);
      remaining  = Math.max(0, remaining - line.length);
      return show;
    });
  }

  return {
    reset() {
      page = 0; charCount = 0; holdTimer = 0;
      fadeTimer = 0; walkX = -16; frameTimer = 0; animFrame = 0; done = false;
    },

    update() {
      /* SELECT skips the whole intro */
      if (INPUT.SELECT.just) {
        setState(STATE.PLAYING);
        return;
      }

      /* START or A advances — if still typing, complete the page instantly;
         if page is fully shown, jump to next page immediately */
      if (INPUT.START.just || INPUT.A.just) {
        const full = charCount > totalChars(page) * CHAR_DELAY;
        if (!full) {
          /* Snap to end of current page */
          charCount = totalChars(page) * CHAR_DELAY + 1;
          holdTimer = 0;
        } else if (fadeTimer === 0 && holdTimer > 0) {
          /* Already fully shown — cut the hold timer and advance now */
          holdTimer = 0;
          /* All pages: fade to black first */
          fadeTimer = FADE_FRAMES;
        }
        return;
      }

      /* Walk animation — player moves right across screen */
      if (++frameTimer >= 8) { frameTimer = 0; animFrame = (animFrame + 1) % 4; }
      /* Walk speed: fast at start, slows as they near the gate */
      /* Walk target: stop just outside the gate entrance.
         Gate left jamb is at gx-2=118. Player is 16px wide.
         Stop 4px gap from the jamb: targetX = 118 - 16 - 4 = 98 */
      const targetX = 98;
      if (walkX < targetX) {
        const speed = Math.max(0.4, (targetX - walkX) * 0.03 + 0.4);
        walkX = Math.min(targetX, walkX + speed);
      }

      /* Typewriter effect */
      if (holdTimer > 0) {
        if (--holdTimer <= 0) {
          /* All pages including last: fade to black, then transition */
          fadeTimer = FADE_FRAMES;
        }
      } else if (fadeTimer > 0) {
        if (--fadeTimer <= 0) {
          if (page >= PAGES.length - 1) {
            setState(STATE.PLAYING);  /* last page faded — go to game */
          } else {
            page++;
            charCount  = 0;
            holdTimer  = 0;
            fadeTimer  = 0;
          }
        }
      } else {
        charCount += 1;
        if (charCount > totalChars(page) * CHAR_DELAY) {
          charCount = totalChars(page) * CHAR_DELAY + 1;
          if (holdTimer === 0) holdTimer = PAGE_HOLD;
        }
      }
    },

    draw(ctx) {
      const W = NES.W, H = NES.H;

      /* ── Sky — same as title ── */
      ctx.fillStyle = '#000008';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#0a0614';
      ctx.fillRect(0, 140, W, 40);

      /* ── Stars ── */
      ctx.fillStyle = PAL.WHITE;
      [[90,12],[120,8],[160,20],[200,15],[230,30],[15,25],[70,35]].forEach(([sx,sy]) => ctx.fillRect(sx,sy,1,1));
      [[110,30],[180,10],[240,22],[30,18],[150,6]].forEach(([sx,sy]) => ctx.fillRect(sx,sy,2,2));

      /* ── Moon ── */
      ctx.fillStyle = PAL.LIGHTGRAY;
      for (let dy = -16; dy <= 16; dy++) {
        const hw = Math.sqrt(Math.max(0, 16*16 - dy*dy)) | 0;
        ctx.fillRect(220 - hw, 30 + dy, hw*2, 1);
      }
      ctx.fillStyle = '#000008';
      for (let dy = -14; dy <= 14; dy++) {
        const hw = Math.sqrt(Math.max(0, 14*14 - dy*dy)) | 0;
        ctx.fillRect(226 - hw, 26 + dy, hw*2, 1);
      }

      /* ── Castle silhouette — same construction as title but slightly smaller ── */
      ctx.fillStyle = '#141018';
      ctx.fillRect(40,  130, 80, 50);    /* far keep */
      ctx.fillRect(95,  108, 12, 72);    /* clocktower spire */
      ctx.fillRect(140, 128, 50, 52);
      ctx.fillStyle = PAL.STONE_DARK;
      ctx.fillRect(0,   158, W,  H - 158);  /* base */
      ctx.fillRect(56,  136, 40, 44);   /* left tower */
      [56,66,76].forEach(bx => ctx.fillRect(bx, 130, 7, 8));
      ctx.fillRect(92,  108, 56, 72);   /* main keep */
      [92,104,116,128,136,148].forEach(bx => ctx.fillRect(bx, 102, 8, 8));
      ctx.fillRect(112,  80, 14, 30);   /* clock spire */
      ctx.fillRect(115,  68, 8,  14);
      ctx.fillRect(118,  58, 2,  12);
      ctx.fillRect(154, 138, 36, 42);   /* right tower */
      [154,166,178].forEach(bx => ctx.fillRect(bx, 132, 8, 8));

      /* ── Castle gate — glowing red arch ── */
      const gx = 120, gy = 158;
      ctx.fillStyle = PAL.BLOOD_RED;
      ctx.fillRect(gx - 2, gy - 20, 20, 20);  /* gate arch opening */
      ctx.fillStyle = '#1a0000';
      ctx.fillRect(gx,     gy - 18, 16, 18);  /* dark void inside */
      /* Gate frame */
      ctx.fillStyle = PAL.FIRE_RED;
      ctx.fillRect(gx - 2, gy - 20, 2,  20);  /* left jamb */
      ctx.fillRect(gx + 16,gy - 20, 2,  20);  /* right jamb */
      ctx.fillRect(gx - 2, gy - 20, 20, 2);   /* lintel */
      /* Gate glow — alternating-frame opaque halo (NES flicker blend) */
      if (G.frame % 2 === 0) {
        const _glowCycle = [PAL.BLOOD_RED, PAL.FIRE_RED, PAL.BLOOD_RED];
        ctx.fillStyle = _glowCycle[Math.floor(G.frame / 8) % 3];
        ctx.fillRect(gx - 8, gy - 28, 36,  2);  /* top bar  */
        ctx.fillRect(gx - 8, gy + 8,  36,  2);  /* bot bar  */
        ctx.fillRect(gx - 8, gy - 28, 2,  36);  /* left bar */
        ctx.fillRect(gx + 28,gy - 28, 2,  36);  /* right bar*/
      }

      /* ── Path/ground leading to gate ── */
      ctx.fillStyle = '#1c1008';
      ctx.fillRect(0, 160, W, 8);   /* path stones */
      ctx.fillStyle = '#120c04';
      [20, 60, 100, 150, 200].forEach(px2 => ctx.fillRect(px2, 161, 20, 3));

      /* ── Player walking sprite ── */
      const px = walkX | 0;
      const py = 144;          /* stands on path */
      const leg = animFrame % 2 === 0;

      ctx.save();
      ctx.translate(px, py);

      /* Hood */
      ctx.fillStyle = PAL.CLOAK_DARK;
      ctx.fillRect(5, 0, 6, 2);
      ctx.fillRect(4, 2, 8, 3);
      ctx.fillRect(3, 4, 10, 2);
      /* Face */
      ctx.fillStyle = PAL.SKIN;
      ctx.fillRect(4, 4, 8, 4);
      /* Eyes — looking ahead (right) */
      ctx.fillStyle = PAL.CLOAK_DARK;
      ctx.fillRect(9, 6, 2, 1);
      /* Cloak upper */
      ctx.fillStyle = PAL.CLOAK_MID;
      ctx.fillRect(2, 8, 12, 5);
      /* Cloak lower */
      ctx.fillStyle = PAL.CLOAK_DARK;
      ctx.fillRect(3, 13, 10, 4);
      ctx.fillRect(4, 17, 8,  3);
      /* Weapon — sword hilt visible at side */
      ctx.fillStyle = PAL.STONE_HIGH;
      ctx.fillRect(13, 10, 2, 5);
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(12, 12, 4, 1);
      /* Walking legs */
      ctx.fillStyle = PAL.CLOAK_DARK;
      ctx.fillRect(4, 20 - (leg ? 1 : 0), 4, 6 + (leg ? 1 : 0));
      ctx.fillRect(8, 20 - (leg ? 0 : 1), 4, 6 + (leg ? 0 : 1));

      ctx.restore();

      /* ── Fade overlay between pages — solid blink (NES: no alpha blend) ── */
      if (fadeTimer > 0 && fadeTimer > FADE_FRAMES * 0.5) {
        ctx.fillStyle = PAL.BLACK;
        ctx.fillRect(0, 0, W, H);
        return;   /* skip drawing page during wipe-out half */
      }

      /* ── Text panel — top portion of screen ── */
      /* Solid vignette strip — no alpha */
      ctx.fillStyle = PAL.BLACK;
      ctx.fillRect(0, 0, W, 96);

      /* Page lines — typewriter */
      const vlines = visibleLines(page);
      const textY0 = 12;
      vlines.forEach((line, i) => {
        if (!line) return;
        const col = (i === 0) ? PAL.PALE_GOLD : PAL.WHITE;
        drawPxText(ctx, line, W / 2, textY0 + i * 12, 1, col, 'center');
      });

      ctx.globalAlpha = 1;

      /* ── Page indicator — small dots bottom of text area ── */
      for (let d = 0; d < PAGES.length; d++) {
        const dotX = W/2 - (PAGES.length - 1) * 5 + d * 10;
        ctx.fillStyle = d === page ? PAL.PALE_GOLD : PAL.MIDGRAY;
        ctx.fillRect((dotX - 2) | 0, 89, 4, 2);
      }

      /* ── Hint ── */
      if (G.stateTimer > 60 && Math.floor(G.frame / 40) % 2 === 0) {
        drawPxText(ctx, 'A=NEXT  SELECT=SKIP', W - 4, H - 8, 1, '#2a2a2a', 'right');
      }
    },
  };
})();