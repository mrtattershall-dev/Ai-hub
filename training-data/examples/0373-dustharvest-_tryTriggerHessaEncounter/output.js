function _tryTriggerHessaEncounter() {
  if (_hessaEncounterActive) return;
  if (!gameState.inJungle || !gameState.isNight) return;
  const pty = Math.floor(player.y / JG_T);
  if (pty < JG_ENTRY_DEEP) return;
  if (!gameState._jgDebt) return;

  const week = getJGWeekNumber(gameState.day) || 0;

  for (const enc of HESSA_ENCOUNTERS) {
    if (enc.stage !== gameState._hollowedQuestStage) continue;
    if (enc.requiresNight && !gameState.isNight) continue;
    if (enc.requiresWeek && week < enc.requiresWeek) continue;
    if (enc.requiresFlag && !enc.requiresFlag()) continue;

    // Check already-seen flags
    const seenKey = 'hessa_enc_' + enc.stage + '_' + (enc.requiresWeek || 0);
    if (jungleTalkSeen.has(seenKey)) continue;
    jungleTalkSeen.add(seenKey);

    // Trigger the encounter
    _hessaEncounterActive = true;
    _hessaEncounterDef    = enc;
    _hessaEncounterBeat   = 0;
    _hessaEncounterTimer2 = 1.0;
    break;
  }
}