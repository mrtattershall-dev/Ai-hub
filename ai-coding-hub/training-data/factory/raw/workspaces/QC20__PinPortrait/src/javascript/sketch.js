/**
 * PinPortrait — a live 3D pixel portrait driven by your webcam.
 *
 * Originally by Johan Karlsson (DonKarlssonSan), 2018. Rebuilt around an
 * InstancedMesh so the whole portrait is a single draw call, and around a
 * downscale-on-the-GPU sampling pipeline so the per-frame pixel work no longer
 * happens in JavaScript.
 */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createUI } from "./ui.js";
import { CAPTURE, LIMITS, MAX_PINS, PALETTES, clamp, loadSettings, saveSettings } from "./config.js";

const BACKGROUND = 0x0a0c11;

/** The grid is always this many world units wide, whatever the pin count.
 *  Changing pin size then re-densifies the portrait instead of resizing it,
 *  so the camera never has to jump. */
const GRID_WIDTH = 100;

/** Peak relief as a fraction of the grid's row count (see heightScale). */
const RELIEF = 0.32;

const INV_255 = 1 / 255;
const SRGB = THREE.SRGBColorSpace;

const settings = loadSettings();

const state = {
  video: null,
  stream: null,
  cols: 0,
  rows: 0,
  cellSize: settings.cellSize,
  heightScale: 1,
  frameDirty: false,
  needsRender: true,
  running: false,
  vfcHandle: 0,
  // Heights ease toward their target instead of snapping, which is what gives
  // the grid its ripple. Sampling happens at video rate; the easing runs every
  // rendered frame, so the motion is smooth on a high-refresh display.
  targetZ: null,
  currentZ: null,
  settled: true,
};

/** Below this much movement the grid counts as settled and we stop re-rendering. */
const SETTLE_EPSILON = 0.0015;

/** Pins never fully collapse — a zero scale makes degenerate geometry. */
const MIN_HEIGHT = 0.06;

// Reused scratch objects — nothing in the per-frame path allocates.
const tint = new THREE.Color();

// Two-stage downscaler. Halving into `scratch` before the final reduction
// avoids the aliasing a single large bilinear step would produce.
const scratch = document.createElement("canvas");
const scratchCtx = scratch.getContext("2d", { alpha: false });
const sample = document.createElement("canvas");
const sampleCtx = sample.getContext("2d", { alpha: false, willReadFrequently: true });

let renderer;
let scene;
let camera;
let controls;
let group;
let mesh;
let material;

let ui;

// Adaptive quality: we only ever step down, to avoid oscillating.
let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
let qualityCooldown = 2;

let fpsFrames = 0;
let fpsSince = 0;

// ---------------------------------------------------------------- bootstrap

function main() {
  ui = createUI({
    settings,
    onChange: handleSettingChange,
    onReset: resetView,
    onSnapshot: saveSnapshot,
    onRetry: startCamera,
  });

  if (!initRenderer()) return;
  initScene();
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibilityChange);
  startCamera();
}

function initRenderer() {
  const canvas = document.querySelector("#view");
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      stencil: false,
      powerPreference: "high-performance",
    });
  } catch {
    ui.showError(
      "WebGL unavailable",
      "This browser can't create a WebGL context, so the 3D portrait can't be drawn. Try a different browser, or check that hardware acceleration is enabled.",
      { retryable: false },
    );
    return false;
  }

  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = SRGB;
  return true;
}

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND);
  scene.fog = new THREE.Fog(BACKGROUND, 1, 2000);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 4000);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.rotateSpeed = 0.55;
  controls.panSpeed = 0.7;
  controls.zoomSpeed = 0.8;
  controls.autoRotate = settings.autoRotate;
  controls.autoRotateSpeed = 0.6;
  controls.addEventListener("change", () => {
    state.needsRender = true;
  });

  // Soft sky/ground fill, a warm key from front-right and a cool rim from
  // behind-left — enough separation to read the relief without shadow maps,
  // which would be ruinous at this instance count.
  scene.add(new THREE.HemisphereLight(0xa8c6ff, 0x14100c, 1.15));

  const key = new THREE.DirectionalLight(0xfff2e0, 2.3);
  key.position.set(0.55, 0.8, 1.1);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x6f9cff, 1.15);
  rim.position.set(-0.9, -0.35, -0.7);
  scene.add(rim);

  group = new THREE.Group();
  scene.add(group);
}

// ------------------------------------------------------------------- camera

