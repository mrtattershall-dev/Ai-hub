function checkToolForNode(nodeDef) {
  const loot = nodeDef.loot;
  if (loot === 'stone' || loot === 'copperOre' || loot === 'ironOre' || loot === 'silverOre' || loot === 'obsidian' || loot === 'stoneShard') {
    if (!hasPickaxe()) return { ok:false, msg:'⛏ You need a Pickaxe to mine stone/ore — buy one at the market [M] → Upgrades.' };
  }
  if (loot === 'wood' || loot === 'charredWood') {
    if (!hasAxe()) return { ok:false, msg:'🪓 You need an Axe to chop wood — buy one at the market [M] → Upgrades.' };
  }
  // herbs, bones, sulfur, etc: any tool/item is fine
  return { ok:true };
}