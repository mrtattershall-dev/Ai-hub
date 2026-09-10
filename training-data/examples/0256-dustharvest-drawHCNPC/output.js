function drawHCNPC(npc, sx, sy) {
  const bob=Math.sin(Date.now()*.0018+npc.tx*.1)*1.5;
  const OL='#181818';

  // Shadow
  ctx.globalAlpha=.2; ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(sx,sy+8,7,3,0,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;

  // Body — base shape, then role-specific details
  if(npc.id==='hc_railroad'){
    // Dale — big, worn, work-roughened. Dark shirt, suspenders, cap.
    ctx.fillStyle=OL; ctx.fillRect(sx-8,sy-15,16,26);
    ctx.fillStyle='#3a3028'; ctx.fillRect(sx-7,sy-14,14,24); // dark work clothes
    ctx.fillStyle='#5a4838'; ctx.fillRect(sx-7,sy-14,14,2);  // shoulder highlight
    // Suspenders
    ctx.fillStyle='#7a3818'; ctx.fillRect(sx-2,sy-14,2,12); ctx.fillRect(sx,sy-14,2,12);
    // Head
    ctx.fillStyle=OL; ctx.fillRect(sx-5,sy-25,10,12);
    ctx.fillStyle='#c09878'; ctx.fillRect(sx-4,sy-24,8,10);
    ctx.fillStyle='#d0a888'; ctx.fillRect(sx-4,sy-24,8,2);
    // Railroad worker cap
    ctx.fillStyle=OL; ctx.fillRect(sx-6,sy-27,12,4);
    ctx.fillStyle='#2a2018'; ctx.fillRect(sx-5,sy-26,10,3);
    ctx.fillStyle='#3a3028'; ctx.fillRect(sx-5,sy-26,7,2);
    ctx.fillStyle='#2a2018'; ctx.fillRect(sx-6,sy-25,14,2); // brim
  } else if(npc.id==='hc_clerk'){
    // Vera — slight, precise. City clothes gone to rags. Hair pinned up.
    ctx.fillStyle=OL; ctx.fillRect(sx-6,sy-14,12,22);
    ctx.fillStyle='#506048'; ctx.fillRect(sx-5,sy-13,10,20); // faded city green
    ctx.fillStyle='#607058'; ctx.fillRect(sx-5,sy-13,10,2);
    // Collar
    ctx.fillStyle='#c8b890'; ctx.fillRect(sx-2,sy-13,4,3);
    // Head
    ctx.fillStyle=OL; ctx.fillRect(sx-5,sy-25,10,12);
    ctx.fillStyle='#c8a070'; ctx.fillRect(sx-4,sy-24,8,10);
    ctx.fillStyle='#d8b080'; ctx.fillRect(sx-4,sy-24,8,2);
    // Hair pinned up — dark bun
    ctx.fillStyle=OL; ctx.fillRect(sx-5,sy-28,10,5);
    ctx.fillStyle='#281808'; ctx.fillRect(sx-4,sy-27,8,4);
    ctx.fillStyle='#382010'; ctx.fillRect(sx-4,sy-27,5,2);
    // Spectacles (she squints at documents all day)
    ctx.strokeStyle='rgba(140,120,60,.7)'; ctx.lineWidth=1;
    ctx.strokeRect(sx-4,sy-21,3,2); ctx.strokeRect(sx,sy-21,3,2);
    ctx.beginPath(); ctx.moveTo(sx-4,sy-20); ctx.lineTo(sx,sy-20); ctx.stroke();
  } else if(npc.id==='hc_farmer'){
    // Simons — stooped, weathered. Old overalls, no hat.
    ctx.fillStyle=OL; ctx.fillRect(sx-7,sy-13,14,22);
    ctx.fillStyle='#3a4858'; ctx.fillRect(sx-6,sy-12,12,20); // worn denim
    ctx.fillStyle='#4a5868'; ctx.fillRect(sx-6,sy-12,12,2);
    // Overalls bib
    ctx.fillStyle='#4a5868'; ctx.fillRect(sx-4,sy-12,8,8);
    ctx.fillStyle='#3a4858'; ctx.fillRect(sx-3,sy-12,2,4); ctx.fillRect(sx+1,sy-12,2,4);
    // Head — older, gaunt
    ctx.fillStyle=OL; ctx.fillRect(sx-5,sy-24,10,12);
    ctx.fillStyle='#b88868'; ctx.fillRect(sx-4,sy-23,8,10);
    ctx.fillStyle='#c89878'; ctx.fillRect(sx-4,sy-23,8,2);
    // Grey thinning hair
    ctx.fillStyle='#888078'; ctx.fillRect(sx-4,sy-25,8,3);
    ctx.fillStyle='#b88868'; ctx.fillRect(sx-1,sy-25,3,2);
    // Worn expression
    ctx.fillStyle=OL; ctx.fillRect(sx-3,sy-20,2,2); ctx.fillRect(sx+1,sy-20,2,2);
    ctx.fillStyle='#3a2810'; ctx.fillRect(sx-2,sy-20,2,2); ctx.fillRect(sx+2,sy-20,2,2);
  } else if(npc.id==='hc_doctor'){
    // Dr. Lena — practical. Rolled sleeves. Medical bag nearby.
    ctx.fillStyle=OL; ctx.fillRect(sx-6,sy-14,12,22);
    ctx.fillStyle='#c8b898'; ctx.fillRect(sx-5,sy-13,10,20); // white coat, yellowed
    ctx.fillStyle='#d8c8a8'; ctx.fillRect(sx-5,sy-13,10,2);
    // Coat lapels
    ctx.fillStyle='#a89878'; ctx.fillRect(sx-5,sy-13,3,10); ctx.fillRect(sx+2,sy-13,3,10);
    // Head
    ctx.fillStyle=OL; ctx.fillRect(sx-5,sy-25,10,12);
    ctx.fillStyle='#b89070'; ctx.fillRect(sx-4,sy-24,8,10);
    ctx.fillStyle='#c8a080'; ctx.fillRect(sx-4,sy-24,8,2);
    // Dark hair, pulled back
    ctx.fillStyle=OL; ctx.fillRect(sx-5,sy-27,10,4);
    ctx.fillStyle='#201008'; ctx.fillRect(sx-4,sy-26,8,3);
    ctx.fillStyle='#302010'; ctx.fillRect(sx-4,sy-26,5,2);
    // Medical bag (small crate beside them)
    ctx.fillStyle=OL; ctx.fillRect(sx+7,sy+2,8,6);
    ctx.fillStyle='#8a6028'; ctx.fillRect(sx+8,sy+3,6,4);
    ctx.fillStyle='#c8b870'; ctx.fillRect(sx+9,sy+3,1,4); ctx.fillRect(sx+8,sy+5,6,1);
  } else {
    // Kit — young, light pack, hopeful posture
    ctx.fillStyle=OL; ctx.fillRect(sx-6,sy-13,12,21);
    ctx.fillStyle='#4878a0'; ctx.fillRect(sx-5,sy-12,10,19); // blue shirt
    ctx.fillStyle='#5888b0'; ctx.fillRect(sx-5,sy-12,10,2);
    // Backpack
    ctx.fillStyle=OL; ctx.fillRect(sx+4,sy-10,6,10);
    ctx.fillStyle='#8a6038'; ctx.fillRect(sx+5,sy-9,4,8);
    ctx.fillStyle='#7a5028'; ctx.fillRect(sx+5,sy-9,2,8);
    // Head — young, round
    ctx.fillStyle=OL; ctx.fillRect(sx-5,sy-24,10,12);
    ctx.fillStyle='#c89868'; ctx.fillRect(sx-4,sy-23,8,10);
    ctx.fillStyle='#d8a878'; ctx.fillRect(sx-4,sy-23,8,3);
    // Hair — short, messy
    ctx.fillStyle=OL; ctx.fillRect(sx-5,sy-26,10,4);
    ctx.fillStyle='#502808'; ctx.fillRect(sx-4,sy-25,8,3);
    ctx.fillStyle='#603010'; ctx.fillRect(sx-4,sy-25,5,2);
    // Bright eyes — optimistic
    ctx.fillStyle=OL; ctx.fillRect(sx-3,sy-20,2,2); ctx.fillRect(sx+1,sy-20,2,2);
    ctx.fillStyle='#3858a0'; ctx.fillRect(sx-2,sy-20,2,2); ctx.fillRect(sx+2,sy-20,2,2);
    ctx.fillStyle='#000'; ctx.fillRect(sx-2,sy-20,1,1); ctx.fillRect(sx+2,sy-20,1,1);
    ctx.fillStyle='#fff'; ctx.fillRect(sx-1,sy-21,1,1); ctx.fillRect(sx+3,sy-21,1,1);
  }

  // Name + role tag
  const label=`${npc.name} · ${npc.role}`;
  const nw=label.length*4.5+10;
  ctx.fillStyle='rgba(0,0,0,.72)'; ctx.fillRect(sx-nw/2,sy-38+bob,nw,13);
  ctx.fillStyle='#c8b870'; ctx.font='8px sans-serif'; ctx.textAlign='center';
  ctx.fillText(label, sx, sy-28+bob);

  // Dialog bubble if nearby
  const dist=Math.hypot(player.x-(npc.tx*HC_T+HC_T/2), player.y-(npc.ty*HC_T+HC_T/2));
  if(dist<72){
    const met = hcTalkSeen.has(npc.id.replace('hc_','')+'_met') ||
                hcTalkSeen.has(npc.id==='hc_railroad'?'dale_met':
                               npc.id==='hc_clerk'?'vera_met':
                               npc.id==='hc_farmer'?'simons_met':
                               npc.id==='hc_doctor'?'lena_met':'kit_met');
    const pulse = 0.6+Math.sin(Date.now()*.005)*0.35;
    ctx.save(); ctx.globalAlpha=pulse;
    ctx.fillStyle='#c8b870'; ctx.font='bold 8px sans-serif'; ctx.textAlign='center';
    ctx.fillText('[E] Talk', sx, sy-42+bob);
    ctx.restore();
  }
}