async function startCamera() {
  if (!window.isSecureContext) {
    ui.showError(
      "Insecure context",
      "Browsers only hand out the webcam over https:// or http://localhost. Opening index.html straight from disk won't work — run `npm run dev` and use the localhost URL it prints.",
      { retryable: false },
    );
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    ui.showError(
      "Webcam unsupported",
      "This browser doesn't expose getUserMedia, so there's no camera to read. Try a current version of Chrome, Firefox, Edge or Safari.",
      { retryable: false },
    );
    return;
  }

  ui.showLoading();
  stopCamera();

  try {
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        width: { ideal: CAPTURE.width },
        height: { ideal: CAPTURE.height },
        facingMode: "user",
      },
    });
  } catch (error) {
    const [title, message] = describeCameraError(error);
    ui.showError(title, message);
    return;
  }

  const video = document.querySelector("#source");
  video.srcObject = state.stream;
  state.video = video;

  try {
    await once(video, "loadedmetadata");
    await video.play();
  } catch (error) {
    ui.showError("Couldn't start the video", error?.message ?? "The camera stream failed to start.");
    return;
  }

  rebuild();
  resetView();
  ui.ready();
  start();
}

function stopCamera() {
  state.running = false;
  if (state.vfcHandle && state.video?.cancelVideoFrameCallback) {
    state.video.cancelVideoFrameCallback(state.vfcHandle);
    state.vfcHandle = 0;
  }
  for (const track of state.stream?.getTracks() ?? []) track.stop();
  state.stream = null;
}

function once(target, event) {
  return new Promise((resolve, reject) => {
    target.addEventListener(event, resolve, { once: true });
    target.addEventListener("error", reject, { once: true });
  });
}

function describeCameraError(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "SecurityError":
      return [
        "Camera access blocked",
        "PinPortrait needs the webcam to draw anything. Allow camera access from the icon in your browser's address bar, then try again.",
      ];
    case "NotFoundError":
    case "DevicesNotFoundError":
      return ["No camera found", "No webcam is connected to this machine. Plug one in and try again."];
    case "OverconstrainedError":
      return ["Camera unsupported", "Your camera couldn't provide a usable video mode. Try a different device."];
    case "NotReadableError":
    case "TrackStartError":
      return [
        "Camera is busy",
        "Another app — Zoom, Photo Booth, another browser tab — is holding the camera. Close it and try again.",
      ];
    default:
      return ["Camera error", error?.message ?? "The webcam couldn't be opened."];
  }
}

// --------------------------------------------------------------------- grid

function computeGrid() {
  const vw = state.video.videoWidth || CAPTURE.width;
  const vh = state.video.videoHeight || CAPTURE.height;

  let cell = clamp(settings.cellSize, LIMITS.cellSize);
  let cols = Math.max(1, Math.floor(vw / cell));
  let rows = Math.max(1, Math.floor(vh / cell));

  // A high-resolution camera plus the smallest pin size can ask for hundreds of
  // thousands of instances. Grow the cell until the count is sane.
  while (cols * rows > MAX_PINS) {
    cell += 1;
    cols = Math.max(1, Math.floor(vw / cell));
    rows = Math.max(1, Math.floor(vh / cell));
  }

  state.cols = cols;
  state.rows = rows;
  state.cellSize = cell;
  // Keeping relief proportional to the row count means world-space depth stays
  // constant as the pin size changes.
  state.heightScale = rows * RELIEF;

  scratch.width = cols * 2;
  scratch.height = rows * 2;
  sample.width = cols;
  sample.height = rows;
  // Resizing a canvas resets its context state, so re-apply the filtering hints.
  scratchCtx.imageSmoothingEnabled = true;
  scratchCtx.imageSmoothingQuality = "high";
  sampleCtx.imageSmoothingEnabled = true;
  sampleCtx.imageSmoothingQuality = "high";
}

function buildGeometry() {
  let geometry;
  switch (settings.shape) {
    case "box":
      geometry = new THREE.BoxGeometry(0.9, 0.9, 1);
      break;
    case "sphere":
      geometry = new THREE.SphereGeometry(0.45, 8, 6);
      geometry.scale(1, 1, 1 / 0.9);
      break;
    case "pin":
    default:
      geometry = new THREE.CylinderGeometry(0.42, 0.42, 1, 8, 1, false);
      geometry.rotateX(Math.PI / 2);
      break;
  }
  // Normalise every shape to span z ∈ [0, 1] with its base on the backing
  // plane, so scaling z alone extrudes it outward like a real pin.
  geometry.translate(0, 0, 0.5);
  return geometry;
}

function disposeMesh() {
  if (!mesh) return;
  group.remove(mesh);
  mesh.geometry.dispose();
  mesh.material.dispose();
  mesh.dispose();
  mesh = null;
}

