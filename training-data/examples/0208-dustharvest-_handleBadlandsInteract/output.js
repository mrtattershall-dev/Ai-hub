function _handleBadlandsInteract() {
  if (!gameState.inBadlands) return false;

  const tx=Math.floor(player.x/T), ty=Math.floor(player.y/T);

  // Wanted board (placed near outpost door at buildBadlands time)
  // Railroad sign — deep west
  // BL Mine entrance
  const nearBLMineEntrance = Math.hypot(player.x - blMineEntranceX*T, player.y - blMineEntranceY*T) < T*2.5;
  if (nearBLMineEntrance) { enterBLMine(); return true; }

  const nearSign = Math.hypot(player.x - blRailSignX*T, player.y - blRailSignY*T) < T*2.5;
  if (nearSign) {
    showMsg('📌 The sign is weathered almost to nothing. You can still read it:\n\n“ ALTAVERDE RAILROAD — CLOSED ”\n\nBelow that, someone has scratched four words into the wood with a nail:\n“ they didn\'t go far ”');
    return true;
  }
  const nearBoard = Math.hypot(player.x - blWantedBoardX*T, player.y - blWantedBoardY*T) < T*2.5;
  if (nearBoard) { openBLBountyBoard(); return true; }

  // Fence vendor
  const nearVendor = Math.hypot(player.x - blVendorX*T, player.y - blVendorY*T) < T*2.5;
  if (nearVendor) { openBLVendor(); return true; }

  // Outpost chest
  const nearChest = Math.hypot(player.x - blChestX*T, player.y - blChestY*T) < T*2.5;
  if (nearChest) { openBLChest(); return true; }

  // Deep settlement chest (better loot than outpost chest)
  // Survivor NPC — slightly offset from chest, near center of settlement
  if (_survivorTalkOpen) { closeSurvivorTalk(); return true; }
  const nearSurvivor = Math.hypot(player.x - (blDeepChestX+2)*T, player.y - (blDeepChestY+3)*T) < T*3;
  if (nearSurvivor) { openSurvivorTalk('root'); return true; }
  const nearDeepChest = Math.hypot(player.x - blDeepChestX*T, player.y - blDeepChestY*T) < T*2.5;
  if (nearDeepChest) { openBLDeepChest(); return true; }

  // Campfire rest
  const nearFire = Math.hypot(player.x - blFireX*T, player.y - blFireY*T) < T*2.5;
  if (nearFire) { useBLCampfire(); return true; }

  // Gather node
  const nodeKey = getNearbyBLNode();
  if (nodeKey) { gatherBadlandsNode(nodeKey); return true; }

  // Attack nearby enemy
  const nearEnemy = badlandsEnemies.find(e => Math.hypot(player.x-e.x, player.y-e.y) < 64);
  if (nearEnemy) { attackBadlandsEnemies(); return true; }

  return false;
}