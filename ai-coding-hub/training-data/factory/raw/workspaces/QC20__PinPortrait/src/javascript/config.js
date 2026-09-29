/**
 * PinPortrait — configuration, palettes and settings persistence.
 */

/** Hard ceiling on instance count. Guards against a 4K webcam + tiny cell size
 *  producing hundreds of thousands of pins and locking up the GPU. */
export const MAX_PINS = 26000;

/** Webcam capture resolution we ask for. Lower = less to sample each frame. */
export const CAPTURE = { width: 1280, height: 720 };

export const LIMITS = {
  cellSize: { min: 4, max: 32, step: 1 },
  depth: { min: 0, max: 2.5, step: 0.05 },
  threshold: { min: 0, max: 0.5, step: 0.01 },
  smoothing: { min: 0, max: 0.92, step: 0.02 },
};

export const DEFAULTS = {
  cellSize: 10, // pixels of video per pin
  depth: 1.0, // height multiplier
  threshold: 0.04, // pins dimmer than this stay flat
  smoothing: 0.8, // 0 = snap instantly, higher = softer ripple
  palette: "mono", // key into PALETTES
  shape: "pin", // key into SHAPES
  mirror: true, // mirror like a real mirror
  autoRotate: false,
  showStats: true,
};

export const SHAPES = {
  pin: "Pin",
  box: "Box",
  sphere: "Sphere",
};

/**
 * A palette maps one sampled pixel to a colour.
 *
 * Each function receives the sRGB channels (0..1) plus precomputed relative
 * luminance, and writes into `out` (a reused THREE.Color — never allocate here,
 * this runs once per pin per frame).
 *
 * `setRGB` is called with the sRGB colour space so three.js converts into its
 * linear working space correctly.
 */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Sample a gradient defined as [stopPosition, r, g, b] tuples (0..1). */
function ramp(stops, t, out, srgb) {
  let i = 1;
  while (i < stops.length - 1 && t > stops[i][0]) i++;
  const a = stops[i - 1];
  const b = stops[i];
  const span = b[0] - a[0] || 1;
  const k = Math.min(1, Math.max(0, (t - a[0]) / span));
  out.setRGB(lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k), srgb);
}

const EMBER_STOPS = [
  [0.0, 0.05, 0.02, 0.09],
  [0.35, 0.55, 0.11, 0.24],
  [0.7, 0.95, 0.45, 0.13],
  [1.0, 1.0, 0.94, 0.7],
];

const ICE_STOPS = [
  [0.0, 0.02, 0.04, 0.12],
  [0.4, 0.09, 0.35, 0.6],
  [0.75, 0.35, 0.78, 0.92],
  [1.0, 0.9, 0.99, 1.0],
];

const NEON_STOPS = [
  [0.0, 0.04, 0.0, 0.1],
  [0.45, 0.6, 0.05, 0.75],
  [0.8, 0.05, 0.85, 0.85],
  [1.0, 0.85, 1.0, 0.95],
];

/** Build the CSS gradient shown on a palette chip, straight from its stops. */
function swatchFrom(stops) {
  const parts = stops.map(([pos, r, g, b]) => {
    const rgb = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
    return `${rgb} ${Math.round(pos * 100)}%`;
  });
  return `linear-gradient(135deg, ${parts.join(", ")})`;
}

export const PALETTES = {
  mono: {
    label: "Mono",
    swatch: "linear-gradient(135deg, #141414 0%, #f5f5f5 100%)",
    apply: (r, g, b, lum, out, srgb) => out.setRGB(lum, lum, lum, srgb),
  },
  color: {
    label: "Colour",
    swatch: "conic-gradient(from 210deg, #ff5f6d, #ffc371, #6ee7b7, #60a5fa, #c084fc, #ff5f6d)",
    apply: (r, g, b, lum, out, srgb) => out.setRGB(r, g, b, srgb),
  },
  ember: {
    label: "Ember",
    swatch: swatchFrom(EMBER_STOPS),
    apply: (r, g, b, lum, out, srgb) => ramp(EMBER_STOPS, lum, out, srgb),
  },
  ice: {
    label: "Ice",
    swatch: swatchFrom(ICE_STOPS),
    apply: (r, g, b, lum, out, srgb) => ramp(ICE_STOPS, lum, out, srgb),
  },
  neon: {
    label: "Neon",
    swatch: swatchFrom(NEON_STOPS),
    apply: (r, g, b, lum, out, srgb) => ramp(NEON_STOPS, lum, out, srgb),
  },
};

const STORAGE_KEY = "pinportrait:settings:v1";

export function loadSettings() {
  const settings = { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return settings;
    const saved = JSON.parse(raw);
    for (const key of Object.keys(DEFAULTS)) {
      if (saved[key] !== undefined && typeof saved[key] === typeof DEFAULTS[key]) {
        settings[key] = saved[key];
      }
    }
    // Guard against out-of-range values from an older build.
    if (!PALETTES[settings.palette]) settings.palette = DEFAULTS.palette;
    if (!SHAPES[settings.shape]) settings.shape = DEFAULTS.shape;
    settings.cellSize = clamp(settings.cellSize, LIMITS.cellSize);
    settings.depth = clamp(settings.depth, LIMITS.depth);
    settings.threshold = clamp(settings.threshold, LIMITS.threshold);
    settings.smoothing = clamp(settings.smoothing, LIMITS.smoothing);
  } catch {
    // Private browsing, disabled storage — defaults are fine.
  }
  return settings;
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Non-fatal: the sketch works without persistence.
  }
}

export function clamp(value, { min, max }) {
  return Math.min(max, Math.max(min, value));
}
