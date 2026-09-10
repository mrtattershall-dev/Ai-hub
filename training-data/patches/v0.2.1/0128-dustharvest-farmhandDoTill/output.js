function farmhandDoTill() {
  let done = 0;
  const MAX_TILL = 20;
  let cost = 0;
  for (let ty = 3; ty <= 21 && done < MAX_TILL; ty++) {
    for (let tx = 3; tx <= 21 && done < MAX_TILL; tx++) {
      if (!isFarmTile(tx,ty)) continue;
      const k = plotKey(tx,ty);
      if (plots[k] && plots[k].tilled) continue;
      cost += 3;
      if (player.gold < cost) { cost -= 3; break; }
      if (!plots[k]) plots[k] = {tilled:false,watered:false,crop:null,growthProgress:0,wateredToday:false,wilted:false,harvestReady:false};
      plots[k].tilled = true;
      setT(tx, ty, TL.FARM_TILLED);
      done++;
    }
  }
  cost = Math.max(10, cost);
  player.gold -= cost;
  showMsg(`🧑‍🌾 Jed tilled ${done} plot${done>1?'s':''}. ($${cost} paid)`);
  refreshFarmhandUI();
}