function _drawWeaponIcon(ctx, name, pulse) {
  switch(name) {
    case 'sword':
      ctx.fillStyle = PAL.SWORD_GREY;
      ctx.fillRect(-1, -4, 2, 8);    /* blade */
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(-3, -1, 6, 2);    /* guard */
      ctx.fillStyle = '#8c6030';
      ctx.fillRect(-1, 1,  2, 3);    /* grip */
      ctx.fillStyle = PAL.WHITE;
      ctx.fillRect(-1, -4, 1, 2);    /* tip glint */
      break;
    case 'bone_whip':
      ctx.fillStyle = PAL.LIGHTGRAY;
      for(let i=0;i<4;i++) ctx.fillRect(-5+i*3, -2+i, 2, 2);
      ctx.fillStyle = PAL.STONE_HIGH;
      ctx.fillRect(-6, -3, 3, 2);    /* handle */
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(3, 1, 2, 2);      /* tip */
      break;
    case 'cursed_dagger':
      ctx.fillStyle = PAL.CLOAK_LITE;
      ctx.fillRect(-5, -1, 8, 2);    /* blade */
      ctx.fillStyle = PAL.STONE_HIGH;
      ctx.fillRect(2, -2,  2, 4);    /* guard */
      ctx.fillStyle = PAL.WHITE;
      ctx.fillRect(-5, -1, 2, 1);    /* tip glint */
      ctx.fillStyle = pulse > 0.5 ? '#8866ff' : '#4433aa';
      ctx.fillRect(-5, 0, 7, 1);     /* curse glow line */
      break;
    case 'holy_axe':
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(-2, -5, 4, 8);    /* shaft */
      ctx.fillStyle = PAL.GOLD;
      ctx.fillRect(-5, -5, 3, 6);    /* axe head */
      ctx.fillStyle = PAL.WHITE;
      ctx.fillRect(-5, -5, 2, 2);    /* blade glint */
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(2,  -3, 3, 4);    /* back spike */
      break;
    case 'void_scythe':
      ctx.fillStyle = '#4a3060';
      ctx.fillRect(-1, -5, 2, 9);    /* staff */
      ctx.fillStyle = '#aa66ff';
      ctx.fillRect(-5, -5, 5, 2);    /* blade top */
      ctx.fillRect(-5, -5, 2, 5);    /* blade curve */
      ctx.fillStyle = PAL.WHITE;
      ctx.fillRect(-5, -5, 2, 1);    /* tip */
      if(pulse > 0.5) {
        ctx.fillStyle = 'rgba(170,102,255,0.6)';
        ctx.fillRect(-6,-6, 8, 8);   /* void glow */
      }
      break;
    default:
      ctx.fillStyle = PAL.PALE_GOLD;
      ctx.fillRect(-3, -3, 6, 6);
  }
}