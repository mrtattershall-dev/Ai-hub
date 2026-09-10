function checkPlayerTiles() {
  const p  = G.player;
  if (!p) return;
  const md = G.currentZoneId ? ZONES[G.currentZoneId].mapData : null;
  if (!md) return;

  /* Scan tiles overlapping the player's AABB — clamped to map bounds */
  const tx0 = Math.max(0,          ( p.x              / NES.TILE) | 0);
  const tx1 = Math.min(md.cols-1, ((p.x + p.w - 1)   / NES.TILE) | 0);
  const ty0 = Math.max(0,          ( p.y              / NES.TILE) | 0);
  const ty1 = Math.min(md.rows-1, ((p.y + p.h - 1)   / NES.TILE) | 0);

  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const idx = ty * md.cols + tx;
      const id  = md.data[idx];
      if (!id) continue;

      const props = TILE_PROPS[id];
      if (!props) continue;

      /* Spike — damage from source at spike center */
      if (props.hazard) {
        damagePlayer(1, tx * NES.TILE + 8);
        /* If the hit killed the player, stop scanning — a door tile later in
           the same AABB could call transitionZone and override STATE.DEAD. */
        if (G.state !== STATE.PLAYING) return;
      }

      /* Weapon pickup */
      if (id === T.WEAPON) {
        if (!p.weapons.includes('bone_whip')) {
          p.weapons.push('bone_whip');
          G.collectedWeapons.add('bone_whip');  /* persists through death */
          p.notifyText  = 'BONE WHIP';
          p.notifyTimer = 120;
        }
        md.data[idx] = T.AIR;   /* remove from map (dynamic layer stops drawing it) */
      }

      /* Zone door triggers — vx/vy guard prevents accidental fires */
      if (props.trigger === 'door_l' && p.vx < -0.5) {
        const dest = ZONES[G.currentZoneId]?.connects?.left;
        if (dest) { transitionZone(dest); return; }
      }
      if (props.trigger === 'door_r' && p.vx > 0.5) {
        const dest = ZONES[G.currentZoneId]?.connects?.right;
        if (dest) { transitionZone(dest); return; }
      }
      if (props.trigger === 'door_up' && p.vy < -0.5) {
        const dest = ZONES[G.currentZoneId]?.connects?.up;
        if (dest) { transitionZone(dest); return; }
      }

      /* Lore pickup — freeze game, show panel, track collection */
      if (id === T.LORE) {
        const zone   = ZONES[G.currentZoneId];
        const lLines = zone.loreTexts && zone.loreTexts.get(idx);
        const key    = G.currentZoneId + ':' + idx;
        G.loreCollected.add(key);
        md.data[idx] = T.AIR;
        lorePanel.show(lLines || ['LORE FOUND']);
      }
    }
  }

  /* Pit death — fell past map bottom */
  if (p.y > md.rows * NES.TILE + 32) {
    p.hp = 0;
    setState(STATE.DEAD);
  }
}