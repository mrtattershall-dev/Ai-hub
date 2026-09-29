/**
 * config.js — central tuning + constants.
 *
 * Every "magic number" that designers might want to tweak lives here so the
 * rest of the codebase reads as intent ("apply gravity") rather than literals.
 * Treat this file as the game's primary balance sheet.
 *
 * @module config
 */

export const CONFIG = {
  version: "0.1.0",
  title: "PROJECT MEMORY CARD",

  /** Internal render resolution. The canvas element matches this exactly. */
  view: { width: 960, height: 540 },

  /** Fixed simulation step. Physics runs at a constant 120 Hz for stability. */
  sim: {
    hz: 120,
    get dt() {
      return 1 / this.hz;
    },
    /** Guard against spiral-of-death after a tab is backgrounded. */
    maxFrameTime: 0.25,
  },

  /**
   * Platformer physics, expressed in pixels and seconds. Values are tuned for
   * the "fast start-up, slight air control, snappy" feel called for in the GDD.
   */
  physics: {
    gravity: 2600,
    maxFallSpeed: 1300,
    runSpeed: 360,
    runAccel: 3600,        // ground acceleration toward target speed
    airAccel: 2200,        // weaker control in the air
    groundFriction: 2800,  // deceleration when no input on ground
    airFriction: 600,
    jumpSpeed: 880,        // initial upward velocity
    doubleJumpSpeed: 760,
    coyoteTime: 0.10,      // grace window to still jump after leaving a ledge
    jumpBuffer: 0.12,      // grace window to register a jump pressed early
    jumpCutMultiplier: 0.45, // releasing jump early shortens the hop
    airDashSpeed: 760,
    airDashTime: 0.16,
    dodgeSpeed: 620,
    dodgeTime: 0.26,
    dodgeCooldown: 0.45,
    slamSpeed: 1500,       // downward ground-slam velocity
  },

  /** Combat tuning shared by player attacks. Enemy stats come from data/. */
  combat: {
    baseIFrames: 0.6,      // invulnerability after taking a hit
    dodgeIFrames: 0.18,    // i-frames granted during a dodge roll
    comboWindow: 0.45,     // time to chain the next light attack
    lightDamage: 10,
    heavyDamage: 26,
    slamDamage: 34,
    burstDamage: 16,
    burstCooldown: 1.6,
    knockback: 320,
    hitstop: 0.06,         // brief freeze on impact for "crunch"
    styleDecay: 14,        // style/combo meter points lost per second idle
  },

  /** Rank thresholds (score 0..100) used by systems/rank.js. */
  rank: {
    tiers: [
      { tier: "SS", min: 95 },
      { tier: "S", min: 85 },
      { tier: "A", min: 72 },
      { tier: "B", min: 58 },
      { tier: "C", min: 40 },
      { tier: "D", min: 0 },
    ],
    /** Weighting of each scored dimension; weights sum to 1. */
    weights: { time: 0.25, damage: 0.25, kills: 0.2, secrets: 0.15, style: 0.15 },
  },

  audio: {
    master: 0.8,
    sfx: 0.9,
    music: 0.5,
  },

  save: {
    storagePrefix: "pmc.save.",
    slots: 3,
    quickSlot: "quick",
  },

  /**
   * Default action bindings. Multiple keys can map to one action. The Input
   * system reads `code` values (KeyW, Space, ...) so layout is language-stable.
   */
  bindings: {
    left: ["ArrowLeft", "KeyA"],
    right: ["ArrowRight", "KeyD"],
    up: ["ArrowUp", "KeyW"],
    down: ["ArrowDown", "KeyS"],
    jump: ["Space", "KeyZ"],
    light: ["KeyJ"],
    heavy: ["KeyK"],
    dodge: ["KeyL", "ShiftLeft"],
    ability: ["KeyU", "KeyI"],   // charged ranged burst
    lockon: ["KeyO"],
    interact: ["KeyE", "Enter"],
    pause: ["Escape", "KeyP"],
    // Menu navigation reuses movement + confirm/cancel.
    confirm: ["Enter", "Space", "KeyJ"],
    cancel: ["Escape", "Backspace", "KeyK"],
    debug: ["Backquote"],
  },
};

/** Frozen so accidental writes during play throw in strict mode. */
export const PHYSICS = Object.freeze(CONFIG.physics);
export const COMBAT = Object.freeze(CONFIG.combat);
