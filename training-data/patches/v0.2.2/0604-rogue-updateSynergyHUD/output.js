function updateSynergyHUD(){
  const badge=document.getElementById('sBadge');
  if(!badge) return;
  const syn=activeSynLabel();
  if(syn){
    badge.style.display='block';
    badge.textContent=syn.label+'\n'+syn.desc;
    badge.style.whiteSpace='pre';
  } else {
    badge.style.display='none';
  }
}