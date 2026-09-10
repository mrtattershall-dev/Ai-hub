function handleSceneClick(mx,my) {
  if (sceneStack.length===0) return;
  const top=sceneStack[sceneStack.length-1];
  const W=canvas.width,H=canvas.height;
  function hit(x,y,w,h){return mx>=x&&mx<=x+w&&my>=y&&my<=y+h;}
  if (top===SceneMenu)     { if(hit(W/2-80,H*0.55,160,38)) pushScene(SceneGame); }
  if (top===SceneGame)     { if(hit(W/2-80,H-100,160,34)) pushScene(ScenePause); if(hit(W/2-80,H-58,160,34)) {popScene();popScene();pushScene(SceneMenu);} }
  if (top===ScenePause)    { if(hit(W/2-80,H*0.55,160,36)) popScene(); if(hit(W/2-80,H*0.67,160,36)) replaceScene(SceneGameOver); }
  if (top===SceneGameOver) { if(hit(W/2-80,H*0.62,160,36)){replaceScene(SceneGame);} if(hit(W/2-80,H*0.74,160,36)){replaceScene(SceneMenu);pushScene(SceneCredits);} }
  if (top===SceneCredits)  { if(hit(W/2-80,H*0.64,160,36)){replaceScene(SceneMenu);} }
}