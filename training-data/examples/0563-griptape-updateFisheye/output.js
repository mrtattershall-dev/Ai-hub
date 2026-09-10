function updateFisheye(dt) {
  if (!fisheyeNPC.active) {
    elFisheyeHud.style.opacity = '0';
    return;
  }

  // Follow player at a distance with lag
  _v1.set(
    player.pos.x + Math.sin(player.facing + 0.8) * 5,
    0.5,
    player.pos.z + Math.cos(player.facing + 0.8) * 5
  );
  fisheyeNPC.pos.lerp(_v1, dt * 1.8);
  fisheyeGroup.position.copy(fisheyeNPC.pos);

  // Face toward player
  const dx = player.pos.x - fisheyeNPC.pos.x;
  const dz = player.pos.z - fisheyeNPC.pos.z;
  fisheyeGroup.rotation.y = Math.atan2(dx, dz);

  // Score: distance (3-8 units = ideal), angle (facing player = good)
  const dist = Math.sqrt(dx*dx + dz*dz);
  const distScore = dist > 2 && dist < 9 ? 1 - Math.abs(dist - 5) / 5 : 0;
  _v2.set(Math.sin(fisheyeGroup.rotation.y), 0, Math.cos(fisheyeGroup.rotation.y));
  _v3.set(dx, 0, dz).normalize();
  fisheyeNPC.score = Math.max(0, Math.min(1, distScore * 0.5 + _v2.dot(_v3) * 0.5));

  // HUD
  const hud=elFisheyeHud;
  hud.style.opacity = '1';
  elFisheyeBar.style.width = (fisheyeNPC.score * 100) + '%';
  elFisheyeAngle.textContent = Math.round(dist * 10) / 10 + 'm';
}