function openBLDeepChest() {
  if (blDeepChestLooted) { showMsg('💀 Already stripped clean. Returns tomorrow.'); return; }
  blDeepChestLooted = true;
  const lootTable = [
    ['gold',      80,  160],
    ['obsidian',  1,   2  ],
    ['silverOre', 2,   4  ],
    ['outlawBadge',1,  3  ],
    ['dustDevilEye',0, 1  ],
    ['potion',    1,   3  ],
    ['scorpion2Stinger',0,2],
  ];
  let goldGained=0; const itemsGained=[];
  lootTable.forEach(([id,mn,mx])=>{
    if(Math.random()<0.65){
      const qty=mn+Math.floor(Math.random()*(mx-mn+1));
      if(qty<=0) return;
      if(id==='gold'){player.gold+=qty;goldGained+=qty;}
      else{const a=addItem(id,qty);if(a>0)itemsGained.push(`${a}× ${ITEMS[id]?.name||id}`);}
    }
  });
  spawnParticles(player.x,player.y,'#e0a030',10,'💀');
  const parts=[]; if(goldGained>0) parts.push(`$${goldGained}`); parts.push(...itemsGained);
  showMsg(`💀 Settlement chest: ${parts.length>0?parts.join(', '):'dust and broken glass.'}`);
  refreshInvUI(); buildHotbar();
}