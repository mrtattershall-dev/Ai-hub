function resize(){
  const sw=window.innerWidth, sh=window.innerHeight;
  const sc=Math.min(sw/W, sh/H);
  canvas.width=W; canvas.height=H;
  canvas.style.width=(W*sc)+'px'; canvas.style.height=(H*sc)+'px';
  canvas.style.position='fixed';
  canvas.style.left=((sw-W*sc)/2)+'px';
  canvas.style.top=((sh-H*sc)/2)+'px';
}