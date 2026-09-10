function useConsumable(itemId) {
  if (countItem(itemId) <= 0) { showMsg('None left!'); return; }
  if (itemId==='bread')          { player.stamina=Math.min(player.maxStamina,player.stamina+25); showMsg('🍞 Ate bread — +25 stamina.'); }
  else if (itemId==='potion')    { player.hp=Math.min(player.maxHp,player.hp+40); showMsg('🧪 Drank potion — +40 HP.'); }
  else if (itemId==='bigPotion') { player.hp=Math.min(player.maxHp,player.hp+80); showMsg('🫙 Big Potion — +80 HP!'); }
  // ── Crafted consumables ──────────────────────────────────────────────────────
  else if (itemId==='bandage')      { player.hp=Math.min(player.maxHp,player.hp+20); showMsg('🩹 Bandaged up — +20 HP.'); }
  else if (itemId==='healHerb')     { player.hp=Math.min(player.maxHp,player.hp+30); if(player._poisoned){player._poisoned=false;player._poisonTimer=0;showMsg('🌿 Fever root — +30 HP, poison cleared.');}else{showMsg('🌿 Fever root — +30 HP.');} }
  else if (itemId==='poultice')     { player.hp=Math.min(player.maxHp,player.hp+35); showMsg('🌿 Herb Poultice — +35 HP.'); }
  else if (itemId==='dustloaf')     { player.stamina=Math.min(player.maxStamina,player.stamina+50); showMsg('🍞 Dustloaf — +50 stamina!'); }
  else if (itemId==='eggMeal')      { player.hp=Math.min(player.maxHp,player.hp+30); player.stamina=Math.min(player.maxStamina,player.stamina+20); showMsg('🍳 Egg Meal — +30 HP, +20 stamina!'); }
  else if (itemId==='pepperStew')   { player.hp=Math.min(player.maxHp,player.hp+40); player.stamina=Math.min(player.maxStamina,player.stamina+35); player._speedBoostTimer=(player._speedBoostTimer||0)+30; showMsg('🥣 Pepper Stew — +40 HP, +35 stamina, speed boost 30s!'); }
  else if (itemId==='potatoMash')   { player.stamina=Math.min(player.maxStamina,player.stamina+60); showMsg('🥔 Potato Mash — +60 stamina!'); }
  else if (itemId==='berryJam')     { player.hp=Math.min(player.maxHp,player.hp+25); showMsg('🫐 Berry Jam — +25 HP!'); }
  else if (itemId==='lavenderTea')  { player.hp=Math.min(player.maxHp,player.hp+30); player._regenBoostTimer=(player._regenBoostTimer||0)+60; showMsg('💜 Lavender Tea — +30 HP, stamina regen boosted 60s!'); }
  else if (itemId==='porkRoast')    { player.hp=Math.min(player.maxHp,player.hp+50); player.stamina=Math.min(player.maxStamina,player.stamina+40); showMsg('🥩 Pork Roast — +50 HP, +40 stamina!'); }
  else if (itemId==='goatCheese')   { player.hp=Math.min(player.maxHp,player.hp+20); showMsg('🧀 Goat Cheese — +20 HP!'); }
  else if (itemId==='garlicBread')  { player.stamina=Math.min(player.maxStamina,player.stamina+40); showMsg('🫓 Garlic Bread — +40 stamina!'); }
  else if (itemId==='watermelonSlice') { player.hp=Math.min(player.maxHp,player.hp+20); showMsg('🍉 Watermelon Slice — +20 HP! Refreshing.'); }
  else if (itemId==='rosehipTonic') { player.hp=Math.min(player.maxHp,player.hp+45); player._venomTimer=0; showMsg('🌹 Rosehip Tonic — +45 HP, venom cured!'); }
  else if (itemId==='mushroomSoup') { player.hp=Math.min(player.maxHp,player.hp+35); player.stamina=Math.min(player.maxStamina,player.stamina+60); showMsg('🍄 Mushroom Soup — +35 HP, +60 stamina!'); }
  else if (itemId==='strawberryPreserves') { player.hp=Math.min(player.maxHp,player.hp+30); showMsg('🍓 Strawberry Preserves — +30 HP!'); }
  else if (itemId==='fishStew')      { player.hp=Math.min(player.maxHp,player.hp+50); player.stamina=Math.min(player.maxStamina,player.stamina+30); showMsg('🍲 Fish Stew — +50 HP, +30 stamina!'); }
  else if (itemId==='saltChowder')   { player.hp=Math.min(player.maxHp,player.hp+60); player.stamina=Math.min(player.maxStamina,player.stamina+35); showMsg('🥣 Salt Chowder — +60 HP, +35 stamina!'); }
  else if (itemId==='crabBisque')    { player.hp=Math.min(player.maxHp,player.hp+45); player.stamina=Math.min(player.maxStamina,player.stamina+50); showMsg('🍵 Crab Bisque — +45 HP, +50 stamina!'); }
  else if (itemId==='grilledGrouper'){ player.hp=Math.min(player.maxHp,player.hp+70); showMsg('🍽 Grilled Grouper — +70 HP!'); }
  else if (itemId==='swordfishSteak'){ player.hp=Math.min(player.maxHp,player.hp+90); player.stamina=Math.min(player.maxStamina,player.stamina+60); showMsg('🥩 Swordfish Steak — +90 HP, +60 stamina!'); }
  else if (itemId==='oysterPlate')   { player.hp=Math.min(player.maxHp,player.hp+30); player.stamina=Math.min(player.maxStamina,player.stamina+25); showMsg('🦪 Oyster Plate — +30 HP, +25 stamina!'); }
  else if (itemId==='craftedTorch') { showMsg('🔦 Torch equipped — bring it into the mine.'); return; }
  else if (itemId==='beeswaxCandle') { useBeeswaxCandle(); return; }
  else { showMsg('Can\'t use ' + (ITEMS[itemId]?.name||itemId) + ' from here.'); return; }
  restoreHunger(itemId);
  removeItem(itemId, 1);
}