function exitHoboCamp() {
  gameState.inHoboCamp = false;
  // If Kit's ticket was paid, she's gone when you leave
  if (hcTalkSeen && hcTalkSeen.has('kit_ticket_paid')) {
    hcTalkSeen.add('kit_left_camp');
  }
  // Return to just north of the hobo portal tiles on overworld
  player.x = 16 * T + T/2;
  player.y = 2 * T;
  unstickPlayer();
  centerCameraOnPlayer();
  showMsg('🌵 Back on the frontier road.');
}