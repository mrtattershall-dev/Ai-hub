/**
 * PinPortrait — interface layer.
 *
 * Owns every piece of DOM outside the WebGL canvas: the control panel, the
 * loading/error overlays, the interaction hint and the stats readout. The
 * controls are generated from `config.js`, so adding a palette or a shape there
 * makes it appear here automatically.
 */

import { PALETTES, SHAPES, LIMITS } from "./config.js";

const $ = (selector) => document.querySelector(selector);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function createUI({ settings, onChange, onReset, onSnapshot, onRetry }) {
  const loading = $("#loading");
  const errorBox = $("#error");
  const errorTitle = $("#error-title");
  const errorMessage = $("#error-message");
  const retryButton = $("#error-retry");
  const hint = $("#hint");
  const stats = $("#stats");
  const controls = $("#controls");
  const panelToggle = $("#panel-toggle");
  const toast = $("#toast");

  let hintTimer = null;
  let toastTimer = null;
  const readouts = new Map();

  // ---------------------------------------------------------------- controls

  function addRange(key, label, { min, max, step }, format = (v) => v) {
    const row = el("div", "row");
    const head = el("div", "row-head");
    const id = `ctl-${key}`;

    const labelEl = el("label", "row-label", label);
    labelEl.htmlFor = id;

    const value = el("span", "row-value", format(settings[key]));
    readouts.set(key, value);

    head.append(labelEl, value);

    const input = el("input", "range");
    input.type = "range";
    input.id = id;
    input.min = min;
    input.max = max;
    input.step = step;
    input.value = settings[key];

    input.addEventListener("input", () => {
      const next = Number(input.value);
      value.textContent = format(next);
      onChange(key, next);
    });

    row.append(head, input);
    controls.append(row);
  }

  function addChips(key, label, options, renderChip) {
    const row = el("div", "row");
    row.append(el("div", "row-label", label));

    const group = el("div", "chips");
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);

    for (const [value, meta] of Object.entries(options)) {
      const chip = el("button", "chip");
      chip.type = "button";
      chip.dataset.value = value;
      chip.setAttribute("aria-pressed", String(settings[key] === value));
      renderChip(chip, value, meta);

      chip.addEventListener("click", () => {
        for (const sibling of group.children) {
          sibling.setAttribute("aria-pressed", String(sibling === chip));
        }
        onChange(key, value);
      });

      group.append(chip);
    }

    row.append(group);
    controls.append(row);
  }

  function addToggle(key, label) {
    const row = el("div", "row row-inline");
    const button = el("button", "switch");
    button.type = "button";
    button.id = `ctl-${key}`;
    button.setAttribute("role", "switch");
    button.setAttribute("aria-checked", String(settings[key]));
    button.append(el("span", "switch-thumb"));

    const labelEl = el("label", "row-label", label);
    labelEl.htmlFor = button.id;

    button.addEventListener("click", () => {
      const next = button.getAttribute("aria-checked") !== "true";
      button.setAttribute("aria-checked", String(next));
      onChange(key, next);
    });

    row.append(labelEl, button);
    controls.append(row);
    return button;
  }

  function addActions() {
    const row = el("div", "row row-actions");

    const reset = el("button", "button", "Reset view");
    reset.type = "button";
    reset.addEventListener("click", onReset);

    const save = el("button", "button button-primary", "Save PNG");
    save.type = "button";
    save.addEventListener("click", onSnapshot);

    row.append(reset, save);
    controls.append(row);
  }

  addRange("cellSize", "Pin size", LIMITS.cellSize, (v) => `${v} px`);
  addRange("depth", "Depth", LIMITS.depth, (v) => `${Number(v).toFixed(2)}×`);
  addRange("threshold", "Threshold", LIMITS.threshold, (v) =>
    Number(v) === 0 ? "off" : `${Math.round(Number(v) * 100)}%`,
  );
  addRange("smoothing", "Smoothing", LIMITS.smoothing, (v) =>
    Number(v) === 0 ? "off" : `${Math.round(Number(v) * 100)}%`,
  );

  addChips("palette", "Palette", PALETTES, (chip, _value, meta) => {
    const swatch = el("span", "swatch");
    swatch.style.background = meta.swatch;
    chip.append(swatch, el("span", null, meta.label));
    chip.classList.add("chip-palette");
  });

  addChips("shape", "Shape", SHAPES, (chip, _value, meta) => {
    chip.textContent = meta;
  });

  addToggle("mirror", "Mirror");
  addToggle("autoRotate", "Auto-orbit");
  const statsToggle = addToggle("showStats", "Show stats");
  addActions();

  // ---------------------------------------------------------------- overlays

  function showLoading(message = "Waking up the camera…") {
    loading.querySelector(".overlay-message").textContent = message;
    loading.hidden = false;
    errorBox.hidden = true;
  }

  function showError(title, message, { retryable = true } = {}) {
    errorTitle.textContent = title;
    errorMessage.textContent = message;
    retryButton.hidden = !retryable;
    errorBox.hidden = false;
    loading.hidden = true;
  }

  function ready() {
    loading.hidden = true;
    errorBox.hidden = true;
    document.body.classList.add("is-ready");
    pulseHint();
  }

  function pulseHint() {
    hint.hidden = false;
    // Force a reflow so the transition runs even if the hint was just shown.
    void hint.offsetWidth;
    hint.classList.add("is-visible");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(dismissHint, 6000);
  }

  function dismissHint() {
    clearTimeout(hintTimer);
    hint.classList.remove("is-visible");
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2400);
  }

  function setStats(fps, pins) {
    if (stats.hidden) return;
    stats.textContent = `${fps} fps · ${pins.toLocaleString()} pins`;
  }

  /** Let the sketch correct a readout — e.g. when the pin-count ceiling forces
   *  a larger cell than the slider asked for. */
  function setRangeDisplay(key, text) {
    const node = readouts.get(key);
    if (node) node.textContent = text;
  }

  function applyStatsVisibility(visible) {
    stats.hidden = !visible;
    statsToggle.setAttribute("aria-checked", String(visible));
  }

  applyStatsVisibility(settings.showStats);

  // ------------------------------------------------------------- interaction

  retryButton.addEventListener("click", onRetry);

  panelToggle.addEventListener("click", () => {
    const collapsed = document.body.classList.toggle("panel-collapsed");
    panelToggle.setAttribute("aria-expanded", String(!collapsed));
  });

  // The hint has done its job the moment the user starts exploring.
  window.addEventListener("pointerdown", dismissHint, { once: true });
  window.addEventListener("wheel", dismissHint, { once: true, passive: true });

  window.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    switch (event.key.toLowerCase()) {
      case "h":
        document.body.classList.toggle("chrome-hidden");
        break;
      case "r":
        onReset();
        break;
      case "s":
        onSnapshot();
        break;
      case "f":
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
        break;
      default:
        return;
    }
    event.preventDefault();
  });

  return {
    showLoading,
    showError,
    ready,
    setStats,
    setRangeDisplay,
    applyStatsVisibility,
    showToast,
    pulseHint,
  };
}
