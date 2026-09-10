function renderBoss(){
  const b=G.boss; if(!b) return;
  const hf=b.hp/b.maxHp;
  // Drop shadow
  ctx.fillStyle='rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(b.x,b.y+b.sz,b.sz*1.1,b.sz*0.3,0,0,Math.PI*2); ctx.fill();

  if(b.type==='amalgam'){
    // Tentacles
    for(const t of b.tentacles){
      t.ang+=0.6*(G.ticks%2===0?1:-1)*0.016;
      t.pulse+=2.2*0.016;
      const tl=t.len*(0.85+0.15*Math.sin(t.pulse));
      ctx.strokeStyle=hf>0.5?'#8a1a1a':'#3a0a0a'; ctx.lineWidth=3+2*Math.sin(t.pulse);
      ctx.beginPath();
      ctx.moveTo(b.x,b.y);
      ctx.quadraticCurveTo(
        b.x+Math.cos(t.ang+0.5)*tl*0.6, b.y+Math.sin(t.ang+0.5)*tl*0.6,
        b.x+Math.cos(t.ang)*tl,          b.y+Math.sin(t.ang)*tl
      );
      ctx.stroke();
    }
    // Core body — pulsing mass
    const pulse=0.9+0.1*Math.sin(G.time*4);
    ctx.fillStyle=hf>0.5?'#6a1a1a':'#3a0505';
    ctx.beginPath(); ctx.arc(b.x,b.y,b.sz*pulse,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle=hf>0.5?C.rouge:C.necro; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(b.x,b.y,b.sz*pulse+3,0,Math.PI*2); ctx.stroke();
    // Phase 2: shedding particles
    if(b.phase===2 && G.ticks%8<4){
      ctx.strokeStyle=C.bright; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.arc(b.x,b.y,b.sz+10,0,Math.PI*2); ctx.stroke();
    }

  } else if(b.type==='sovereign'){
    // Rotating arm extensions
    for(let i=0;i<b.armAngs.length;i++){
      const a=b.armAngs[i];
      const al=b.sz+18+(b.phase-1)*8;
      ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(a);
      // Arm rod
      ctx.strokeStyle=hf>0.7?C.iron:hf>0.4?'#6a0a0a':C.rouge;
      ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(al,0); ctx.stroke();
      // Stolen organ icon at arm tip in phase 3
      if(b.phase===3 && b.stolenOrgs[i]){
        const so=ORGANS[b.stolenOrgs[i]];
        ctx.fillStyle=so?.col||C.rouge;
        ctx.beginPath(); ctx.arc(al,0,5,0,Math.PI*2); ctx.fill();
        ctx.fillStyle=C.white; ctx.font='8px serif'; ctx.textAlign='center';
        ctx.fillText(so?.icon||'?',al,3);
      } else {
        ctx.fillStyle=hf>0.4?C.iron:C.rouge;
        ctx.beginPath(); ctx.arc(al,0,4,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
    }
    // Core body — angular, mechanical
    const phase3Glow=b.phase===3&&G.ticks%6<3;
    ctx.fillStyle=phase3Glow?'#3a0000':hf>0.7?'#2a2a3a':hf>0.4?'#3a1a1a':'#1a0000';
    ctx.beginPath(); ctx.arc(b.x,b.y,b.sz,0,Math.PI*2); ctx.fill();
    // Outer ring
    ctx.strokeStyle=b.phase===3?C.bright:b.phase===2?'#8a0a5a':C.iron;
    ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(b.x,b.y,b.sz+5,0,Math.PI*2); ctx.stroke();
    // Inner eye
    ctx.fillStyle=b.phase===3?C.bright:C.rouge;
    ctx.beginPath(); ctx.arc(b.x,b.y,8,0,Math.PI*2); ctx.fill();
  }

  // HP bar above boss
  const bw=b.sz*3;
  ctx.fillStyle='#0d0d10'; ctx.fillRect(b.x-bw,b.y-b.sz-16,bw*2,5);
  ctx.fillStyle=hf>0.5?C.rouge:hf>0.25?'#ff5500':C.bright;
  ctx.fillRect(b.x-bw,b.y-b.sz-16,bw*2*hf,5);
  ctx.fillStyle='rgba(180,180,200,0.5)'; ctx.font='7px Courier New'; ctx.textAlign='center';
  ctx.fillText(b.name,b.x,b.y-b.sz-20);
}