function initGame() {
  if (animId) cancelAnimationFrame(animId);
  gameWon=false; resize();
  const fns=gameFns[LESSONS[app.cur].game];
  gs=fns.init(); app.frame=0;
  if (LESSONS[app.cur].game==='astar') setTimeout(()=>resetAstar(gs),100);
  function loop(){
    if (!app.paused){
      const fns2=gameFns[LESSONS[app.cur].game];
      fns2.update(gs,keys,mouse);
      fns2.render(gs,canvas.width,canvas.height);
      mouse.click=false;
      app.frame++;
      document.getElementById('gstatus').textContent=`Frame: ${app.frame}`;
      if (gs.won&&!gameWon){ gameWon=true; setTimeout(showWin,500); }
    }
    animId=requestAnimationFrame(loop);
  }
  animId=requestAnimationFrame(loop);
}