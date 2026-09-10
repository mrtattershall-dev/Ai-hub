function _handleOCInteraction() {
  if (!gameState.inOcean) return false;
  if (ocTalkOpen) { closeOCTalk(); return true; }

  // NPC proximity
  for (const npc of OC_NPCS) {
    const nx = npc.tx*OC_T+OC_T/2, ny = npc.ty*OC_T+OC_T/2;
    if (Math.hypot(player.x-nx, player.y-ny) < 80) {
      openOCTalk(npc.id, 'root');
      return true;
    }
  }

  // Board / disembark boat
  const ptx=Math.floor(player.x/OC_T), pty=Math.floor(player.y/OC_T);

  // Already on boat — E always disembarks, but only if near land or near dock
  if (player._onBoat && hasBoat()) {
    const bTx=Math.floor(gameState.boatX/OC_T), bTy=Math.floor(gameState.boatY/OC_T);
    const landTiles=[OC.SAND,OC.DOCK,OC.GANGPLANK,OC.ROAD,OC.FLOOR,OC.GRASS,OC.WATER];
    let nearLand=false;
    for(let ddy=-3;ddy<=3&&!nearLand;ddy++) for(let ddx=-3;ddx<=3&&!nearLand;ddx++){
      if(landTiles.includes(getOCT(bTx+ddx,bTy+ddy))) nearLand=true;
    }
    if (!nearLand) { showMsg('⚓ Sail closer to land to disembark.'); return true; }
    player._onBoat = false;
    // Step off to nearest walkable tile west of boat
    player.x = gameState.boatX - OC_T*2;
    player.y = gameState.boatY;
    gameState.boatVX = 0; gameState.boatVY = 0;
    showMsg('⚓ Disembarked.');
    return true;
  }

  const nearGangplank = [
    [ptx,pty],[ptx+1,pty],[ptx-1,pty],[ptx,pty+1],[ptx,pty-1]
  ].some(([cx,cy])=>getOCT(cx,cy)===OC.GANGPLANK);

  // Allow boarding when near the boat's current world position
  const nearBoat = hasBoat() &&
    Math.hypot(player.x - gameState.boatX, player.y - gameState.boatY) < OC_T * 3;

  if ((nearGangplank || nearBoat) && hasBoat()) {
    player._onBoat = true;
    if (nearGangplank && !nearBoat) {
      gameState.boatX = 24*OC_T + OC_T/2;
      gameState.boatY = 38*OC_T + OC_T/2;
    }
    gameState.boatVX = 0; gameState.boatVY = 0;
    player.x = gameState.boatX;
    player.y = gameState.boatY;
    showMsg(`${getBoatTier().icon} Aboard the ${getBoatTier().name}. WASD to sail. E to disembark near land.`);
    return true;
  }

  // Fishing — dock, gangplank, boat deck, on the boat, or wading in shallow water
  // But not when near the boat (boarding takes priority)
  const nearBoatAction = hasBoat() &&
    Math.hypot(player.x-gameState.boatX, player.y-gameState.boatY) < OC_T*5;
  const onFishable = !nearBoatAction &&
    ([OC.DOCK,OC.GANGPLANK,OC.BOAT_DECK,OC.WATER].includes(getOCT(ptx,pty)) || player._onBoat);
  if (onFishable && countItem('fishingRod')) {
    castOceanFishing();
    return true;
  }
  if (onFishable && !countItem('fishingRod')) {
    showMsg('🎣 Need a fishing rod — buy one at the market Upgrades tab.');
    return true;
  }

  return false;
}