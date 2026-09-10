function renderPlayer(){
  const px=G.px, py=G.py, rf=G.rouge/G.maxRouge;

  // Primary graft arm extension
  if(G.grafts[0]){
    const o=ORGANS[G.grafts[0]];
    const df=Math.max(0,G.graftDecay[0]/o.decay);
    const gc=df>0.35?o.col : df>0.15?C.necro : '#1a0606';
    const angle=Math.atan2(G.my-py,G.mx-px);
    ctx.save(); ctx.translate(px,py); ctx.rotate(angle);
    if(df<0.35&&G.ticks%8<4) ctx.globalAlpha=0.4;
    ctx.fillStyle=gc;
    ctx.fillRect(10,-4,22,8);
    ctx.fillStyle=df>0.35?C.bright : C.necro;
    ctx.fillRect(30,-2,6,4);
    ctx.globalAlpha=1; ctx.restore();
  }
  // Secondary graft (back bulge)
  if(G.grafts[1]){
    const o=ORGANS[G.grafts[1]];
    const df=Math.max(0,G.graftDecay[1]/o.decay);
    ctx.fillStyle=df>0.35?o.col : C.necro;
    if(df<0.35&&G.ticks%8<4) ctx.globalAlpha=0.4;
    ctx.beginPath(); ctx.arc(px-10,py,5,0,Math.PI*2); ctx.fill();
    ctx.globalAlpha=1;
  }

  // Mech body
  const mc=rf>0.6?C.white : rf>0.3?'#b0b0c8' : '#707085';
  ctx.fillStyle=mc; ctx.beginPath(); ctx.arc(px,py,G.psize,0,Math.PI*2); ctx.fill();

  // Rouge ring arc
  ctx.strokeStyle=rf>0.6?C.rouge : rf>0.3?'#ff5555' : C.bright;
  ctx.lineWidth=2.5;
  ctx.beginPath(); ctx.arc(px,py,G.psize+3,-Math.PI/2,-Math.PI/2+rf*Math.PI*2); ctx.stroke();

  // Chassis cracks at low rouge
  if(rf<0.6){
    ctx.strokeStyle=`rgba(186,4,28,${Math.min(0.9,(0.9-rf)*1.5)})`;
    ctx.lineWidth=0.5;
    for(let k=0;k<4;k++){
      const a=(k/4)*Math.PI*2+G.time*0.5;
      ctx.beginPath();
      ctx.moveTo(px+Math.cos(a)*4,py+Math.sin(a)*4);
      ctx.lineTo(px+Math.cos(a)*G.psize,py+Math.sin(a)*G.psize);
      ctx.stroke();
    }
  }
  // Critical strobe ring
  if(rf<0.15&&G.ticks%10<5){
    ctx.strokeStyle=C.bright; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(px,py,G.psize+7,0,Math.PI*2); ctx.stroke();
  }
  // iframes flash (visual feedback that you're invincible)
  if(G.iframes>0&&G.ticks%6<3){
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(px,py,G.psize+4,0,Math.PI*2); ctx.stroke();
  }
}