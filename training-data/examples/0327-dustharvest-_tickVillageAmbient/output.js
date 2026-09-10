function _tickVillageAmbient(dt) {
  if (!gameState.inJungle) return;
  _villageNightBobTimer += dt;

  // Night: NPCs should emit a subtle campfire-proximity glow hint in the HUD
  if (gameState.isNight && _villageNightBobTimer > 30 && !jungleTalkSeen.has('_night_village_msg')) {
    jungleTalkSeen.add('_night_village_msg');
    showMsg('🌿 The village gathers at the fire. The jungle is louder at night.', 3500);
  }
  if (!gameState.isNight) {
    jungleTalkSeen.delete('_night_village_msg'); // reset each day
  }
}