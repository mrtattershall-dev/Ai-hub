function useTool(wx, wy) {
  if (player.actionCooldown > 0) return;
  const tx  = Math.floor(wx/T), ty = Math.floor(wy/T);
  const key = plotKey(tx, ty);
  const ptx = Math.floor(player.x/T), pty = Math.floor(player.y/T);

  if (_handleMineInteraction())               return;
  if (_handleBLMineInteraction())             return;
  if (_handleMinerInteraction())              return;
  if (_handleMerchantInteraction())           return;
  if (_handleBadlandsEntry())                 return;
  if (_handleHCInteraction())                 return;  // must be before HoboCampEntry so NPCs beat exit
  if (_handleHoboCampEntry())                 return;
  if (_handleOCInteraction())                 return;  // ocean NPC/fishing before exit
  if (typeof _handleJGInteraction==='function' && _handleJGInteraction()) return; // jungle zone
  if (gameState.inJungle) return; // no overworld tools in jungle
  if (_handleMineEntry())                     return;
  // Quick-cook shortcut: second E at campfire executes pending recipe
  if (player._quickCookRecipe) {
    const ptxC=Math.floor(player.x/T), ptyC=Math.floor(player.y/T);
    if (Math.abs(ptxC-CAMPFIRE_TX)<=2 && Math.abs(ptyC-CAMPFIRE_TY)<=2) {
      const rid = player._quickCookRecipe;
      player._quickCookRecipe = null;
      craftItem(rid, 1);
      return;
    }
    player._quickCookRecipe = null;
  }
  if (_handleFishing())                       return;
  if (_handleStationInteraction(tx, ty))      return;
  if (_handleTownBuilding(ptx, pty))          return;

  // Wilderness resource gathering (canvas click path)
  if ((gameState.zone==='Wilderness' || gameState.zone==='Mine') && arguments.length===2) {
    const nearby = getNearbyNode();
    if (nearby) { gatherNode(nearby.key); player.actionCooldown=0.5; return; }
  }

  if (_handleRanchInteraction(tx, ty, wx, wy)) return;
  if (_handleFarmUtility(tx, ty, wx, wy))      return;
  _handleFarmTool(tx, ty, wx, wy, key);
}