function scheduleCombatLoop(startTime) {
  if (!BGM.running || BGM.mode !== 'combat') return;
  bgmEnsureSetup();
  const V=0.56, BPM=96, B=60/BPM, BAR=B*4, BARS=4, t=startTime;

  for (let bar=0; bar<BARS; bar++) {
    const bT=t+bar*BAR;
    // Kick on beat 1 (low perc) + bass drive
    perc(bT,         V*0.52, false); // kick — low
    wBass(N.Am2,     bT,       0.50, V*0.90);
    // Synco bass: "and" of 1, beat 2.5, beat 3, "and" of 3
    wBass(N.Am2,     bT+B*0.5, 0.28, V*0.48); // and-1
    wBass(N.D2*2,    bT+B*1.5, 0.38, V*0.65); // and-2 — tension
    wBass(N.Am2,     bT+B*2,   0.42, V*0.75); // beat 3
    wBass(N.Em3,     bT+B*3,   0.38, V*0.60); // beat 4 — resolve pull
    // Backbeat snare — beats 2 and 4
    perc(bT+B,   V*0.52, true);
    perc(bT+B*3, V*0.48, true);
    // Ghost snare — "and" of 2
    perc(bT+B*1.5, V*0.16, true);
    // Hi-hat: 8th note pattern, accent on backbeats, open on beat 2.5
    perc(bT+B*0.5, V*0.12, false);
    perc(bT+B,     V*0.16, false);
    perc(bT+B*1.5, V*0.10, false);
    perc(bT+B*2,   V*0.11, false);
    perc(bT+B*2.5, V*0.15, false); // accent — "and" of 3
    perc(bT+B*3,   V*0.16, false);
    perc(bT+B*3.5, V*0.12, false);
    // Banjo stabs — syncopated, NOT on the beat
    banjo(N.C4,        bT+B*0.75, B*0.22, V*0.46); // and-1 late
    banjo(N.Em4*0.944, bT+B*1.5,  B*0.22, V*0.42); // and-2
    banjo(N.C4,        bT+B*2.75, B*0.22, V*0.44); // and-3 late
    banjo(N.D4,        bT+B*3.5,  B*0.18, V*0.38); // and-4
  }

  const dur=BARS*BAR;
  BGM.seqTimer = setTimeout(()=>scheduleCombatLoop(t+dur), (dur-0.4)*1000);
}