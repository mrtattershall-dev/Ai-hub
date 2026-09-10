function rideMinecart() {
  const pt = getNearbyCartPoint();
  if (!pt) {
    showMsg('🛒 No rail nearby. Walk to the entry or deep chamber first.');
    return;
  }
  player.x = pt.dest.x;
  player.y = pt.dest.y;
  centerCameraOnPlayer();
  player.stamina = Math.max(0, player.stamina - 3);
  spawnParticles(pt.dest.x, pt.dest.y, '#c0a040', 6, '🛒');
  showMsg('🛒 Mine cart! Rode to the ' + pt.label + '.');
  dSound('tool');
}