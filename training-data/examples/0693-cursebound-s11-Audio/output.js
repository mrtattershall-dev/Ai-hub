const Audio = (() => {
'use strict';

/* ----------------------------------------------------------------
   A0. INTERNAL STATE
---------------------------------------------------------------- */
let ctx        = null;   /* AudioContext — null until first gesture */
let SR         = 44100;  /* set from ctx.sampleRate after init      */
let masterGain = null;   /* master volume node                      */
let ready      = false;

/* Look-ahead scheduler */
let schedTimer      = null;
let schedNextTime   = 0;
const SCHED_AHEAD   = 0.10;  /* 100ms lookahead                    */
const SCHED_POLL_MS = 25;    /* poll every 25ms                     */

/* Music state */
let currentTrack    = null;  /* { sequences, tempo, ... }          */
let musicStep       = 0;
let musicPlaying    = false;
let musicPaused     = false;

/* Channel steal — pulse1 music muted while SFX plays */
let pulse1MusicMuted = false;
let pulse1MuteTimer  = 0;   /* frames remaining in steal          */

/* Dummy keep-alive node (prevents tab-background throttle) */
let dummyNode = null;

/* Cached waveforms — built once after ctx init */
let waveP125  = null;   /* 12.5% duty pulse                       */
let waveP25   = null;   /* 25%  duty pulse                        */
let waveP50   = null;   /* 50%  duty pulse                        */
let waveTri   = null;   /* stepped 4-bit triangle                 */
let noiseBuffer = null; /* LFSR noise AudioBuffer                 */

/* Active music oscillator refs (for channel steal) */
let pulse1MusicGain = null;

/* ----------------------------------------------------------------
   A1. MATH HELPERS
---------------------------------------------------------------- */

/* Equal temperament from A4=440 */
function pitch(semi) { return 440 * Math.pow(2, semi / 12); }

/* Semitone offsets relative to A4 (0) */
const N = {
  C2:-33, D2:-31, E2:-29, F2:-28, G2:-26, A2:-24, B2:-22,
  C3:-21, D3:-19, E3:-17, F3:-16, 'G#3':-13, A3:-12, B3:-10,
  C4: -9, D4: -7, E4: -5, F4: -4, 'F#4':-3, 'G#4':-1,
  A4:  0, B4:  2, C5:  3, D5:  5, E5:  7, F5:  8, 'G#5': 11,
  A5: 12, B5: 14, C6: 15, D6: 17, E6: 19,
};

/* 4-bit volume quantisation (0-15 discrete levels) */
function q4(v) {
  return Math.round(Math.max(0, Math.min(1, v)) * 15) / 15;
}

/* ----------------------------------------------------------------
   A2. WAVEFORM BUILDERS
   Fourier series with Hanning window to suppress Gibbs ringing.
   sampleRate-independent — only harmonic coefficients matter.
---------------------------------------------------------------- */

function buildPulse(duty) {
  const H = 64;
  const real = new Float32Array(H);
  const imag = new Float32Array(H);
  for (let i = 1; i < H; i++) {
    /* Hanning window: w(i) = 0.5*(1 - cos(π*i/(H-1))) */
    const w = 0.5 * (1 - Math.cos(Math.PI * i / (H - 1)));
    imag[i] = w * (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

function buildSteppedTriangle() {
  /* 32-step 4-bit triangle — matches 2A03 DAC staircase output */
  const S = 32;
  const real = new Float32Array(S);
  const imag = new Float32Array(S);
  for (let i = 1; i < S; i += 2) {
    imag[i] = (8 / Math.pow(Math.PI * i, 2)) * (i % 4 === 1 ? 1 : -1);
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

/* ----------------------------------------------------------------
   A3. LFSR NOISE BUFFER  (15-bit shift register, pre-computed)
   shortMode=false → long  (32767-sample white noise — snare/hiss)
   shortMode=true  → short (93-sample metallic loop — bats/magic)
   Uses ctx.sampleRate so it plays back at correct pitch regardless
   of Bluetooth/low-rate environments.
---------------------------------------------------------------- */

function buildNoiseBuffer(shortMode) {
  /* One second worth of samples; scheduler loops as needed */
  const len  = SR;
  const buf  = ctx.createBuffer(1, len, SR);
  const data = buf.getChannelData(0);
  let   reg  = 0x0001;

  for (let i = 0; i < len; i++) {
    const tap  = shortMode ? 6 : 1;
    const b0   = reg & 1;
    const bN   = (reg >> tap) & 1;
    const feed = b0 ^ bN;
    reg = (reg >> 1) | (feed << 14);
    data[i] = b0 ? 1.0 : -1.0;
  }
  return buf;
}

/* ----------------------------------------------------------------
   A4. LOW-LEVEL NOTE PLAYER
   Schedules a single hardware-style note on one channel.
   Returns the GainNode so callers can mute/fade it.
   vibrato: true → 60Hz alternating ±depthSemi semitone steps
   sweep: { target, dur } → hardware frequency sweep
   pan: -1..1 → StereoPanner
---------------------------------------------------------------- */

function playNote(opts) {
  if (!ctx || !ready) return null;
  const {
    wave     = waveP25,
    freq,
    start,
    dur,
    vol      = 0.2,
    vibrato  = false,
    vibratoDepth = 0.3,   /* semitones */
    sweep    = null,
    pan      = 0,
    loop     = false,
  } = opts;

  if (!freq || freq <= 0) return null;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  if (wave) osc.setPeriodicWave(wave);
  osc.frequency.setValueAtTime(freq, start);

  /* 4-bit staccato envelope */
  const qv = q4(vol);
  gain.gain.setValueAtTime(qv, start);
  gain.gain.setValueAtTime(qv,     start + dur * 0.80);
  gain.gain.linearRampToValueAtTime(0, start + dur * 0.98);

  /* 60Hz vibrato — alternating frame-rate pitch steps */
  if (vibrato) {
    const fHi  = freq * Math.pow(2,  vibratoDepth / 12);
    const fLo  = freq * Math.pow(2, -vibratoDepth / 12);
    const step = 1 / 60;
    const frames = Math.floor(dur / step);
    for (let i = 0; i < frames; i++) {
      osc.frequency.setValueAtTime(
        i % 2 === 0 ? fHi : fLo,
        start + i * step
      );
    }
  }

  /* Hardware sweep (60Hz stepping, asymmetric for descending — 1's complement bug) */
  if (sweep) {
    const steps = Math.max(1, Math.floor(sweep.dur * 60));
    const delta = (sweep.target - freq) / steps;
    let   cur   = freq;
    for (let i = 0; i < steps; i++) {
      const bug = (sweep.target < freq) ? cur * 0.005 : 0;
      osc.frequency.setValueAtTime(cur + bug, start + i / 60);
      cur += delta;
    }
  }

  /* Routing: osc → gain → [panner →] master */
  osc.connect(gain);
  if (pan !== 0 && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), start);
    gain.connect(panner);
    panner.connect(masterGain);
  } else {
    gain.connect(masterGain);
  }

  osc.start(start);
  osc.stop(start + dur + 0.02);

  return gain;
}

/* ----------------------------------------------------------------
   A5. NOISE HIT PLAYER  (uses BufferSourceNode from LFSR buffer)
---------------------------------------------------------------- */

function playNoise(opts) {
  if (!ctx || !ready || !noiseBuffer) return;
  const { start, dur, vol = 0.15, short = false, pan = 0 } = opts;
  /* We have one long-mode buffer; short-mode is a separate on-demand build */
  const buf = short ? buildNoiseBuffer(true) : noiseBuffer;

  const src  = ctx.createBufferSource();
  const gain = ctx.createGain();
  const qv   = q4(vol);

  src.buffer = buf;
  src.loop   = true;

  gain.gain.setValueAtTime(qv, start);
  gain.gain.setValueAtTime(qv, start + dur * 0.6);
  gain.gain.linearRampToValueAtTime(0, start + dur);

  src.connect(gain);

  if (pan !== 0 && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, start);
    gain.connect(panner);
    panner.connect(masterGain);
  } else {
    gain.connect(masterGain);
  }

  src.start(start);
  src.stop(start + dur + 0.02);
}

/* ----------------------------------------------------------------
   A6. MUSIC TRACK DEFINITIONS
   Each track: { bpm, steps: [{p1,p2,tri,noise}] }
   p1/p2/tri: { semi, vol, dur?, vibrato? } — semi relative to A4
   null = rest.  Loops at steps.length.
   GDD mood targets per zone:
     ENTRY   : minor key, stately, slow — dread builds
     CRYPT   : lower, cave reverb sim, distorted
     CLOCK   : driving, mechanical, ascending arpeggios
     SANCTUM : dissonant, choir-like square waves
     THRONE  : full tension, Hand scratch motif woven in
     BOSS_12 : aggressive, percussive
     BOSS_3  : melodic break, sad, resolving
---------------------------------------------------------------- */

/* ── Helper to build a step object cleanly ── */
function s(p1, p2, tri, n) {
  return { p1: p1||null, p2: p2||null, tri: tri||null, noise: n||null };
}
/* note shorthand: [semitone_from_A4, volume_0-1, vibrato_bool] */
function n(semi, vol, vib) { return { semi, vol: vol||0.18, vib: vib||false }; }

/* ── ZONE 1: Entry Hall ── minor key, stately, slow (♩=90) ──
   E natural minor, measured, chandelier-lit dread.
   Bach-style: pulse1=melody, pulse2=counterpoint a 6th below, tri=bass walking line. */
const TRACK_ENTRY = { bpm: 90, steps: [
  s(n(N.E5,0.18),  n(N.B4,0.11),  n(N.E3,0.30)),
  s(n(N.D5,0.16),  n(N.A4,0.10),  n(N.E3,0.30)),
  s(n(N.C5,0.17),  n(N.A4,0.10),  n(N.A3,0.28)),
  s(n(N.B4,0.16),  n(N['G#4'],0.10), n(N.E3,0.30)),
  s(n(N.A4,0.17),  n(N.E4,0.10),  n(N.A3,0.30)),
  s(n(N.B4,0.15),  n(N['G#4'],0.10), n(N.B3,0.28)),
  s(n(N.C5,0.17),  n(N.A4,0.10),  n(N.A3,0.30)),
  s(n(N.B4,0.16),  n(N['G#4'],0.10), n(N.E3,0.30)),
  s(n(N.E5,0.18,true), n(N.B4,0.11), n(N.E3,0.30)),
  s(n(N.F5,0.17),  n(N.C5,0.11),  n(N.F3,0.30)),
  s(n(N['G#5'],0.18), n(N.E5,0.11), n(N.E3,0.30)),
  s(n(N.E5,0.16),  n(N.B4,0.10),  n(N.E3,0.30)),
  s(n(N.D5,0.17),  n(N.A4,0.10),  n(N.D3+2,0.28)),  /* D3 approx */
  s(n(N.C5,0.16),  n(N.A4,0.10),  n(N.A3,0.28)),
  s(n(N.B4,0.17,true), n(N['G#4'],0.10), n(N.E3,0.30)),
  s(null,          null,           n(N.E3,0.22)),
]};

/* ── ZONE 2: Crypt ── lower register, heavier attack (♩=100) ──
   E Phrygian Dominant (1,♭2,3,4,5,♭6,♭7).
   Tight staccato, lower octave, distortion simulated via noise layer. */
const TRACK_CRYPT = { bpm: 100, steps: [
  s(n(N.E4,0.20),  n(N.B3,0.12),  n(N.E2+3,0.35), {vol:0.06,short:false}),
  s(n(N.F4,0.20),  n(N.C4,0.12),  n(N.E2+3,0.35), null),
  s(n(N['G#4'],0.20), n(N.E4,0.11), n(N['G#3'],0.32), {vol:0.04,short:false}),
  s(n(N.A4,0.18),  n(N.E4,0.10),  n(N.A3,0.30),   null),
  s(n(N.F4,0.20),  n(N.C4,0.12),  n(N.F3,0.32),   {vol:0.06,short:false}),
  s(n(N.E4,0.18),  n(N.B3,0.11),  n(N.E3,0.30),   null),
  s(n(N.D5,0.18),  n(N.A4,0.10),  n(N.D3+2,0.30), {vol:0.04,short:false}),
  s(n(N.C5,0.16),  n(N.A4,0.10),  n(N.A3,0.28),   null),
  s(n(N.B4,0.18),  n(N['G#4'],0.11), n(N.B3,0.30), {vol:0.06,short:false}),
  s(n(N.A4,0.16),  n(N.E4,0.10),  n(N.E3,0.30),   null),
  s(n(N['G#4'],0.18), n(N.E4,0.10), n(N['G#3'],0.28), {vol:0.04,short:false}),
  s(n(N.F4,0.20),  n(N.C4,0.12),  n(N.F3,0.30),   null),
  s(n(N.E4,0.22,true), n(N.B3,0.13), n(N.E3,0.35), {vol:0.08,short:false}),
  s(n(N.F4,0.20),  n(N.C4,0.12),  n(N.F3,0.32),   null),
  s(n(N['G#4'],0.20), n(N.E4,0.11), n(N.E3,0.32),  {vol:0.05,short:false}),
  s(null,          null,           n(N.E3,0.25),   {vol:0.07,short:false}),
]};

/* ── ZONE 3: Clocktower ── driving, mechanical arpeggios (♩=140) ──
   Faster tempo, ascending arpeggio runs on pulse1, pulse2 offsets a 3rd.
   Triangle drives persistent eighth-note bass ostinato. */
const TRACK_CLOCK = { bpm: 140, steps: [
  s(n(N.E4,0.20),  n(N['G#4'],0.12), n(N.E3,0.32)),
  s(n(N.B4,0.18),  n(N.E5,0.11),  n(N.E3,0.30)),
  s(n(N.E5,0.20),  n(N['G#5'],0.12), n(N.E3,0.32)),
  s(n(N.B4,0.18),  n(N.E5,0.11),  n(N.B3,0.30)),
  s(n(N.A4,0.18),  n(N.C5,0.11),  n(N.A3,0.30)),
  s(n(N.E5,0.20),  n(N.A5,0.12),  n(N.A3,0.32)),
  s(n(N['G#4'],0.18), n(N.B4,0.11), n(N.E3,0.30)),
  s(n(N.E5,0.20),  n(N['G#5'],0.12), n(N.E3,0.32)),
  s(n(N.F4,0.20),  n(N.A4,0.12),  n(N.F3,0.32)),
  s(n(N.C5,0.18),  n(N.F5,0.11),  n(N.F3,0.30)),
  s(n(N.A4,0.18),  n(N.C5,0.11),  n(N.A3,0.30)),
  s(n(N.F5,0.20),  n(N.A5,0.12),  n(N.F3,0.32)),
  s(n(N.E4,0.20),  n(N['G#4'],0.12), n(N.E3,0.32)),
  s(n(N['G#4'],0.18), n(N.B4,0.11), n(N.E3,0.30)),
  s(n(N.B4,0.20),  n(N.D5,0.11),  n(N.B3,0.30)),
  s(n(N.E5,0.22,true), n(N['G#5'],0.13), n(N.E3,0.35)),
]};

/* ── ZONE 4: Sanctum ── dissonant, choir-like (♩=76) ──
   Slow, heavy. Minor 2nd clashes (E against F). 50% duty on pulse2
   for a hollow, organ-pipe sound. Vibrato on sustained notes. */
const TRACK_SANCTUM = { bpm: 76, steps: [
  s(n(N.E5,0.16,true),  n(N.F4,0.10,true),  n(N.E3,0.28)),
  s(null,               n(N.F4,0.10),       n(N.E3,0.26)),
  s(n(N.D5,0.18,true),  n(N.E4,0.10,true),  n(N.A3,0.28)),
  s(null,               n(N.E4,0.10),       n(N.A3,0.24)),
  s(n(N.C5,0.16,true),  n(N.F4,0.10,true),  n(N.F3,0.26)),
  s(null,               n(N.C4,0.08),       n(N.F3,0.24)),
  s(n(N.B4,0.18,true),  n(N['G#4'],0.11,true), n(N.E3,0.28)),
  s(null,               n(N['G#4'],0.10),   n(N.E3,0.24)),
  s(n(N.A4,0.16,true),  n(N.F4,0.10,true),  n(N.A3,0.26)),
  s(null,               null,               n(N.A3,0.22)),
  s(n(N['G#4'],0.18,true), n(N.E4,0.11,true), n(N['G#3'],0.26)),
  s(null,               null,               n(N.E3,0.22)),
  s(n(N.F4,0.20,true),  n(N.B3,0.12,true),  n(N.F3,0.30)),
  s(null,               n(N.C4,0.10),       n(N.F3,0.26)),
  s(n(N.E4,0.18,true),  n(N.B3,0.11,true),  n(N.E3,0.28)),
  s(null,               null,               n(N.E3,0.26)),
]};

/* ── ZONE 5: Throne Room ── full tension, Hand motif (♩=130) ──
   Aggressive. Short staccato runs interspersed with the Hand's
   scratching motif (a chromatic minor-2nd descent: F→E→D#). */
const TRACK_THRONE = { bpm: 130, steps: [
  s(n(N.E5,0.22),  n(N.B4,0.13),  n(N.E3,0.35), {vol:0.10,short:false}),
  s(n(N.F5,0.22),  n(N.C5,0.13),  n(N.F3,0.35), null),
  s(n(N.E5,0.20),  n(N.B4,0.12),  n(N.E3,0.33), {vol:0.08,short:false}),
  s(n(N['G#5'],0.22), n(N.E5,0.13), n(N.E3,0.35), null),
  /* Hand motif: chromatic scratch F→E */
  s(n(N.F5,0.20),  n(N.C5,0.11),  n(N.A3,0.32), {vol:0.12,short:true}),
  s(n(N.E5,0.18),  n(N.B4,0.10),  n(N.A3,0.30), {vol:0.10,short:true}),
  s(n(N.D5,0.18),  n(N.A4,0.10),  n(N.E3,0.30), null),
  s(n(N.C5,0.20),  n(N.A4,0.11),  n(N.E3,0.32), {vol:0.08,short:false}),
  s(n(N.B4,0.22),  n(N['G#4'],0.13), n(N.B3,0.35), {vol:0.10,short:false}),
  s(n(N.A4,0.20),  n(N.E4,0.12),  n(N.A3,0.33), null),
  s(n(N.B4,0.18),  n(N['G#4'],0.11), n(N.B3,0.30), {vol:0.08,short:false}),
  s(n(N.C5,0.20),  n(N.A4,0.12),  n(N.A3,0.32), null),
  /* Hand motif repeat, louder */
  s(n(N.F5,0.22),  n(N.C5,0.13),  n(N.F3,0.35), {vol:0.14,short:true}),
  s(n(N.E5,0.22),  n(N.B4,0.13),  n(N.E3,0.35), {vol:0.12,short:true}),
  s(n(N.D5,0.20),  n(N.A4,0.12),  n(N.D3+2,0.33), null),
  s(n(N.E5,0.22,true), n(N.B4,0.13), n(N.E3,0.35), {vol:0.10,short:false}),
]};

/* ── BOSS Phase 1-2 ── aggressive, percussive (♩=160) ──
   Fastest tempo. Driving pulse1 lead over hammered eighth-note bass.
   Heavy noise on every beat for percussion feel. */
const TRACK_BOSS12 = { bpm: 160, steps: [
  s(n(N.E5,0.22),  n(N['G#4'],0.14), n(N.E3,0.38), {vol:0.18,short:false}),
  s(n(N.B4,0.20),  n(N.E4,0.12),  n(N.E3,0.35), null),
  s(n(N.E5,0.22),  n(N['G#4'],0.14), n(N.B3,0.36), {vol:0.14,short:false}),
  s(n(N['G#5'],0.24), n(N.E5,0.15), n(N.E3,0.40), {vol:0.16,short:false}),
  s(n(N.F5,0.22),  n(N.A4,0.13),  n(N.F3,0.38), {vol:0.18,short:false}),
  s(n(N.E5,0.20),  n(N['G#4'],0.12), n(N.F3,0.35), null),
  s(n(N.D5,0.22),  n(N.F4,0.13),  n(N.B3,0.36), {vol:0.14,short:false}),
  s(n(N.C5,0.20),  n(N.E4,0.12),  n(N.A3,0.35), null),
  s(n(N.B4,0.22),  n(N['G#4'],0.14), n(N.E3,0.38), {vol:0.18,short:false}),
  s(n(N.A4,0.20),  n(N.E4,0.12),  n(N.E3,0.35), null),
  s(n(N.B4,0.22),  n(N['G#4'],0.14), n(N.B3,0.36), {vol:0.14,short:false}),
  s(n(N.C5,0.20),  n(N.A4,0.12),  n(N.A3,0.35), null),
  s(n(N['G#4'],0.22), n(N.E4,0.14), n(N.E3,0.38), {vol:0.16,short:false}),
  s(n(N.A4,0.20),  n(N.E4,0.12),  n(N.E3,0.35), null),
  s(n(N.B4,0.22),  n(N['G#4'],0.14), n(N.B3,0.36), {vol:0.18,short:false}),
  s(n(N.E5,0.26,true), n(N.B4,0.16), n(N.E3,0.40), {vol:0.20,short:false}),
]};

/* ── BOSS Phase 3 ── melodic break, sad, resolving (♩=80) ──
   Slower, minor-mode lament. Vibrato on lead throughout.
   Sparse texture — bass drops out for final bars.
   Resolves to tonic E — the curse ends. */
const TRACK_BOSS3 = { bpm: 80, steps: [
  s(n(N.E5,0.16,true),  n(N.B4,0.10,true),  n(N.E3,0.28)),
  s(n(N.D5,0.14,true),  n(N.A4,0.09,true),  n(N.E3,0.26)),
  s(n(N.C5,0.16,true),  n(N.A4,0.10,true),  n(N.A3,0.26)),
  s(n(N.B4,0.14,true),  n(N['G#4'],0.09,true), n(N.E3,0.24)),
  s(n(N.A4,0.16,true),  n(N.E4,0.10,true),  n(N.A3,0.26)),
  s(n(N['G#4'],0.14,true), n(N.E4,0.09,true), n(N['G#3'],0.24)),
  s(n(N.F4,0.16,true),  n(N.C4,0.10,true),  n(N.F3,0.24)),
  s(n(N.E4,0.18,true),  n(N.B3,0.11,true),  n(N.E3,0.22)),
  s(n(N.A4,0.14,true),  n(N.E4,0.09,true),  null),
  s(n(N['G#4'],0.12,true), n(N.E4,0.08,true), null),
  s(n(N.F4,0.14,true),  n(N.C4,0.09,true),  null),
  s(n(N.E4,0.16,true),  null,               null),
  s(n(N.D4+1,0.12,true), null,              null),
  s(n(N.C4,0.12,true),  null,               null),
  s(n(N.B3,0.14,true),  null,               null),
  s(n(N.E4,0.16,true),  null,               null),  /* resolve to tonic */
]};

/* Track registry — keyed by zone ID and boss phase */
const TRACKS = {
  [ZONE_ID.ENTRY]:   TRACK_ENTRY,
  [ZONE_ID.CRYPT]:   TRACK_CRYPT,
  [ZONE_ID.CLOCK]:   TRACK_CLOCK,
  [ZONE_ID.SANCTUM]: TRACK_SANCTUM,
  [ZONE_ID.THRONE]:  TRACK_THRONE,
  [ZONE_ID.BOSS]:    TRACK_BOSS12,
  'BOSS_PHASE3':     TRACK_BOSS3,
};

/* ----------------------------------------------------------------
   A7. SCHEDULER CORE
   Look-ahead pattern: schedules all notes that fall within
   [now, now + SCHED_AHEAD]. Runs every SCHED_POLL_MS.
---------------------------------------------------------------- */

function scheduleStep(stepIdx, time) {
  if (!currentTrack) return;
  const step = currentTrack.steps[stepIdx % currentTrack.steps.length];
  const stepDur = 60 / currentTrack.bpm / 2;  /* eighth-note grid */

  /* pulse1 — channel steal: skip if SFX has muted it */
  if (step.p1 && !pulse1MusicMuted) {
    const g = playNote({
      wave:  waveP125,
      freq:  pitch(step.p1.semi),
      start: time,
      dur:   stepDur,
      vol:   step.p1.vol,
      vibrato: step.p1.vib,
    });
    pulse1MusicGain = g;
  }

  /* pulse2 — 25% duty, structural harmony */
  if (step.p2) {
    playNote({
      wave:  waveP25,
      freq:  pitch(step.p2.semi),
      start: time,
      dur:   stepDur,
      vol:   step.p2.vol,
      vibrato: step.p2.vib,
    });
  }

  /* triangle — bass line, one octave lower */
  if (step.tri) {
    playNote({
      wave:  waveTri,
      freq:  pitch(step.tri.semi),
      start: time,
      dur:   stepDur * 0.95,
      vol:   step.tri.vol,
    });
  }

  /* noise — percussion/atmosphere layer */
  if (step.noise) {
    playNoise({
      start: time,
      dur:   stepDur * 0.5,
      vol:   step.noise.vol,
      short: step.noise.short,
    });
  }
}

function runScheduler() {
  if (!ctx || !musicPlaying || musicPaused) return;
  const stepDur = 60 / currentTrack.bpm / 2;
  while (schedNextTime < ctx.currentTime + SCHED_AHEAD) {
    scheduleStep(musicStep, schedNextTime);
    schedNextTime += stepDur;
    musicStep++;
  }
}

function startScheduler() {
  if (schedTimer) clearTimeout(schedTimer);
  function loop() {
    runScheduler();
    schedTimer = setTimeout(loop, SCHED_POLL_MS);
  }
  loop();
}

function stopScheduler() {
  if (schedTimer) { clearTimeout(schedTimer); schedTimer = null; }
}

/* ----------------------------------------------------------------
   A8. PUBLIC MUSIC API
---------------------------------------------------------------- */

function playTrack(trackKey) {
  if (!ready) return;
  const track = TRACKS[trackKey];
  if (!track) return;
  if (currentTrack === track && musicPlaying) return;  /* already playing */

  currentTrack  = track;
  musicStep     = 0;
  musicPlaying  = true;
  musicPaused   = false;
  schedNextTime = ctx.currentTime + 0.05;
  if (DEBUG) console.log(`[audio] track: ${trackKey}`);
}

function pauseMusic()  { musicPaused = true; }
function resumeMusic() { musicPaused = false; }
function stopMusic()   { musicPlaying = false; currentTrack = null; stopScheduler(); }

/* ----------------------------------------------------------------
   A9. SOUND EFFECTS
   All SFX use channel-steal on pulse1 (brief — 100-200ms).
   Triangle and pulse2 music continues undisturbed.
---------------------------------------------------------------- */

function _steal(ms) {
  /* Mute pulse1 music voice for ms milliseconds */
  if (pulse1MusicGain) {
    try { pulse1MusicGain.gain.setValueAtTime(0, ctx.currentTime); } catch(e) {}
  }
  pulse1MusicMuted = true;
  pulse1MuteTimer  = ms;
  /* Auto-restore handled in Audio.update() called from game loop */
}

const SFX = {

  /* Player attack — short percussive metallic hit */
  attack(weaponName) {
    if (!ready) return;
    const now = ctx.currentTime;
    _steal(80);
    if (weaponName === 'bone_whip') {
      /* Whip crack: fast downward sweep F5→C4 */
      playNote({ wave: waveP125, freq: pitch(N.F5), start: now,
        dur: 0.12, vol: 0.28,
        sweep: { target: pitch(N.C4), dur: 0.10 } });
    } else if (weaponName === 'holy_axe') {
      /* Axe throw: rising metallic sweep */
      playNote({ wave: waveP125, freq: pitch(N.A4), start: now,
        dur: 0.14, vol: 0.26,
        sweep: { target: pitch(N.E5), dur: 0.12 } });
    } else if (weaponName === 'cursed_dagger') {
      /* Dagger: fast short blip */
      playNote({ wave: waveP125, freq: pitch(N.E5), start: now,
        dur: 0.06, vol: 0.22 });
      playNote({ wave: waveP125, freq: pitch(N.B4), start: now + 0.04,
        dur: 0.05, vol: 0.16 });
    } else if (weaponName === 'void_scythe') {
      /* Scythe wide sweep — low whoosh */
      playNoise({ start: now, dur: 0.18, vol: 0.20, short: false });
      playNote({ wave: waveP25, freq: pitch(N.E4), start: now,
        dur: 0.14, vol: 0.18,
        sweep: { target: pitch(N.E3), dur: 0.12 } });
    } else {
      /* Sword: clean chop */
      playNote({ wave: waveP125, freq: pitch(N.A5), start: now,
        dur: 0.08, vol: 0.24,
        sweep: { target: pitch(N.E4), dur: 0.07 } });
    }
  },

  /* Enemy hit — distinct by type */
  enemyHit(enemyType) {
    if (!ready) return;
    const now = ctx.currentTime;
    const hits = {
      skeleton:       { f: N.C5,   dur: 0.09, vol: 0.20 },
      bat:            { f: N.E5,   dur: 0.06, vol: 0.16 },
      armored_guard:  { f: N.A3,   dur: 0.14, vol: 0.24 },
      crawler:        { f: N.D5,   dur: 0.08, vol: 0.18 },
      grave_worm:     { f: N.F4,   dur: 0.10, vol: 0.16 },
      ghost:          { f: N.B5,   dur: 0.12, vol: 0.14 },
      mech_construct: { f: N.A3,   dur: 0.14, vol: 0.22 },
      clockwork_bird: { f: N.D5,   dur: 0.07, vol: 0.16 },
      gear_golem:     { f: N.E3,   dur: 0.18, vol: 0.26 },
    };
    const cfg = hits[enemyType] || hits.skeleton;
    playNote({ wave: waveP25, freq: pitch(cfg.f), start: now,
      dur: cfg.dur, vol: cfg.vol,
      sweep: { target: pitch(cfg.f - 7), dur: cfg.dur * 0.8 } });
  },

  /* Player hurt — classic NES death-sound DNA: downward sweep + noise burst */
  playerHurt() {
    if (!ready) return;
    const now = ctx.currentTime;
    _steal(180);
    playNote({ wave: waveP125, freq: pitch(N.A5), start: now,
      dur: 0.18, vol: 0.30,
      sweep: { target: pitch(N.E3), dur: 0.16 } });
    playNoise({ start: now + 0.05, dur: 0.12, vol: 0.18, short: false });
  },

  /* Player death — full dramatic descend */
  playerDead() {
    if (!ready) return;
    const now = ctx.currentTime;
    stopMusic();
    playNote({ wave: waveP125, freq: pitch(N.E5), start: now,
      dur: 0.22, vol: 0.30,
      sweep: { target: pitch(N.E4), dur: 0.20 } });
    playNote({ wave: waveP25, freq: pitch(N.B4), start: now + 0.18,
      dur: 0.22, vol: 0.24,
      sweep: { target: pitch(N.B3), dur: 0.20 } });
    playNote({ wave: waveTri, freq: pitch(N.E3), start: now + 0.34,
      dur: 0.30, vol: 0.32,
      sweep: { target: pitch(N.E2+3), dur: 0.28 } });
    playNoise({ start: now + 0.42, dur: 0.22, vol: 0.22, short: false });
  },

  /* The Hand — approach scratch, panned toward hand's position  */
  handApproach(panAmount) {
    if (!ready) return;
    const now = ctx.currentTime;
    /* Metallic short-period LFSR buzz — the "scratching on stone" */
    playNoise({ start: now, dur: 0.16, vol: 0.20, short: true,
      pan: Math.max(-1, Math.min(1, panAmount)) });
    playNote({ wave: waveP125, freq: pitch(N.E3), start: now,
      dur: 0.12, vol: 0.10, pan: panAmount,
      sweep: { target: pitch(N.F3), dur: 0.10 } });
  },

  /* The Hand — contact hit (deep bass impact) */
  handTouch() {
    if (!ready) return;
    const now = ctx.currentTime;
    _steal(250);
    /* Sub-bass thud: triangle sweep down + noise burst */
    playNote({ wave: waveTri, freq: pitch(N.E3), start: now,
      dur: 0.25, vol: 0.40,
      sweep: { target: pitch(N.E2+3), dur: 0.22 } });
    playNoise({ start: now, dur: 0.20, vol: 0.30, short: false });
    /* Dissonant sting on pulse1 */
    playNote({ wave: waveP125, freq: pitch(N.F4), start: now,
      dur: 0.15, vol: 0.28,
      sweep: { target: pitch(N.B3), dur: 0.12 } });
  },

  /* Weapon swap — quick ascending blip */
  weaponSwap() {
    if (!ready) return;
    const now = ctx.currentTime;
    playNote({ wave: waveP25, freq: pitch(N.A4), start: now,
      dur: 0.04, vol: 0.18 });
    playNote({ wave: waveP25, freq: pitch(N.C5), start: now + 0.04,
      dur: 0.04, vol: 0.20 });
    playNote({ wave: waveP25, freq: pitch(N.E5), start: now + 0.08,
      dur: 0.05, vol: 0.22 });
  },

  /* Lore pickup — haunting sustained tone (long note with vibrato) */
  lorePickup() {
    if (!ready) return;
    const now = ctx.currentTime;
    /* 50% duty pulse — rounder, more choir-like */
    playNote({ wave: waveP50, freq: pitch(N.E5), start: now,
      dur: 1.8, vol: 0.16, vibrato: true, vibratoDepth: 0.5 });
    playNote({ wave: waveP50, freq: pitch(N.B4), start: now + 0.1,
      dur: 1.6, vol: 0.10, vibrato: true, vibratoDepth: 0.4 });
  },

  /* Boss phase transition — full-screen flash + silence beat */
  bossPhaseTransition(nextPhase) {
    if (!ready) return;
    const now = ctx.currentTime;
    stopMusic();
    /* Half-second silence, then dramatic stab */
    const stab = now + 0.50;
    playNote({ wave: waveP125, freq: pitch(N.E4), start: stab,
      dur: 0.18, vol: 0.35 });
    playNote({ wave: waveP25,  freq: pitch(N.B3), start: stab,
      dur: 0.18, vol: 0.28 });
    playNote({ wave: waveTri,  freq: pitch(N.E3), start: stab,
      dur: 0.18, vol: 0.38 });
    playNoise({ start: stab, dur: 0.16, vol: 0.25, short: false });
    /* Resume appropriate track after silence beat */
    const resumeKey = nextPhase === 3 ? 'BOSS_PHASE3' : ZONE_ID.BOSS;
    setTimeout(() => {
      if (G.state === STATE.PLAYING) playTrack(resumeKey);
    }, (stab - now + 0.40) * 1000);
  },

  /* Zone entry chime — very short, confirms zone change */
  zoneEnter() {
    if (!ready) return;
    const now = ctx.currentTime;
    playNote({ wave: waveP25, freq: pitch(N.E5), start: now,
      dur: 0.08, vol: 0.16 });
    playNote({ wave: waveP25, freq: pitch(N.A5), start: now + 0.06,
      dur: 0.08, vol: 0.14 });
  },

  /* Jump — short upward blip (no channel steal needed — very brief) */
  jump() {
    if (!ready) return;
    const now = ctx.currentTime;
    playNote({ wave: waveP125, freq: pitch(N.A4), start: now,
      dur: 0.07, vol: 0.14,
      sweep: { target: pitch(N.E5), dur: 0.06 } });
  },
};

/* ----------------------------------------------------------------
   A10. INITIALISATION
   Called on first user gesture (title START press via onStateEnter).
   Creates AudioContext, builds waveforms, starts dummy node,
   starts scheduler.
---------------------------------------------------------------- */

function init() {
  if (ctx) return;  /* idempotent */

  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) {
    console.warn('[audio] WebAudio not available:', e);
    return;
  }

  /* CRITICAL: always read sampleRate from context — never hardcode */
  SR = ctx.sampleRate;
  if (DEBUG) console.log(`[audio] context created, sampleRate=${SR}Hz`);

  /* Master gain — all nodes route here */
  masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(1.0, ctx.currentTime);
  masterGain.connect(ctx.destination);

  /* Build waveforms */
  waveP125 = buildPulse(0.125);
  waveP25  = buildPulse(0.25);
  waveP50  = buildPulse(0.50);
  waveTri  = buildSteppedTriangle();

  /* Build long-mode noise buffer once (short-mode built on demand) */
  noiseBuffer = buildNoiseBuffer(false);

  /* Dummy ScriptProcessorNode — forces browser to keep audio thread alive
     when tab is backgrounded, preventing scheduler stutter.
     ScriptProcessorNode is deprecated but remains the only reliable
     single-file solution (AudioWorklet requires an external module URL
     or a Blob URL which requires careful CSP handling; the Blob approach
     works but the ScriptProcessor is simpler and sufficient for jam). */
  try {
    dummyNode = ctx.createScriptProcessor(4096, 0, 1);
    dummyNode.onaudioprocess = function() { runScheduler(); };
    dummyNode.connect(ctx.destination);
  } catch(e) {
    /* Fallback: scheduler runs purely on setTimeout — acceptable */
    if (DEBUG) console.log('[audio] ScriptProcessor unavailable, using setTimeout only');
  }

  ctx.resume().then(() => {
    ready = true;
    startScheduler();
    if (DEBUG) console.log('[audio] ready');
  });
}

/* ----------------------------------------------------------------
   A11. PER-FRAME UPDATE
   Called from the game loop once per frame.
   Handles: channel-steal timer, Hand warning SFX.
---------------------------------------------------------------- */

function update() {
  if (!ready) return;

  /* Channel-steal countdown */
  if (pulse1MusicMuted) {
    pulse1MuteTimer--;
    if (pulse1MuteTimer <= 0) {
      pulse1MusicMuted = false;
      pulse1MuteTimer  = 0;
    }
  }

  /* Jump SFX — INPUT.A.just is still valid here (flush happens after all updates) */
  if (INPUT.A.just && G.player && G.player.onGround) {
    SFX.jump();
  }

  /* Hand approach scratch — fires once when warnTimer flips to 1,
     then grows louder proportional to distance (called each frame
     while active but throttled to every 30 frames to avoid spam). */
  const hand = G.theHand;
  if (hand && hand.active && !hand.stunTimer && G.player) {
    if (hand.warnTimer > 0 && G.frame % 30 === 0) {
      /* Pan based on Hand position relative to viewport centre */
      const hcx = hand.x + hand.w * 0.5;
      const sceneW = NES.W;
      const pan = ((hcx - Camera.x) - sceneW * 0.5) / (sceneW * 0.5);
      SFX.handApproach(pan);
    }
  }
}

/* ----------------------------------------------------------------
   A12. HOOK INTO GAME SYSTEMS
   All hooks use the assignment pattern (no hoisting issue —
   existing bindings are already assigned, not declared here).
---------------------------------------------------------------- */

/* ── enterZone → start zone music + zone-entry chime ── */
const _origEnterZoneAudio = enterZone;
enterZone = function(zoneId) {
  _origEnterZoneAudio(zoneId);
  if (!ready && zoneId === ZONE_ID.ENTRY) init();
  if (ready || zoneId === ZONE_ID.ENTRY) {
    /* Slight delay so init() completes before playTrack */
    setTimeout(() => {
      SFX.zoneEnter();
      if (TRACKS[zoneId]) playTrack(zoneId);
    }, 60);
  }
};

/* ── setState → death music, pause/resume music ── */
const _origSetStateAudio = setState;
setState = function(next) {
  const prev = G.state;
  _origSetStateAudio(next);
  if (!ready) return;
  if (next === STATE.DEAD  && prev === STATE.PLAYING) SFX.playerDead();
  if (next === STATE.PAUSED) pauseMusic();
  if (next === STATE.PLAYING && prev === STATE.PAUSED) resumeMusic();
  if (next === STATE.TITLE)  stopMusic();
};

/* ── damagePlayer → hurt SFX ── */
const _origDamagePlayerAudio = damagePlayer;
damagePlayer = function(amount, sourceX) {
  const prevHp = G.player ? G.player.hp : 0;
  _origDamagePlayerAudio(amount, sourceX);
  const p = G.player;
  if (p && p.hp < prevHp && p.hp > 0) SFX.playerHurt();
  /* Hand touch is detected separately in TheHand.update via contact */
};

/* ── enemyTakeDamage → enemy hit SFX ── */
const _origEnemyTakeDamageAudio = enemyTakeDamage;
enemyTakeDamage = function(enemy, amount, sourceX) {
  _origEnemyTakeDamageAudio(enemy, amount, sourceX);
  if (ready) SFX.enemyHit(enemy.type);
};

/* ── playerUpdate → attack SFX + jump SFX + weapon swap SFX ──
   Patch new playerUpdate (already reassigned) to intercept inputs. */
const _origPlayerUpdateAudio = playerUpdate;
playerUpdate = function() {
  const p = G.player;
  const prevAttack = p ? p.attackTimer : 0;
  const prevGround = p ? p.onGround : false;
  const prevIdx    = p ? p.weaponIdx : 0;
  _origPlayerUpdateAudio();
  if (!ready || !G.player) return;
  const pp = G.player;
  /* Attack started this frame */
  if (pp.attackTimer > 0 && prevAttack === 0) {
    SFX.attack(pp.weapons[pp.weaponIdx] || 'sword');
  }
  /* Jump started this frame: was on ground, now airborne with upward velocity */
  if (prevGround && !pp.onGround && pp.vy < 0) {
    SFX.jump();
  }
  /* Weapon swap */
  if (pp.weaponIdx !== prevIdx) SFX.weaponSwap();
};

/* ── lorePanel.show → lore pickup SFX ── */
const _origLorePanelShow = lorePanel.show.bind(lorePanel);
lorePanel.show = function(lines) {
  _origLorePanelShow(lines);
  SFX.lorePickup();
};

/* ── TheHand contact → hand touch SFX ──
   Patch into TheHand._spawn which is called after contact. */
const _origHandSpawn = TheHand._spawn.bind(TheHand);
TheHand._spawn = function() {
  const wasActive = this.active;
  _origHandSpawn();
  /* If Hand was active and just re-spawned, it touched the player */
  if (wasActive && ready) SFX.handTouch();
};

/* ── Game loop integration — Audio.update() called each frame ── */
G.audio = {
  init, playTrack, stopMusic, pauseMusic, resumeMusic,
  SFX, update: update,
};

/* Hook Audio.update into the game's per-frame update via zoneView */
const _origZoneViewUpdateAudio = zoneView.update.bind(zoneView);
zoneView.update = function() {
  _origZoneViewUpdateAudio();
  if (G.state === STATE.PLAYING) Audio.update();
};

/* Jump SFX fires before physics, via Audio.update() which is called
   from the zoneView.update hook above — INPUT.A.just is still set at that point. */

/* Export everything needed */
return { init, playTrack, stopMusic, pauseMusic, resumeMusic, SFX, update };
})();