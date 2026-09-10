function drawTile(ctx, id, px, py, tileCol, tileRow, zpal) {
  const T16 = NES.TILE;
  switch (id) {

    case T.SOLID: {
      ctx.fillStyle = zpal.solidBase;
      ctx.fillRect(px, py, T16, T16);
      /* top highlight */
      ctx.fillStyle = zpal.solidTop;
      ctx.fillRect(px, py, T16, 2);
      /* right + bottom shadow */
      ctx.fillStyle = zpal.solidShad;
      ctx.fillRect(px + T16 - 2, py, 2, T16);
      ctx.fillRect(px, py + T16 - 2, T16, 2);
      /* brick seam — horizontal, alternates x-offset every row */
      const seamX = px + ((tileRow % 2 === 0) ? 0 : 8);
      ctx.fillRect(seamX, py + 8, 8, 1);
      break;
    }

    case T.PLATFORM: {
      /* Transparent base (air) — nothing. Just the ledge surface. */
      ctx.fillStyle = zpal.platformTop;
      ctx.fillRect(px, py, T16, 2);           /* bright lip */
      ctx.fillStyle = zpal.platformMid;
      ctx.fillRect(px, py + 2, T16, 4);       /* ledge body */
      ctx.fillStyle = zpal.platformBot;
      ctx.fillRect(px, py + 6, T16, 2);       /* underside */
      break;
    }

    case T.SPIKE: {
      ctx.fillStyle = zpal.solidShad;
      ctx.fillRect(px, py + 8, T16, 8);       /* base plate */
      /* Two spikes — pixel-art triangles via stacked fillRects */
      for (let s = 0; s < 2; s++) {
        const sx = px + 2 + s * 8;
        ctx.fillStyle = PAL.BLOOD_RED;
        ctx.fillRect(sx,     py + 12, 4, 4);  /* spike base */
        ctx.fillStyle = PAL.FIRE_RED;
        ctx.fillRect(sx + 1, py + 8,  2, 4);  /* spike mid */
        ctx.fillStyle = PAL.LIGHTGRAY;
        ctx.fillRect(sx + 1, py + 6,  2, 2);  /* spike tip */
      }
      break;
    }

    case T.DOOR_UP: {
      ctx.fillStyle = PAL.CLOAK_DARK;
      ctx.fillRect(px, py, T16, T16);
      ctx.fillStyle = PAL.STONE_MID;
      ctx.fillRect(px, py, 2, T16);            /* left pillar */
      ctx.fillRect(px + T16 - 2, py, 2, T16); /* right pillar */
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(px + 2, py, T16 - 4, 2);   /* lintel */
      /* up arrow */
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(px + 7, py + 4, 2, 8);
      ctx.fillRect(px + 4, py + 6, 8, 2);
      ctx.fillRect(px + 5, py + 4, 6, 2);
      break;
    }

    case T.DOOR_L: {
      ctx.fillStyle = PAL.CLOAK_DARK;
      ctx.fillRect(px, py, T16, T16);
      ctx.fillStyle = PAL.STONE_MID;
      ctx.fillRect(px, py, T16, 2);
      ctx.fillRect(px, py + T16 - 2, T16, 2);
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(px, py + 2, 2, T16 - 4);
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(px + 4, py + 7, 8, 2);
      ctx.fillRect(px + 4, py + 5, 2, 6);
      ctx.fillRect(px + 6, py + 5, 2, 2);
      break;
    }

    case T.DOOR_R: {
      ctx.fillStyle = PAL.CLOAK_DARK;
      ctx.fillRect(px, py, T16, T16);
      ctx.fillStyle = PAL.STONE_MID;
      ctx.fillRect(px, py, T16, 2);            /* top lintel */
      ctx.fillRect(px, py + T16 - 2, T16, 2); /* bottom sill */
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(px + T16 - 2, py + 2, 2, T16 - 4); /* right accent */
      /* right-pointing arrow */
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(px + 4, py + 7, 8, 2);
      ctx.fillRect(px + 10, py + 5, 2, 6);
      ctx.fillRect(px + 8,  py + 5, 2, 2);
      break;
    }

    /* LORE + WEAPON are dynamic — drawn per-frame in drawDynamicPickups */
    default: break;
  }
}