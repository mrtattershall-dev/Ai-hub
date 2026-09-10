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
  if (_handleMineEntry())                     return;
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