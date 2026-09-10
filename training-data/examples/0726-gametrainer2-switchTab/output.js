function switchTab(t){
  app.tab=t;
  ['concept','ai','score'].forEach(n=>{
    const el=document.getElementById('panel'+n[0].toUpperCase()+n.slice(1));
    el.classList.toggle('hidden',n!==t);
    document.getElementById('tab'+n[0].toUpperCase()+n.slice(1)).classList.toggle('active',n===t);
  });
  document.getElementById('chatInputArea').style.display=t==='ai'?'flex':'none';
  if (t==='score') updateProgress();
}