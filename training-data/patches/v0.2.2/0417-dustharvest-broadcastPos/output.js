function broadcastPos() {
  if (!mp.isActive()) return;
  const zone = gameState.inMine ? 'mine' : gameState.inBadlands ? 'badlands'
      : gameState.inHoboCamp ? 'hobo' : gameState.inOcean ? 'ocean'
      : gameState.inJungle ? 'jungle' : 'overworld';
  const dx = player.x - _lastBroadcastPos.x;
  const dy = player.y - _lastBroadcastPos.y;
  const changed = (dx*dx + dy*dy) > 4
    || player.facing !== _lastBroadcastPos.facing
    || player.tool   !== _lastBroadcastPos.tool
    || zone          !== _lastBroadcastPos.zone;
  if (!changed) return;
  _lastBroadcastPos = { x: player.x, y: player.y, facing: player.facing, tool: player.tool, zone };
  const data = {
    type: 'pos', _pid: mp.peerId,
    x: player.x, y: player.y,
    facing: player.facing, walkFrame: player.walkFrame || 0,
    tool: player.tool, name: player.name || 'Stranger',
    gender: player.gender, skinTone: player.skinTone,
    hairStyle: player.hairStyle, hairColor: player.hairColor,
    shirtStyle: player.shirtStyle, shirtColor: player.shirtColor,
    pantsColor: player.pantsColor, hatColor: player.hatColor,
    zone,
  };
  mp.broadcast(data);
}