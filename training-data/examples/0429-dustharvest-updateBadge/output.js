function updateBadge(){
  const btn=document.getElementById('dhMpBtn');
  if(mp.isActive()){
    const n = mp.isHost() ? mp.guestCount()+1 : Object.keys(mp.remotePlayers).length+1;
    mpBadge.textContent=`🌐 ${n} PLAYERS`; mpBadge.style.display='block';
    if(btn){btn.classList.add('active');btn.textContent='🌐 CO-OP ●';}
  } else if(mp.role==='host'){
    mpBadge.textContent='🌐 HOSTING…'; mpBadge.style.display='block';
    if(btn){btn.classList.add('active');btn.textContent='🌐 HOSTING';}
  } else {
    mpBadge.style.display='none';
    if(btn){btn.classList.remove('active');btn.textContent='🌐 MULTI';}
  }
}