function setupInput(){
  if(inputBound) return; // prevent stacking on restart
  inputBound=true;

  window.addEventListener('keydown',e=>{
    G.keys[e.key]=true;
    if(['w','s','a','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))
      e.preventDefault();
  });
  window.addEventListener('keyup',e=>{ G.keys[e.key]=false; });

  canvas.addEventListener('mousemove',e=>{
    const r=canvas.getBoundingClientRect();
    G.mx=(e.clientX-r.left)*(W/r.width);
    G.my=(e.clientY-r.top)*(H/r.height);
  });
  canvas.addEventListener('click',e=>{
    if(!G.running) return;
    const r=canvas.getBoundingClientRect();
    G.mx=(e.clientX-r.left)*(W/r.width);
    G.my=(e.clientY-r.top)*(H/r.height);
    playerAttack();
  });
  canvas.addEventListener('contextmenu',e=>{ e.preventDefault(); if(G.running) playerAttack(); });
}