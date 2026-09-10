function _tickJungleArrival(dt) {
  if (jungleTalkSeen.has('kit_arrived_east')) return;
  if (_jungleArrivalStep >= JUNGLE_ARRIVAL_BEATS.length) return;
  _jungleArrivalTimer += dt;
  const beat = JUNGLE_ARRIVAL_BEATS[_jungleArrivalStep];
  if (_jungleArrivalTimer >= beat.delay) {
    _jungleArrivalStep++;
    _jungleArrivalTimer = 0;
    if (beat.msg) showMsg(beat.msg, 3000);
    if (beat.fn)  beat.fn();
  }
}