function updateHUD(drain){
  const rf=G.rouge/G.maxRouge;
  document.getElementById('rougeFill').style.height=(rf*100)+'%';
  document.getElementById('rougeNum').textContent=Math.ceil(G.rouge);
  document.getElementById('rougeFill').className=rf<0.3?'pulse':'';
  document.getElementById('drainRate').textContent=drain.toFixed(1)+'/s';
  document.getElementById('killCount').textContent=G.kills+' KILLS';

  const v=document.getElementById('vignette');
  v.className=rf<0.15?'crit':rf<0.3?'warn':'';

  // Boss bar — update every frame for smooth HP
  updateBossHUD();

  // Graft slots
  for(let i=0;i<2;i++){
    const el=document.getElementById('slot'+i);
    const id=G.grafts[i], o=id?ORGANS[id]:null;
    if(!o){
      el.className='graftSlot empty';
      el.querySelector('.gIcon').textContent='⬡';
      el.querySelector('.gName').textContent=i===0?'PRIMARY':'SECONDARY';
      el.querySelector('.gDesc').textContent='';
      el.querySelector('.decayBar').style.width='0%';
      el.style.borderColor='';
    } else {
      const df=Math.max(0,G.graftDecay[i]/o.decay);
      el.className='graftSlot';
      el.querySelector('.gIcon').textContent=o.icon;
      el.querySelector('.gName').textContent=o.name.split('-')[0].toUpperCase();
      el.querySelector('.gDesc').textContent=o.desc;
      const db=el.querySelector('.decayBar');
      db.style.width=(df*100)+'%';
      db.style.background=df>0.35?'#ba041c':df>0.15?'#4f121a':'#1a0606';
      el.style.borderColor=df>0.35?'#ba041c':df>0.15?'#3a0606':'#1a0404';
      // Flicker at low decay
      el.style.opacity=df<0.35&&G.ticks%8<4?'0.5':'1';
    }
  }

  // Pickup hint — show above player when near an organ drop
  const hint=document.getElementById('pickupHint');
  let nearest=null, nd=50;
  for(const d of G.organDrops){
    const dist=Math.hypot(G.px-d.x,G.py-d.y);
    if(dist<nd){ nd=dist; nearest=d; }
  }
  if(nearest&&graftCooldown<=0){
    const o=ORGANS[nearest.org];
    const canvasRect=canvas.getBoundingClientRect();
    const scaleX=canvasRect.width/W, scaleY=canvasRect.height/H;
    hint.style.display='block';
    hint.style.left=(canvasRect.left+G.px*scaleX)+'px';
    hint.style.top=(canvasRect.top+G.py*scaleY-40)+'px';
    hint.textContent=(o?o.name:'ORG')+' — WALK OVER';
  } else {
    hint.style.display='none';
  }

  // Debug iframes
  document.getElementById('iframes').textContent=G.iframes>0?`I-FRAMES ${G.iframes.toFixed(2)}s`:'';
}