function renderScenes() {
  const W=canvas.width,H=canvas.height;
  sceneStack[sceneStack.length-1]?.render(W,H);
  // Scene stack indicator
  ctx.fillStyle='#1a1710cc'; ctx.fillRect(10,canvas.height-28,canvas.width-20,20);
  ctx.fillStyle='#4a4838'; ctx.font='10px monospace'; ctx.textAlign='center';
  ctx.fillText('Visited: '+[...scenesVisited].join(' → ')+'  ('+scenesVisited.size+'/5)', canvas.width/2, canvas.height-15);
  ctx.textAlign='left';
}