function rebuild() {
  computeGrid();
  disposeMesh();

  const count = state.cols * state.rows;
  material = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.06 });
  mesh = new THREE.InstancedMesh(buildGeometry(), material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(0.08), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  // The grid is effectively always in view; skipping the cull test avoids
  // recomputing an instanced bounding sphere we'd never benefit from.
  mesh.frustumCulled = false;

  state.targetZ = new Float32Array(count).fill(MIN_HEIGHT);
  state.currentZ = new Float32Array(count).fill(MIN_HEIGHT);
  state.settled = false;

  writeBaseMatrices();
  group.add(mesh);

  // One world unit per pin locally, scaled so the grid is always GRID_WIDTH across.
  group.scale.setScalar(GRID_WIDTH / state.cols);

  // Be honest in the readout when the pin ceiling overrode the slider.
  const capped = state.cellSize !== clamp(settings.cellSize, LIMITS.cellSize);
  ui.setRangeDisplay("cellSize", capped ? `${state.cellSize} px · capped` : `${state.cellSize} px`);

  state.frameDirty = true;
  state.needsRender = true;
}

/**
 * Seed each instance matrix. Rotation is always identity and x/y never change
 * per frame, so we write the translation and the unit scales once here; the
 * render loop then only touches the z-scale.
 *
 * Column-major layout: [0]=sx, [5]=sy, [10]=sz, [12..14]=translation, [15]=1.
 */
