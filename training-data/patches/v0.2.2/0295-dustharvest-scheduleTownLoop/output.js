function scheduleTownLoop(startTime) {
  if (!BGM.running || BGM.mode !== 'town') return;
  bgmEnsureSetup();
  const V=0.54, BPM=72, B=60/BPM, BAR=B*3, BARS=12, t=startTime; // 3/4 waltz
  // G G G C | G G D D | G C D G
  const roots =[N.G2,N.G2,N.G2,N.C3, N.G2,N.G2,N.D3,N.D3, N.G2,N.C3,N.D3,N.G2];
  const chords=[N.G3,N.G3,N.G3,N.C4, N.G3,N.G3,N.D4,N.D4, N.G3,N.C4,N.D4,N.G3];

  for(let bar=0;bar<BARS;bar++){
    const bT=t+bar*BAR, root=roots[bar], chord=chords[bar];
    // Waltz BOOM on beat 1
    wBass(root, bT, 0.75, V*0.92);
    // Bass fill — walk up on beat 3 of bars 3, 7, 11 (approaching chord change)
    if(bar%4===2) {
      wBass(root*1.122, bT+B*2, 0.40, V*0.48); // whole step up
    } else {
      wBass(root,       bT+B*2, 0.40, V*0.35); // softer on 3
    }
    // CHICK on beats 2 and 3 (waltz feel)
    strum(chord, bT+B,   V*0.38);
    strum(chord, bT+B*2, V*0.30);
    // Snare on beat 3 (hard waltz backbeat)
    perc(bT+B*2, V*0.28, true);
    // Ghost snare on "and" of 2 — every other bar, very soft
    if(bar%2===0) perc(bT+B*1.5, V*0.09, true);
    // Hi-hat: quarter note pulse only — waltz doesn't drive 8ths
    perc(bT,     V*0.10, false);
    perc(bT+B,   V*0.08, false);
    perc(bT+B*2, V*0.08, false);
  }
  // Melody: G major scale — G A B C D E F#
  // 12-bar: 4-bar statement, 4-bar departure, 4-bar return
  const mel=[
    // Statement
    [0,0,N.G4,1],[0,1,N.A4,0.5],[0,1.5,N.B4,1.5],
    [1,0,N.D5,1.5],[1,1.5,N.B4,1.5],
    [2,0,N.C5,1],[2,1,N.B4,0.5],[2,1.5,N.A4,1.5],
    [3,0,N.G4,3],
    // Departure
    [4,0,N.B4,0.75],[4,0.75,N.A4,0.5],[4,1.5,N.G4,1.5],
    [5,0,N.E4,1],[5,1,N.Fs4,0.5],[5,1.5,N.G4,1.5],
    [6,0,N.A4,0.75],[6,0.75,N.D5,0.75],[6,1.5,N.Fs4,1.5],
    [7,0,N.D4,3],
    // Return
    [8,0,N.G4,1],[8,1,N.A4,0.5],[8,1.5,N.B4,1.5],
    [9,0,N.C5,1.5],[9,1.5,N.B4,1.5],
    [10,0,N.A4,0.5],[10,0.5,N.G4,0.5],[10,1,N.Fs4,0.5],[10,1.5,N.G4,1.5],
    [11,0,N.G4,3],
  ];
  for(const [bar,beat,freq,db] of mel)
    banjo(freq, t+bar*BAR+beat*B, db*B*0.88, V*0.72);

  const dur=BARS*BAR;
  BGM.seqTimer=setTimeout(()=>scheduleTownLoop(t+dur),(dur-0.4)*1000);
}