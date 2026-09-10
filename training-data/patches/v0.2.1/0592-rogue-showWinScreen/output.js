function showWinScreen(){
  const ws=document.getElementById('winScreen');
  ws.style.display='flex';
  // Stats
  const s=document.getElementById('wstats');
  s.innerHTML=`<span>${G.kills}</span> ENEMIES KILLED<br><span>${G.graftsEquipped}</span> ORGANS GRAFTED<br><span>${G.tilesTransformed}</span> TILES TRANSFORMED<br><span>10</span> FLOORS CLEARED`;
  // localStorage persistence
  try {
    const prev={
      bestFloor: parseInt(localStorage.getItem('re_bestFloor')||'0'),
      lifeOrgans: parseInt(localStorage.getItem('re_lifeOrgans')||'0'),
      lifeTiles:  parseInt(localStorage.getItem('re_lifeTiles')||'0'),
      runs:       parseInt(localStorage.getItem('re_runs')||'0'),
    };
    const newBestFloor=Math.max(prev.bestFloor,G.floor);
    localStorage.setItem('re_bestFloor',  newBestFloor);
    localStorage.setItem('re_lifeOrgans', prev.lifeOrgans+G.graftsEquipped);
    localStorage.setItem('re_lifeTiles',  prev.lifeTiles+G.tilesTransformed);
    localStorage.setItem('re_runs',       prev.runs+1);
    const b=document.getElementById('wbest');
    b.innerHTML=`LIFETIME — ${prev.runs+1} runs | ${prev.lifeOrgans+G.graftsEquipped} organs | ${prev.lifeTiles+G.tilesTransformed} tiles`;
  } catch(e){}
}