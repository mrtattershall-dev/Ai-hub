function updateCorruption(){
  const pct=G.corruption/100;
  const cv=document.getElementById('corrupt-vignette');
  const bo=document.getElementById('blood-overlay');
  cv.style.background=`radial-gradient(ellipse at center, transparent ${42-pct*20}%, rgba(160,0,10,${pct*0.45}) 100%)`;
  cv.style.opacity=pct>0.2?pct:0;
  if(G.bloodDrunk){ bo.style.opacity='0.18'; }
  else { bo.style.opacity='0'; }

  for(let i=0;i<8;i++){
    const n=document.getElementById('wn'+i);
    const wyrdI=Math.floor(G.wyrd);
    if(i<wyrdI) n.className='wn '+(G.bloodDrunk?'blood':G.corruption>72?'corrupt':'lit');
    else n.className='wn';
  }
  if(G.corruption>=100&&!G.bloodDrunk){
    G.bloodDrunk=true; G.bloodDrunkTimer=30;
    document.getElementById('blooddrunk-text').style.opacity='1';
    setTimeout(()=>document.getElementById('blooddrunk-text').style.opacity='0',2800);
    SFX.bloodDrunk();
    showStatusTag('BLOOD-DRUNK','#ff0040');
  }
}