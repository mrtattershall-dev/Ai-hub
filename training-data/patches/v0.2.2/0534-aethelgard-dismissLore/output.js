function dismissLore(){
  const lp=document.getElementById('lore-popup');
  lp.style.opacity='0';
  setTimeout(()=>{ lp.style.pointerEvents='none'; lp.classList.remove('visible'); },800);
  G.started=true;
  setTimeout(()=>showChapterText('Chapter I','The Ash-Mire'),900);
  document.getElementById('c').requestPointerLock();
}