function spawnEnemies(){
  G.enemies=[];
  [[-8,0],[8,1],[-5,7],[6,-5],[0,-8],[-4,-3],[4,10],[-10,4]].forEach(([x,z])=>G.enemies.push(createEnemy(x,z,'thrall')));
  [[-12,5],[12,-4]].forEach(([x,z])=>G.enemies.push(createEnemy(x,z,'elite')));
  G.boss=createEnemy(0,-18,'boss');
  G.enemies.push(G.boss);
  document.getElementById('boss-hud').style.opacity='0';
}