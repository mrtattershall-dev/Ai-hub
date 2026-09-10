function getZone(px,py) {
  if (gameState.inBadlands) return 'Badlands';
  if (gameState.inHoboCamp) return 'Hobo Camp';
  if (gameState.inOcean) return 'The Dock';
  if (gameState.inJungle) return 'The Eastern Coast';
  const tx=Math.floor(px/T), ty=Math.floor(py/T);
  if (ty<36) { if(tx<34) return 'Farm'; if(tx>45) return 'Town'; return 'Road'; }
  if (tx<RANCH_ZONE_X_MAX&&ty>=RANCH_ZONE_Y_MIN&&ty<RANCH_ZONE_Y_MAX) return 'Ranch';
  if (tx>=58&&ty>=58) return 'Mine';
  return 'Wilderness';
}