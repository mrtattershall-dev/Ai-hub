function drawTile(ctx, id, px, py, tileCol, tileRow, zpal) {
  const T16 = NES.TILE;
  switch (id) {

    case T.SOLID: {
      /* NES Castlevania brick: base fill, then mortar grid, then top-left highlight */
      ctx.fillStyle = zpal.solidBase;
      ctx.fillRect(px, py, T16, T16);

      /* Mortar joints — 1px lines forming brick grid.
         Horizontal mortar every 8px. Vertical mortars alternate offset per row
         to give the classic running-bond brick pattern. */
      ctx.fillStyle = zpal.solidShad;
      /* Horizontal mortar at row midpoint */
      ctx.fillRect(px, py + 7, T16, 1);
      /* Vertical mortars — alternate offset every row */
      const vOff = (tileRow % 2 === 0) ? 8 : 0;
      ctx.fillRect(px + vOff, py,     1, 7);   /* top half */
      ctx.fillRect(px + vOff, py + 8, 1, 8);  /* bottom half (may be offset) */
      /* Second vertical in bottom half, opposite offset */
      const vOff2 = (tileRow % 2 === 0) ? 0 : 8;
      ctx.fillRect(px + vOff2, py + 8, 1, 8);

      /* Top-left corner highlight — makes bricks feel lit from above-left */
      ctx.fillStyle = zpal.solidTop;
      ctx.fillRect(px,  py, T16, 1);  /* top edge */
      ctx.fillRect(px,  py, 1, 7);    /* left edge top brick */
      ctx.fillRect(px,  py + 8, 1, 8); /* left edge bottom brick */
      /* Individual brick top highlights — subtle */
      if (vOff === 8) {
        ctx.fillRect(px + 9, py, 6, 1);
      } else {
        ctx.fillRect(px + 1, py, 7, 1);
        ctx.fillRect(px + 9, py + 8, 6, 1);
      }
      break;
    }

    case T.PLATFORM: {
      /* NES-style ledge: bright lip, body, dark underside, side notches */
      ctx.fillStyle = zpal.platformTop;
      ctx.fillRect(px, py, T16, 3);            /* bright stone lip */
      ctx.fillStyle = zpal.platformMid;
      ctx.fillRect(px, py + 3, T16, 4);        /* ledge body */
      ctx.fillStyle = zpal.platformBot;
      ctx.fillRect(px, py + 7, T16, 1);        /* underside shadow */
      /* Notch every 8px to break up the horizontal run */
      ctx.fillStyle = zpal.platformTop;
      ctx.fillRect(px + 7, py + 1, 2, 2);      /* stone joint */
      break;
    }

    case T.SPIKE: {
      /* Base plate */
      ctx.fillStyle = zpal.solidShad;
      ctx.fillRect(px, py + 10, T16, 6);
      ctx.fillStyle = zpal.solidBase;
      ctx.fillRect(px, py + 11, T16, 4);
      /* Two sharp spikes */
      for (let s = 0; s < 2; s++) {
        const sx = px + 2 + s * 8;
        ctx.fillStyle = PAL.STONE_LITE;
        ctx.fillRect(sx,     py + 10, 4, 2);   /* spike base */
        ctx.fillStyle = PAL.LIGHTGRAY;
        ctx.fillRect(sx + 1, py + 7,  2, 3);   /* spike shaft */
        ctx.fillStyle = PAL.WHITE;
        ctx.fillRect(sx + 1, py + 5,  2, 2);   /* spike tip */
        ctx.fillStyle = PAL.MIDGRAY;
        ctx.fillRect(sx + 1, py + 5,  1, 1);   /* tip shadow */
      }
      break;
    }

    case T.DOOR_UP: {
      /* Arched passage upward — dark void framed by stone pillar */
      ctx.fillStyle = PAL.CLOAK_DARK;
      ctx.fillRect(px, py, T16, T16);
      /* Pillar sides — 3px with carved detail */
      ctx.fillStyle = zpal.solidBase;
      ctx.fillRect(px,         py, 3, T16);
      ctx.fillRect(px + T16-3, py, 3, T16);
      ctx.fillStyle = zpal.solidTop;
      ctx.fillRect(px,         py, 1, T16);
      ctx.fillRect(px + T16-1, py, 1, T16);
      /* Lintel — gold accent */
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(px + 3, py, T16 - 6, 2);
      /* Arrow indicator */
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(px + 7,  py + 5, 2, 7);
      ctx.fillRect(px + 5,  py + 7, 6, 2);
      ctx.fillRect(px + 6,  py + 5, 4, 2);
      break;
    }

    case T.DOOR_L: {
      ctx.fillStyle = PAL.CLOAK_DARK;
      ctx.fillRect(px, py, T16, T16);
      ctx.fillStyle = zpal.solidBase;
      ctx.fillRect(px, py,         T16, 3);
      ctx.fillRect(px, py + T16-3, T16, 3);
      ctx.fillStyle = zpal.solidTop;
      ctx.fillRect(px, py, T16, 1);
      ctx.fillRect(px, py + T16-1, T16, 1);
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(px, py + 3, 2, T16 - 6);
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(px + 3, py + 7, 9, 2);
      ctx.fillRect(px + 3, py + 5, 2, 6);
      ctx.fillRect(px + 5, py + 5, 2, 2);
      break;
    }

    case T.DOOR_R: {
      ctx.fillStyle = PAL.CLOAK_DARK;
      ctx.fillRect(px, py, T16, T16);
      ctx.fillStyle = zpal.solidBase;
      ctx.fillRect(px, py,         T16, 3);
      ctx.fillRect(px, py + T16-3, T16, 3);
      ctx.fillStyle = zpal.solidTop;
      ctx.fillRect(px, py, T16, 1);
      ctx.fillRect(px, py + T16-1, T16, 1);
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(px + T16-2, py + 3, 2, T16 - 6);
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(px + 4,  py + 7, 9, 2);
      ctx.fillRect(px + 11, py + 5, 2, 6);
      ctx.fillRect(px + 9,  py + 5, 2, 2);
      break;
    }

    case T.DOOR_D: {
      ctx.fillStyle = PAL.CLOAK_DARK;
      ctx.fillRect(px, py, T16, T16);
      ctx.fillStyle = zpal.solidBase;
      ctx.fillRect(px,         py, 3, T16);
      ctx.fillRect(px + T16-3, py, 3, T16);
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(px + 3, py + T16-2, T16-6, 2);
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(px + 7, py + 4, 2, 7);
      ctx.fillRect(px + 5, py + 9, 6, 2);
      ctx.fillRect(px + 6, py + 9, 4, 2);
      break;
    }

    /* LORE + WEAPON drawn per-frame in drawDynamicPickups */
    default: break;
  }
}