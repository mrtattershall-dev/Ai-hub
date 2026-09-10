function useConsumable(itemId) {
  if (countItem(itemId) <= 0) { showMsg('None left!'); return; }
  // Fridge bonus: cooked food gives 20% more HP/stamina when player has an icebox
  const _fridge = getHomeFridgeBonus();
  function _hp(v)  { return Math.round(v * _fridge); }
  function _st(v)  { return Math.round(v * _fridge); }
  if (itemId==='bread')          { player.stamina=Math.min(player.maxStamina,player.stamina+_st(25)); showMsg('🍞 Ate bread — +'+_st(25)+' stamina.'); }
  else if (itemId==='potion')    { player.hp=Math.min(player.maxHp,player.hp+40); showMsg('🧪 Drank potion — +40 HP.'); }
  else if (itemId==='bigPotion') { player.hp=Math.min(player.maxHp,player.hp+80); showMsg('🫙 Big Potion — +80 HP!'); }
  // ── Crafted consumables ──────────────────────────────────────────────────────
  else if (itemId==='bandage')      { player.hp=Math.min(player.maxHp,player.hp+20); showMsg('🩹 Bandaged up — +20 HP.'); }
  else if (itemId==='healHerb')     { player.hp=Math.min(player.maxHp,player.hp+30); if(player._poisoned){player._poisoned=false;player._poisonTimer=0;showMsg('🌿 Fever root — +30 HP, poison cleared.');}else{showMsg('🌿 Fever root — +30 HP.');} }
  else if (itemId==='poultice')     { player.hp=Math.min(player.maxHp,player.hp+35); if(player._poisoned){player._poisoned=false;player._poisonTimer=0;showMsg('🌿 Herb Poultice — +35 HP, poison cleared.');} else {showMsg('🌿 Herb Poultice — +35 HP.');} }

  else if (itemId==='dustloaf')     { player.stamina=Math.min(player.maxStamina,player.stamina+50); showMsg('🍞 Dustloaf — +50 stamina!'); }
  else if (itemId==='eggMeal')      { player.hp=Math.min(player.maxHp,player.hp+_hp(30)); player.stamina=Math.min(player.maxStamina,player.stamina+_st(20)); showMsg(`🍳 Egg Meal — +${_hp(30)} HP, +${_st(20)} stamina!`); }
  else if (itemId==='pepperStew')   { player.hp=Math.min(player.maxHp,player.hp+_hp(40)); player.stamina=Math.min(player.maxStamina,player.stamina+_st(35)); player._speedBoostTimer=(player._speedBoostTimer||0)+30; showMsg(`🥣 Pepper Stew — +${_hp(40)} HP, +${_st(35)} stamina, speed boost 30s!`); }
  else if (itemId==='potatoMash')   { player.stamina=Math.min(player.maxStamina,player.stamina+60); showMsg('🥔 Potato Mash — +60 stamina!'); }
  else if (itemId==='berryJam')     { player.hp=Math.min(player.maxHp,player.hp+25); showMsg('🫐 Berry Jam — +25 HP!'); }
  else if (itemId==='lavenderTea')  { player.hp=Math.min(player.maxHp,player.hp+_hp(30)); player._regenBoostTimer=(player._regenBoostTimer||0)+60; showMsg(`💜 Lavender Tea — +${_hp(30)} HP, stamina regen boosted 60s!`); }
  else if (itemId==='porkRoast')    { player.hp=Math.min(player.maxHp,player.hp+_hp(50)); player.stamina=Math.min(player.maxStamina,player.stamina+_st(40)); showMsg(`🥩 Pork Roast — +${_hp(50)} HP, +${_st(40)} stamina!`); }
  else if (itemId==='goatCheese')   { player.hp=Math.min(player.maxHp,player.hp+20); showMsg('🧀 Goat Cheese — +20 HP!'); }
  else if (itemId==='garlicBread')  { player.stamina=Math.min(player.maxStamina,player.stamina+40); showMsg('🫓 Garlic Bread — +40 stamina!'); }
  else if (itemId==='watermelonSlice') { player.hp=Math.min(player.maxHp,player.hp+20); showMsg('🍉 Watermelon Slice — +20 HP! Refreshing.'); }
  else if (itemId==='rosehipTonic') { player.hp=Math.min(player.maxHp,player.hp+45); player._poisoned=false; player._poisonTimer=0; showMsg('🌹 Rosehip Tonic — +45 HP, poison cured!'); }
  else if (itemId==='mushroomSoup') { player.hp=Math.min(player.maxHp,player.hp+_hp(35)); player.stamina=Math.min(player.maxStamina,player.stamina+_st(60)); showMsg(`🍄 Mushroom Soup — +${_hp(35)} HP, +${_st(60)} stamina!`); }
  else if (itemId==='strawberryPreserves') { player.hp=Math.min(player.maxHp,player.hp+30); showMsg('🍓 Strawberry Preserves — +30 HP!'); }
  else if (itemId==='fishStew')      { player.hp=Math.min(player.maxHp,player.hp+_hp(50)); player.stamina=Math.min(player.maxStamina,player.stamina+_st(30)); showMsg(`🍲 Fish Stew — +${_hp(50)} HP, +${_st(30)} stamina!`); }
  else if (itemId==='saltChowder')   { player.hp=Math.min(player.maxHp,player.hp+_hp(60)); player.stamina=Math.min(player.maxStamina,player.stamina+_st(35)); showMsg(`🥣 Salt Chowder — +${_hp(60)} HP, +${_st(35)} stamina!`); }
  else if (itemId==='crabBisque')    { player.hp=Math.min(player.maxHp,player.hp+_hp(45)); player.stamina=Math.min(player.maxStamina,player.stamina+_st(50)); showMsg(`🍵 Crab Bisque — +${_hp(45)} HP, +${_st(50)} stamina!`); }
  else if (itemId==='grilledGrouper'){ player.hp=Math.min(player.maxHp,player.hp+70); showMsg('🍽 Grilled Grouper — +70 HP!'); }
  else if (itemId==='swordfishSteak'){ player.hp=Math.min(player.maxHp,player.hp+_hp(90)); player.stamina=Math.min(player.maxStamina,player.stamina+_st(60)); showMsg(`🥩 Swordfish Steak — +${_hp(90)} HP, +${_st(60)} stamina!`); }
  else if (itemId==='oysterPlate')   { player.hp=Math.min(player.maxHp,player.hp+_hp(30)); player.stamina=Math.min(player.maxStamina,player.stamina+_st(25)); showMsg(`🦪 Oyster Plate — +${_hp(30)} HP, +${_st(25)} stamina!`); }
  else if (itemId==='craftedTorch') { showMsg('🔦 Torch equipped — bring it into the mine.'); return; }
  else if (itemId==='beeswaxCandle') { useBeeswaxCandle(); return; }
  else {
    // Raw produce / raw fish — edible directly, hunger only, small stamina tick
    const item = ITEMS[itemId];
    const hungerVal = HUNGER_RESTORE[itemId] || 0;
    if (item && hungerVal > 0) {
      const isFish = item.type === 'fish';
      const stamGain = isFish ? Math.floor(hungerVal * 0.4) : Math.floor(hungerVal * 0.3);
      if (stamGain > 0) player.stamina = Math.min(player.maxStamina, player.stamina + stamGain);
      const actualHunger = Math.round(hungerVal * (isInsideHome() ? getHomeTableBonus() : 1.0));
      const cookHint = isFish ? ' (cook it for far more)' : '';
      const tableNote = (isInsideHome() && getHomeTableBonus() > 1) ? ' 🪑' : '';
      showMsg(`${item.icon} Ate ${item.name} — +${actualHunger} hunger${stamGain>0?', +'+stamGain+' stamina':''}${cookHint}${tableNote}.`);
    } else {
      showMsg('Can\'t use ' + (ITEMS[itemId]?.name||itemId) + ' from here.'); return;
    }
  }
  restoreHunger(itemId);
  removeItem(itemId, 1);
}