function writeBaseMatrices() {
  const { cols, rows } = state;
  const array = mesh.instanceMatrix.array;
  const halfCols = (cols - 1) / 2;
  const halfRows = (rows - 1) / 2;
  const mirror = settings.mirror;

  for (let row = 0, i = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++, i++) {
      const o = i * 16;
      array[o] = 1;
      array[o + 5] = 1;
      array[o + 10] = MIN_HEIGHT;
      array[o + 12] = (mirror ? cols - 1 - col : col) - halfCols;
      array[o + 13] = halfRows - row; // image row 0 is the top of the frame
      array[o + 14] = 0;
      array[o + 15] = 1;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
}

// ------------------------------------------------------------------ sampling

/**
 * Reduce the video frame to exactly one pixel per pin.
 *
 * The browser's own image filter does the box-averaging that used to be a
 * nested JS loop over every source pixel, and we then read back a grid-sized
 * buffer instead of a full-resolution one — orders of magnitude less work.
 */
function sampleFrame() {
  const { cols, rows, video } = state;
  scratchCtx.drawImage(video, 0, 0, cols * 2, rows * 2);
  sampleCtx.drawImage(scratch, 0, 0, cols * 2, rows * 2, 0, 0, cols, rows);
  return sampleCtx.getImageData(0, 0, cols, rows).data;
}

/** Read one sampled frame into target heights and instance colours. */
function updateInstances(pixels) {
  const count = state.cols * state.rows;
  const colors = mesh.instanceColor.array;
  const targetZ = state.targetZ;
  const apply = (PALETTES[settings.palette] ?? PALETTES.mono).apply;
  const scale = settings.depth * state.heightScale;
  const threshold = settings.threshold;

  for (let i = 0, p = 0, c = 0; i < count; i++, p += 4, c += 3) {
    const r = pixels[p] * INV_255;
    const g = pixels[p + 1] * INV_255;
    const b = pixels[p + 2] * INV_255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // Anything dimmer than the threshold stays flat, which lifts the subject
    // out of a dark background. Colour still tracks the real brightness.
    targetZ[i] = MIN_HEIGHT + (lum < threshold ? 0 : lum) * scale;

    apply(r, g, b, lum, tint, SRGB);
    colors[c] = tint.r;
    colors[c + 1] = tint.g;
    colors[c + 2] = tint.b;
  }

  mesh.instanceColor.needsUpdate = true;
  state.settled = false;
}

/**
 * Ease each pin toward its target height and write the z-scale into the
 * instance matrices. Returns false once the grid has come to rest, which lets
 * the render loop go idle between camera frames.
 */
function applyHeights() {
  const matrices = mesh.instanceMatrix.array;
  const { targetZ, currentZ } = state;
  const factor = 1 - settings.smoothing;
  let peak = 0;

  for (let i = 0; i < targetZ.length; i++) {
    const delta = targetZ[i] - currentZ[i];
    const moved = delta < 0 ? -delta : delta;
    if (moved > peak) peak = moved;

    const next = currentZ[i] + delta * factor;
    currentZ[i] = next;
    matrices[i * 16 + 10] = next;
  }

  mesh.instanceMatrix.needsUpdate = true;
  state.settled = peak < SETTLE_EPSILON;
}

// -------------------------------------------------------------- render loop

function start() {
  if (state.running) return;
  state.running = true;
  fpsSince = performance.now();
  fpsFrames = 0;
  scheduleVideoFrame();
  renderer.setAnimationLoop(tick);
}

function stop() {
  state.running = false;
  renderer.setAnimationLoop(null);
}

/**
 * Ask to be woken only when the camera actually delivers a new frame. A 30 fps
 * webcam on a 120 Hz display would otherwise be re-sampled four times per
 * frame for identical pixels.
 */
function scheduleVideoFrame() {
  const video = state.video;
  if (!video?.requestVideoFrameCallback) {
    state.frameDirty = true; // fallback: resample every tick
    return;
  }
  state.vfcHandle = video.requestVideoFrameCallback(() => {
    state.frameDirty = true;
    if (state.running) scheduleVideoFrame();
  });
}

function tick(now) {
  const moved = controls.update();

  if (state.frameDirty && mesh) {
    state.frameDirty = !state.video?.requestVideoFrameCallback; // stay dirty only on the fallback path
    updateInstances(sampleFrame());
  }

  // Run the easing every rendered frame, not just on new camera frames — that's
  // what makes a 30 fps feed look fluid on a 120 Hz display.
  if (mesh && !state.settled) {
    applyHeights();
    state.needsRender = true;
  }

  if (moved || state.needsRender) {
    state.needsRender = false;
    renderer.render(scene, camera);
  }

  measure(now);
}

function measure(now) {
  fpsFrames++;
  const elapsed = now - fpsSince;
  if (elapsed < 1000) return;

  const fps = Math.round((fpsFrames * 1000) / elapsed);
  fpsFrames = 0;
  fpsSince = now;
  ui.setStats(fps, state.cols * state.rows);

  if (qualityCooldown > 0) {
    qualityCooldown--;
    return;
  }
  // Sustained low frame rate: trade some resolution back for smoothness.
  if (fps < 40 && pixelRatio > 1) {
    pixelRatio = Math.max(1, pixelRatio - 0.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    state.needsRender = true;
    qualityCooldown = 3;
  }
}

// ------------------------------------------------------------------- events

function handleSettingChange(key, value) {
  settings[key] = value;
  saveSettings(settings);

  switch (key) {
    case "cellSize":
    case "shape":
      scheduleRebuild();
      break;
    case "mirror":
      if (mesh) writeBaseMatrices();
      break;
    case "autoRotate":
      controls.autoRotate = value;
      break;
    case "showStats":
      ui.applyStatsVisibility(value);
      break;
    default:
      break; // depth and palette are read fresh each frame
  }

  state.frameDirty = true;
  state.needsRender = true;
}

let rebuildQueued = false;
function scheduleRebuild() {
  // Dragging the pin-size slider fires a stream of events; collapse them into
  // one rebuild per frame.
  if (rebuildQueued || !state.video) return;
  rebuildQueued = true;
  requestAnimationFrame(() => {
    rebuildQueued = false;
    if (state.video) rebuild();
  });
}

function resetView() {
  if (!state.cols) return;
  const halfWidth = GRID_WIDTH / 2;
  const halfHeight = (GRID_WIDTH * state.rows) / state.cols / 2;
  const half = THREE.MathUtils.degToRad(camera.fov) / 2;

  // Pins extrude toward the camera, so the widest thing to fit isn't the
  // backing plane at z=0 but the plane at peak relief. Frame for that, or the
  // tallest pins spill off the edges of the viewport.
  const relief = (state.heightScale * settings.depth * GRID_WIDTH) / state.cols;
  const fit = Math.max(halfHeight / Math.tan(half), halfWidth / (Math.tan(half) * camera.aspect));
  const distance = fit * 1.22 + relief;

  camera.position.set(0, 0, distance);
  camera.near = distance / 200;
  camera.far = distance * 20;
  camera.updateProjectionMatrix();

  controls.target.set(0, 0, 0);
  controls.minDistance = distance * 0.12;
  controls.maxDistance = distance * 4;
  controls.update();

  scene.fog.near = distance * 0.75;
  scene.fog.far = distance * 3.2;

  state.needsRender = true;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  state.needsRender = true;
}

function onVisibilityChange() {
  if (document.hidden) {
    stop();
    // Releasing the track idles the sensor and turns the camera light off
    // while you're on another tab.
    for (const track of state.stream?.getVideoTracks() ?? []) track.enabled = false;
    state.video?.pause();
  } else if (state.stream) {
    for (const track of state.stream.getVideoTracks()) track.enabled = true;
    state.video?.play().catch(() => {});
    state.needsRender = true;
    start();
  }
}

function saveSnapshot() {
  if (!renderer || !mesh) return;
  // toDataURL must run in the same task as the render, otherwise the drawing
  // buffer is already cleared (we deliberately don't pay for preserveDrawingBuffer).
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");

  const link = document.createElement("a");
  link.href = url;
  link.download = `pinportrait-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
  link.click();
  ui.showToast("Portrait saved");
}

window.addEventListener("pagehide", stopCamera);

main();
