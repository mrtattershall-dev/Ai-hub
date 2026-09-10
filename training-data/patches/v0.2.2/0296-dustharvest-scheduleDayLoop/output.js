function scheduleDayLoop(startTime) {
  if (!BGM.running || BGM.mode !== 'day') return;
  bgmEnsureSetup();
  const V=0.60, BPM=80, B=60/BPM, BAR=B*4, BARS=8, t=startTime;

  const bass_r = [N.D2, N.G2, N.A2, N.D2, N.D2, N.G2, N.A2, N.D2];
  const chord_r= [N.D3, N.G3, N.A3, N.D3, N.D3, N.G3, N.A3, N.D3];

  for (let bar=0; bar<BARS; bar++) {
    const bT=t+bar*BAR;
    // BOOM: bass on 1 and 3
    wBass(bass_r[bar],     bT,       0.72, V*0.90);
    wBass(bass_r[bar]*1.5, bT+B*2,   0.60, V*0.68);
    // Bass walk: anticipate chord change on beat 4.5 of every other bar
    if (bar%2===1) wBass(chord_r[(bar+1)%BARS], bT+B*3.5, 0.28, V*0.38);

    // CHICK: strum SLIGHTLY before the snare for separation (offset 12ms)
    strum(chord_r[bar], bT+B-0.012,   V*0.50);
    strum(chord_r[bar], bT+B*3-0.012, V*0.44);

    // Snare on 2 and 4 — hard backbeat
    perc(bT+B,   V*0.38, true);
    perc(bT+B*3, V*0.34, true);
    // Ghost snare on "and" of 4 in every other bar
    if (bar%2===0) perc(bT+B*3.5, V*0.12, true);

    // Hi-hat: skip beat 1 (bass owns it), accent 2/4, 8th offbeats light
    // Pattern: . X . x X . x . (. = rest, X = accent, x = soft)
    perc(bT+B*0.5, V*0.08, false); // and of 1
    perc(bT+B,     V*0.14, false); // beat 2 (with snare — slightly different freq helps)
    perc(bT+B*1.5, V*0.09, false); // and of 2
    perc(bT+B*2,   V*0.07, false); // beat 3 (light — bass is here)
    perc(bT+B*2.5, V*0.09, false); // and of 3
    perc(bT+B*3,   V*0.14, false); // beat 4
    perc(bT+B*3.5, V*0.10, false); // and of 4
  }

  const mel = [
    [0,0,N.D4,1],[0,1,N.E4,0.5],[0,1.5,N.Fs4,0.5],[0,2,N.A4,2],
    [1,0,N.A4,0.5],[1,0.5,N.G4,0.5],[1,1,N.Fs4,0.5],[1,1.5,N.E4,2.5],
    [2,0,N.G4,0.75],[2,0.75,N.Fs4,0.75],[2,1.5,N.E4,0.5],[2,2,N.D4,2],
    [3,0,N.D4,0.5],[3,0.5,N.E4,0.5],[3,1,N.D4,3],
    [4,0,N.Fs4,1],[4,1,N.A4,0.5],[4,1.5,N.B4,0.5],[4,2,N.A4,2],
    [5,0,N.G4,0.5],[5,0.5,N.Fs4,1],[5,1.5,N.E4,2.5],
    [6,0,N.E4,0.5],[6,0.5,N.Fs4,0.5],[6,1,N.G4,0.5],[6,1.5,N.A4,2.5],
    [7,0,N.Fs4,0.75],[7,0.75,N.E4,0.75],[7,1.5,N.D4,2.5],
  ];
  for (const [bar,beat,freq,db] of mel)
    banjo(freq, t+bar*BAR+beat*B, db*B*0.86, V*0.72);

  const dur=BARS*BAR;
  BGM.seqTimer = setTimeout(()=>scheduleDayLoop(t+dur), (dur-0.4)*1000);
}