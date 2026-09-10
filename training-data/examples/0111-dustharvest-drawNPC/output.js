function drawNPC(npc) {
  const sx=npc.x-gameState.camera.x, sy=npc.y-gameState.camera.y;
  if(sx<-T*3||sx>canvas.width+T*3||sy<-T*3||sy>canvas.height+T*3) return;
  const bob=Math.sin(Date.now()*.0018+npc.x*.01)*1.5;

  // Shadow
  ctx.globalAlpha=.2; ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(sx,sy+8,7,3,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;

  if(npc.name==='Maya (Market)') {
    // Maya — market keeper. Practical apron, bandana, sleeves rolled.
    // Boots
    ctx.fillStyle='#3a2210'; ctx.fillRect(sx-5,sy+4+bob,4,5); ctx.fillRect(sx+1,sy+4+bob,4,5);
    // Skirt/trousers — dark practical
    ctx.fillStyle='#3c3028'; ctx.fillRect(sx-6,sy-4+bob,12,10);
    // Apron over the front
    ctx.fillStyle='#d4b880'; ctx.fillRect(sx-4,sy-10+bob,8,14);
    ctx.fillStyle='#c0a060'; ctx.fillRect(sx-4,sy-10+bob,8,2); // apron waistband
    // Shirt underneath — warm rust
    ctx.fillStyle='#8a4828'; ctx.fillRect(sx-7,sy-14+bob,14,12);
    // Rolled sleeves
    ctx.fillStyle='#8a4828'; ctx.fillRect(sx-10,sy-12+bob,4,7);
    ctx.fillRect(sx+6,sy-12+bob,4,7);
    ctx.fillStyle='#b07040'; ctx.fillRect(sx-10,sy-7+bob,4,3); ctx.fillRect(sx+6,sy-7+bob,4,3);
    // Neck
    ctx.fillStyle='#c09060'; ctx.fillRect(sx-2,sy-18+bob,5,5);
    // Head
    ctx.fillStyle='#c09060'; ctx.fillRect(sx-5,sy-27+bob,10,10);
    // Eyes
    ctx.fillStyle='#3a2818'; ctx.fillRect(sx-3,sy-24+bob,2,2); ctx.fillRect(sx+1,sy-24+bob,2,2);
    ctx.fillStyle='#000'; ctx.fillRect(sx-2,sy-24+bob,1,1); ctx.fillRect(sx+2,sy-24+bob,1,1);
    // Nose, mouth
    ctx.fillStyle='#a07040'; ctx.fillRect(sx-1,sy-22+bob,2,2);
    ctx.fillStyle='#8a4030'; ctx.fillRect(sx-2,sy-19+bob,5,1);
    // Bandana — tied at back, covers hair
    ctx.fillStyle='#8a2018'; ctx.fillRect(sx-5,sy-30+bob,10,4);
    ctx.fillStyle='#6a1808'; ctx.fillRect(sx-5,sy-29+bob,10,1);
    // Knot at side
    ctx.fillRect(sx+4,sy-30+bob,3,4);
    // Hair peeking out
    ctx.fillStyle='#2a1808'; ctx.fillRect(sx-5,sy-27+bob,3,2);
  }
  else if(npc.name==='Trader Rex') {
    // Rex — contracts man. Vest, spectacles, ledger tucked under arm.
    // Boots — polished, slightly nicer
    ctx.fillStyle='#1c1008'; ctx.fillRect(sx-5,sy+4+bob,4,5); ctx.fillRect(sx+1,sy+4+bob,4,5);
    ctx.fillStyle='#141006'; ctx.fillRect(sx-6,sy+7+bob,4,2); ctx.fillRect(sx+2,sy+7+bob,4,2);
    // Trousers — grey-brown
    ctx.fillStyle='#504840'; ctx.fillRect(sx-5,sy-4+bob,4,10); ctx.fillRect(sx+1,sy-4+bob,4,10);
    // Shirt — white/cream
    ctx.fillStyle='#d8cca8'; ctx.fillRect(sx-7,sy-14+bob,14,12);
    // Vest over shirt — dark brown
    ctx.fillStyle='#3a2818'; ctx.fillRect(sx-7,sy-14+bob,5,12); ctx.fillRect(sx+2,sy-14+bob,5,12);
    ctx.fillStyle='#4a3828'; ctx.fillRect(sx-7,sy-14+bob,14,2); // vest collar
    // Vest buttons
    ctx.fillStyle='#c0a050'; ctx.fillRect(sx-1,sy-12+bob,1,1); ctx.fillRect(sx-1,sy-9+bob,1,1); ctx.fillRect(sx-1,sy-6+bob,1,1);
    // Left arm holding ledger
    ctx.fillStyle='#d8cca8'; ctx.fillRect(sx-10,sy-12+bob,4,8);
    // Ledger — brown book under arm
    ctx.fillStyle='#6a3818'; ctx.fillRect(sx-14,sy-8+bob,8,6);
    ctx.fillStyle='#4a2808'; ctx.fillRect(sx-14,sy-8+bob,1,6);
    // Right arm — gesturing
    ctx.fillStyle='#d8cca8'; ctx.fillRect(sx+6,sy-14+bob,4,10);
    // Neck
    ctx.fillStyle='#c09878'; ctx.fillRect(sx-2,sy-18+bob,5,5);
    // Cravat/collar tie
    ctx.fillStyle='#8a1818'; ctx.fillRect(sx-1,sy-17+bob,3,5);
    // Head — thin, angular
    ctx.fillStyle='#c09878'; ctx.fillRect(sx-5,sy-27+bob,10,10);
    // Thinning hair — grey
    ctx.fillStyle='#888078'; ctx.fillRect(sx-5,sy-28+bob,10,3);
    ctx.fillStyle='#c09878'; ctx.fillRect(sx-2,sy-28+bob,5,2); // bald patch
    // Eyes — behind spectacles
    ctx.fillStyle='#4a3828'; ctx.fillRect(sx-3,sy-24+bob,2,2); ctx.fillRect(sx+1,sy-24+bob,2,2);
    ctx.fillStyle='#000'; ctx.fillRect(sx-2,sy-24+bob,1,1); ctx.fillRect(sx+2,sy-24+bob,1,1);
    // Spectacles
    ctx.strokeStyle='rgba(120,100,60,.8)'; ctx.lineWidth=1;
    ctx.strokeRect(sx-4,sy-25+bob,4,3); ctx.strokeRect(sx,sy-25+bob,4,3);
    ctx.beginPath(); ctx.moveTo(sx-4,sy-24+bob); ctx.lineTo(sx,sy-24+bob); ctx.stroke();
    // Mustache
    ctx.fillStyle='#6a5840'; ctx.fillRect(sx-3,sy-20+bob,7,2);
  }
  else if(npc.name==='Farm Hand') {
    // Jed — big, kind, simple. Overalls, straw hat, weathered.
    // Big boots
    ctx.fillStyle='#2c1a08'; ctx.fillRect(sx-6,sy+4+bob,5,6); ctx.fillRect(sx+1,sy+4+bob,6,6);
    ctx.fillStyle='#1c1006'; ctx.fillRect(sx-7,sy+8+bob,5,2); ctx.fillRect(sx+2,sy+8+bob,5,2);
    // Stocky legs — denim overalls
    ctx.fillStyle='#2c4060'; ctx.fillRect(sx-6,sy-6+bob,5,12); ctx.fillRect(sx+1,sy-6+bob,6,12);
    // Overall bib
    ctx.fillStyle='#3a5070'; ctx.fillRect(sx-7,sy-18+bob,14,14);
    // Bib straps
    ctx.fillStyle='#2a3c58'; ctx.fillRect(sx-4,sy-18+bob,3,5); ctx.fillRect(sx+1,sy-18+bob,3,5);
    // Shirt underneath — checked red flannel implied by color patches
    ctx.fillStyle='#8a2818'; ctx.fillRect(sx-7,sy-18+bob,3,12); ctx.fillRect(sx+4,sy-18+bob,3,12);
    // Big arms
    ctx.fillStyle='#8a3820'; ctx.fillRect(sx-11,sy-16+bob,5,12); ctx.fillRect(sx+6,sy-16+bob,5,12);
    // Hands — big calloused
    ctx.fillStyle='#b07848'; ctx.fillRect(sx-11,sy-6+bob,5,5); ctx.fillRect(sx+6,sy-6+bob,5,5);
    // Neck — thick
    ctx.fillStyle='#b07848'; ctx.fillRect(sx-3,sy-22+bob,7,6);
    // Head — round, friendly
    ctx.fillStyle='#b07848'; ctx.fillRect(sx-6,sy-32+bob,12,11);
    // Stubble
    ctx.fillStyle='rgba(60,30,10,.3)'; ctx.fillRect(sx-5,sy-24+bob,10,3);
    // Eyes — wide set, simple
    ctx.fillStyle='#4a7030'; ctx.fillRect(sx-4,sy-29+bob,3,2); ctx.fillRect(sx+1,sy-29+bob,3,2);
    ctx.fillStyle='#000'; ctx.fillRect(sx-3,sy-29+bob,2,2); ctx.fillRect(sx+2,sy-29+bob,2,2);
    // Big nose
    ctx.fillStyle='#a06838'; ctx.fillRect(sx-1,sy-26+bob,3,4);
    // Grin
    ctx.fillStyle='#6a2010'; ctx.fillRect(sx-3,sy-22+bob,7,1);
    // Straw hat — wide, worn
    ctx.fillStyle='#c8a848'; ctx.fillRect(sx-10,sy-35+bob,20,3); // wide brim
    ctx.fillStyle='#b89838'; ctx.fillRect(sx-6,sy-42+bob,12,8); // crown
    ctx.fillStyle='#a08828'; ctx.fillRect(sx-5,sy-36+bob,10,2); // hat band
    // Straw bits sticking out
    ctx.fillStyle='#d0b050';
    ctx.fillRect(sx-11,sy-35+bob,2,1); ctx.fillRect(sx+9,sy-34+bob,2,1);
    ctx.fillRect(sx-10,sy-36+bob,1,2); ctx.fillRect(sx+10,sy-35+bob,1,2);
  } else {
    // Generic fallback for any unnamed NPC
    ctx.fillStyle=npc.color||'#a08060'; ctx.fillRect(sx-6,sy-12+bob,12,16);
    ctx.fillStyle='#d0a880'; ctx.fillRect(sx-4,sy-22+bob,8,11);
  }

  // Name tag
  const nw=npc.name.replace(' (Market)','').length*4.8+10;
  const label=npc.name.replace(' (Market)','');
  ctx.fillStyle='rgba(0,0,0,.65)'; ctx.fillRect(sx-nw/2,sy-38+bob,nw,12);
  ctx.fillStyle='#c8b070'; ctx.font='8px sans-serif'; ctx.textAlign='center';
  ctx.fillText(label,sx,sy-29+bob);

  // Dialog bubble if nearby
  if(Math.hypot(player.x-npc.x,player.y-npc.y)<64){
    const dw=Math.min(npc.dialog.length*4.2+12, 200);
    ctx.fillStyle='rgba(0,0,0,.8)'; ctx.fillRect(sx-dw/2,sy-54+bob,dw,13);
    ctx.fillStyle='#90d8e8'; ctx.font='7px sans-serif';
    ctx.fillText(npc.dialog.slice(0,32)+(npc.dialog.length>32?'…':''),sx,sy-44+bob);
  }
}