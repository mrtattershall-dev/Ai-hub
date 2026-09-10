function resolveBranchOutcome(outcome, node, key, fl, baseQty, quality) {
  const lootId = node.def.loot;
  const lootName = ITEMS[lootId]?.name || lootId;
  const icon = node.def.icon;
  switch (outcome) {
    case 'safe': {
      addItem(lootId, baseQty, quality);
      trackOre(lootId, baseQty);
      gainRep('mine', baseQty); // +1 rep per ore mined
      const ql = oreQualityLabel(quality);
      appendMineJournal(`Day ${gameState.day} — Safe branch. ${baseQty}× ${lootName}${quality === 'pure' ? ' — pure ore!' : ''}.`);
      showMsg(`${icon} Safe seam — ${baseQty}× ${lootName}${ql ? ' '+ql : ''}!`);
      break;
    }
    case 'richVein': {
      const richQty = baseQty * (2 + Math.floor(Math.random() * 2));
      const richStam = Math.round(node.def.stamina * 0.8);
      player.stamina = Math.max(0, player.stamina - richStam);
      addItem(lootId, richQty, quality);
      trackOre(lootId, richQty);
      gainRep('mine', richQty); // +1 rep per ore mined
      spawnParticles(node.x*T+T/2, node.y*T+T/2, '#f0d060', 10, '✨');
      appendMineJournal(`Day ${gameState.day} — Rich vein! ${richQty}× ${lootName} from a deep seam.`);
      showMsg(`✨ RICH VEIN! ${richQty}× ${lootName}! (-${richStam} stamina for the deep dig)`);
      break;
    }
    case 'gemCache': {
      const gems = fl >= 3 ? [['crystal',1],['singingStone',1]] : [['crystal',1]];
      const [gemId, gemQty] = gems[Math.floor(Math.random()*gems.length)];
      addItem(gemId, gemQty);
      spawnParticles(node.x*T+T/2, node.y*T+T/2, '#c060f0', 8, '💎');
      appendMineJournal(`Day ${gameState.day} — Gem cache! Found ${gemQty}× ${ITEMS[gemId]?.name}. Pure discovery.`);
      showMsg(`💎 Gem cache! ${gemQty}× ${ITEMS[gemId]?.name} — no stamina cost. Pure fortune.`);
      break;
    }
    case 'hollow': {
      appendMineJournal(`Day ${gameState.day} — Hollow branch. Nothing there but dust and old air.`);
      showMsg(`🪨 The seam is hollow. Nothing there. Dust falls from the ceiling.`);
      break;
    }
    case 'collapse': {
      appendMineJournal(`Day ${gameState.day} — Branch collapsed. Canary ${player._mineCanary ? 'warned in time' : 'had no warning'}.`);
      if (player._mineCanary) {
        showMsg('🐤 CANARY SCREECHES — collapse! Backed away in time. No damage.');
      } else {
        const dmg = player._hardhat ? 10 : 25;
        damagePlayer(dmg, 'cavein');
        _mineRumbleFlash = 1.5;
        showMsg(`💥 Branch collapsed! Took ${dmg} damage.${player._hardhat ? ' Hard hat helped.' : ''}`);
      }
      break;
    }
    case 'fossil': {
      addItem('fossil', 1 + (fl >= 2 ? 1 : 0));
      const qty = 1 + (fl >= 2 ? 1 : 0);
      appendMineJournal(`Day ${gameState.day} — Found ${qty} fossil fragment${qty>1?'s':''}. Altaverde has records of something here.`);
      showMsg(`🦴 Fossil fragment${qty>1?'s':''} — ${qty}× found. The museum in town pays well for these.`);
      spawnParticles(node.x*T+T/2, node.y*T+T/2, '#d0b870', 6, '🦴');
      break;
    }
    case 'gasPocket': {
      appendMineJournal(`Day ${gameState.day} — Gas pocket. ${player._mineCanary ? 'Canary saved me' : 'No warning'}.`);
      if (player._mineCanary) {
        showMsg('💨 CANARY ALERT — gas pocket! Held breath. Escaped with 12 stamina loss.');
        player.stamina = Math.max(0, player.stamina - 12);
      } else {
        showMsg('💨 GAS POCKET! Toxic burst — -20 HP, -35 stamina!');
        damagePlayer(20, 'gas');
        player.stamina = Math.max(0, player.stamina - 35);
      }
      break;
    }
  }
}