function updateComboRank(){
  const idx=Math.min(Math.floor(G.combo/5),4);
  G.comboRank=RANKS[idx];
  const el=document.getElementById('combo-rank');
  const cc=document.getElementById('combo-count');
  el.textContent=G.comboRank;
  if(G.combo>0){ el.className=G.comboRank==='S'?'s-rank':'active'; cc.className='active'; cc.textContent=G.combo+' HIT'; }
  else { el.className=''; cc.className=''; }
}