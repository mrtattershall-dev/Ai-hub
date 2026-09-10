function drawDockmasterNPC(npc, sx, sy) {
  const bob=Math.sin(Date.now()*.0015+npc.tx*.2)*1.2;
  const OL='#141010';

  // Shadow
  ctx.globalAlpha=.18; ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(sx,sy+8,7,3,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;

  // Legs
  ctx.fillStyle=OL; ctx.fillRect(sx-5,sy+4+bob,4,10); ctx.fillRect(sx+1,sy+4+bob,4,10);
  ctx.fillStyle='#203040'; ctx.fillRect(sx-4,sy+4+bob,3,9); ctx.fillRect(sx+2,sy+4+bob,3,9);
  // Rolled boot cuffs
  ctx.fillStyle='#2a3a48'; ctx.fillRect(sx-5,sy+11+bob,4,3); ctx.fillRect(sx+1,sy+11+bob,4,3);

  // Oilskin body — deep teal-grey, practical
  ctx.fillStyle=OL; ctx.fillRect(sx-8,sy-12+bob,16,18);
  ctx.fillStyle='#243830'; ctx.fillRect(sx-7,sy-11+bob,14,16);
  ctx.fillStyle='#2e4838'; ctx.fillRect(sx-7,sy-11+bob,14,2);
  // Lapels
  ctx.fillStyle='#182820'; ctx.fillRect(sx-7,sy-11+bob,4,9); ctx.fillRect(sx+3,sy-11+bob,4,9);
  // Brass buttons
  ctx.fillStyle='#b8901e';
  ctx.fillRect(sx-1,sy-9+bob,2,2); ctx.fillRect(sx-1,sy-5+bob,2,2); ctx.fillRect(sx-1,sy-1+bob,2,2);

  // Head — weathered, practical
  ctx.fillStyle=OL; ctx.fillRect(sx-5,sy-23+bob,10,13);
  ctx.fillStyle='#a06840'; ctx.fillRect(sx-4,sy-22+bob,8,11);
  ctx.fillStyle='#b07850'; ctx.fillRect(sx-4,sy-22+bob,8,2);
  // Squint lines
  ctx.fillStyle='#805030'; ctx.fillRect(sx-3,sy-16+bob,2,1); ctx.fillRect(sx+1,sy-16+bob,2,1);

  // Short weathered hair
  ctx.fillStyle=OL; ctx.fillRect(sx-5,sy-24+bob,10,3);
  ctx.fillStyle='#786030'; ctx.fillRect(sx-4,sy-23+bob,8,2);
  ctx.fillStyle='#988050'; ctx.fillRect(sx-4,sy-23+bob,4,1);

  // Cap — simple peaked work cap, not naval dress
  ctx.fillStyle=OL; ctx.fillRect(sx-7,sy-26+bob,14,2); // brim
  ctx.fillRect(sx-4,sy-31+bob,8,6); // crown
  ctx.fillStyle='#1c2430'; ctx.fillRect(sx-6,sy-25+bob,12,2);
  ctx.fillRect(sx-3,sy-30+bob,6,5);
  ctx.fillStyle='#262e38'; ctx.fillRect(sx-3,sy-30+bob,4,2);

  // Eyes — grey-blue, steady
  ctx.fillStyle='#4c7090'; ctx.fillRect(sx-2,sy-18+bob,1,1); ctx.fillRect(sx+2,sy-18+bob,1,1);

  // Ledger
  ctx.fillStyle=OL; ctx.fillRect(sx+7,sy-6+bob,7,9);
  ctx.fillStyle='#5c3818'; ctx.fillRect(sx+8,sy-5+bob,5,7);
  ctx.fillStyle='#e8e0c0'; ctx.fillRect(sx+9,sy-4+bob,3,5);
  ctx.fillStyle='#906840'; ctx.fillRect(sx+9,sy-3+bob,3,1); ctx.fillRect(sx+9,sy-1+bob,3,1);

  // Interact prompt
  const dist=Math.hypot(player.x-(npc.tx*OC_T+OC_T/2), player.y-(npc.ty*OC_T+OC_T/2));
  if(dist<90){
    const pulse=0.65+Math.sin(Date.now()*.006)*0.35;
    ctx.save(); ctx.globalAlpha=pulse;
    ctx.fillStyle='#d0e8ff'; ctx.font='7px sans-serif'; ctx.textAlign='center';
    ctx.fillText(ocTalkSeen.has('maren_met')?'[E] Maren':'[E] Stranger', sx, sy-36+bob);
    ctx.restore();
  }
}