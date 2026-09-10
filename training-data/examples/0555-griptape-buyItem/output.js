function buyItem(key) {
  const item = shopItems[key];
  if (!item) return;
  if (shopState.cash < item.price) { toast('Not enough cash', 'danger'); return; }
  if (!item.repeatable && shopState.boughtItems.has(key)) return;

  shopState.cash -= item.price;
  elShopCash.textContent = shopState.cash;
  if (!item.repeatable) shopState.boughtItems.add(key);

  switch (key) {
    case 'icepack':
      player.bruise = Math.max(0, player.bruise - 40);
      updateBruise();
      toast('Ice pack applied. Bruise -40', 'success');
      break;
    case 'icepack-pro':
      player.bruise = 0;
      updateBruise();
      toast("Full recovery. Shifty's secret formula.", 'success');
      break;
    case 'grip-gutter':
      player.skate = Math.min(100, player.skate + 8);
      toast('Gutter Grip applied. Skate +8', 'success');
      break;
    case 'grip-pro':
      player.skate = Math.min(100, player.skate + 15);
      toast('Pro Grip applied. Skate +15', 'success');
      break;
    case 'spot-map':
      shopState.spotMapOwned = true;
      toast('Spot map unlocked — check the minimap', 'success');
      break;
    case 'energy':
      player.academics = Math.min(100, player.academics + 12);
      toast('Local Zine read. Academics +12', 'success');
      break;
    case 'board-upgrade':
      shopState.tuneUpActive = true;
      toast('Tune-up done. Max speed +15% this session', 'success');
      break;
    case 'bail-insurance':
      shopState.kneePadsCharges = 3;
      toast('Knee pads on. Next 3 bails -50% bruise', 'success');
      break;
  }

  // Refresh item states after purchase
  openShop();
}