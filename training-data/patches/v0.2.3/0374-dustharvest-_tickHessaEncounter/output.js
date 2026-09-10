function _tickHessaEncounter(dt) {
  if (!_hessaEncounterActive || !_hessaEncounterDef) return;
  _hessaEncounterTimer2 -= dt;
  if (_hessaEncounterTimer2 > 0) return;

  const enc = _hessaEncounterDef;
  if (_hessaEncounterBeat < enc.text.length) {
    showMsg(enc.text[_hessaEncounterBeat], 3200);
    _hessaEncounterBeat++;
    _hessaEncounterTimer2 = 3.5;
  } else {
    // Encounter done
    if (enc.onComplete) enc.onComplete();
    _hessaEncounterActive = false;
    _hessaEncounterDef    = null;
  }
}