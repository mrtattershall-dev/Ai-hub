const TRACKS = {
  title: {
    bpm: 96,
    bass: [40, null, 40, null, 45, null, 43, null, 38, null, 38, null, 43, null, 45, null],
    lead: [64, 67, 71, 67, 69, 72, 76, 72, 62, 65, 69, 65, 67, 71, 74, 71],
    waveBass: "triangle", waveLead: "square", leadVol: 0.10, bassVol: 0.16,
  },
  hub: {
    bpm: 104,
    bass: [45, 45, 52, 45, 43, 43, 50, 43, 41, 41, 48, 41, 43, 45, 47, 48],
    lead: [69, null, 72, 76, null, 74, 72, null, 67, null, 71, 74, null, 72, 69, null],
    waveBass: "sine", waveLead: "triangle", leadVol: 0.09, bassVol: 0.15,
  },
  stage: {
    bpm: 138,
    bass: [33, 33, 33, 40, 33, 33, 38, 33, 31, 31, 31, 38, 31, 36, 38, 40],
    lead: [69, 72, 74, 76, 79, 76, 74, 72, 67, 71, 74, 76, 74, 71, 69, 67],
    waveBass: "sawtooth", waveLead: "square", leadVol: 0.08, bassVol: 0.14,
  },
  boss: {
    bpm: 152,
    bass: [29, 29, 36, 29, 28, 28, 35, 28, 26, 26, 33, 26, 31, 31, 33, 35],
    lead: [60, 63, 60, 66, 65, 63, 60, 58, 60, 63, 67, 70, 68, 65, 63, 60],
    waveBass: "sawtooth", waveLead: "sawtooth", leadVol: 0.09, bassVol: 0.16,
  },
  results: {
    bpm: 110,
    bass: [48, null, 55, null, 53, null, 48, null, 50, null, 57, null, 55, null, 50, null],
    lead: [72, 76, 79, 84, 83, 79, 76, 72, 74, 77, 81, 86, 84, 81, 77, 74],
    waveBass: "triangle", waveLead: "triangle", leadVol: 0.11, bassVol: 0.13,
  },
};