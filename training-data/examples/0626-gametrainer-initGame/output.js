function initGame() {
  if (animId) cancelAnimationFrame(animId);
  gameWon = false;
  resizeCanvas();
  const lesson = LESSONS[app.currentLesson];
  const fns = gameFns[lesson.game];
  gameState = fns.init();
  app.frame = 0;
  app.score = 0;

  function loop() {
    if (!app.paused) {
      const fns2 = gameFns[LESSONS[app.currentLesson].game];
      gameState = fns2.update(gameState, keys, mouse) || gameState;
      fns2.render(gameState);
      app.frame++;
      if (gameState.score !== undefined) app.score = gameState.score;
      document.getElementById('gameStatus').textContent = `Score: ${app.score} | Frame: ${app.frame}`;
      if (gameState.won && !gameWon) {
        gameWon = true;
        setTimeout(showWin, 400);
      }
    }
    animId = requestAnimationFrame(loop);
  }
  animId = requestAnimationFrame(loop);
}