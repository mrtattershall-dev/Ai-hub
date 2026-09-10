function renderEnemies(){
  for(const e of G.enemies){
    // Drop shadow
    ctx.fillStyle='rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(e.x,e.y+e.sz,e.sz*0.9,e.sz*0.28,0,0,Math.PI*2); ctx.fill();
    // Body
    ctx.fillStyle=e.col; ctx.beginPath(); ctx.arc(e.x,e.y,e.sz,0,Math.PI*2); ctx.fill();
    // Elite: gold pulsing ring
    if(e.elite){
      const ep=0.5+0.5*Math.sin(G.time*4+e.x);
      ctx.strokeStyle=C.gold; ctx.lineWidth=1.5; ctx.globalAlpha=0.4+ep*0.5;
      ctx.beginPath(); ctx.arc(e.x,e.y,e.sz+4,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
    // Revenant teleport wind-up
    if(e.type==='revenant'&&e.teleT>0){
      ctx.strokeStyle='#8a0a5a'; ctx.lineWidth=2; ctx.globalAlpha=e.teleT/0.3;
      ctx.beginPath(); ctx.arc(e.x,e.y,e.sz+8,0,Math.PI*2); ctx.stroke();
      ctx.globalAlpha=1;
    }
    // Leech latch indicator when on player
    if(e.leech&&Math.hypot(e.x-G.px,e.y-G.py)<e.sz+G.psize+4){
      ctx.strokeStyle='#4a1a3a'; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(e.x,e.y); ctx.lineTo(G.px,G.py); ctx.stroke();
    }
    // Charger wind-up pulse
    if(e.type==='charger'&&!e.charging&&e.chargeWait<=0.5){
      ctx.strokeStyle=C.gold; ctx.lineWidth=2;
      ctx.beginPath(); ctx.arc(e.x,e.y,e.sz+3,0,Math.PI*2); ctx.stroke();
    }
    // HP bar
    const hf=e.hp/e.maxHp;
    ctx.fillStyle='#0d0d10';  ctx.fillRect(e.x-e.sz,e.y-e.sz-8,e.sz*2,3);
    ctx.fillStyle=hf>0.5?'#2a6a2a':'#ba041c'; ctx.fillRect(e.x-e.sz,e.y-e.sz-8,e.sz*2*hf,3);
    // Name
    ctx.fillStyle='rgba(180,180,200,0.4)'; ctx.font='6px Courier New'; ctx.textAlign='center';
    ctx.fillText(e.name,e.x,e.y+e.sz+10);
  }
}