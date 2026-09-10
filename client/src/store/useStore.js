import { create } from 'zustand';
import { PHASER_STARTER, PIXI_STARTER, THREE_STARTER } from '../lib/gameTemplate.js';
import { leaf, splitNode, closeNode, setNodeView, setNodeRatio, findLeaf, firstLeaf, nextPaneId } from '../lib/panes.js';

// Persist chat threads and training log to localStorage
function loadLocal(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveLocal(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// The pane layout persists, so reopening the hub restores your workspace. Ids are
// reseeded above the highest saved id so a restored tree cannot collide with new panes.
function loadPaneTree() {
  try {
    const raw = JSON.parse(localStorage.getItem('paneTree'));
    if (!raw || !raw.type) return leaf('code');
    let max = 0;
    (function walk(n) { if (!n) return; if (n.type === 'leaf') max = Math.max(max, n.id); else { walk(n.a); walk(n.b); } })(raw);
    while (nextPaneId() <= max) { /* advance the sequence past restored ids */ }
    return raw;
  } catch { return leaf('code'); }
}
function savePaneTree(tree) {
  try { localStorage.setItem('paneTree', JSON.stringify(tree)); } catch {}
}

export const useStore = create((set, get) => ({
  // UI state
  activeTab: 'code',
  // One pending tab-to-tab handoff, or null. Deliberately not persisted and deliberately
  // singular - see lib/flow.js for why a queue here would be the wrong shape.
  handoff: null,
  paneTree: loadPaneTree(),
  activePaneId: null,
  activeTerminalSession: null,   // server-side pty id of the shell you're looking at
  activeTask: 'explain',
  activeCanvas: 'map',
  activeProvider: (typeof localStorage !== 'undefined' && localStorage.getItem('activeProvider')) || 'ollama',
  activeCodeMode: 'step',
  gameEngine: loadLocal('gameEngine', 'phaser'),
  gameCode: loadLocal('gameCode', PHASER_STARTER),       // Phaser editor buffer
  gamePixiCode: loadLocal('gamePixiCode', PIXI_STARTER), // PixiJS editor buffer
  godotCode: loadLocal('godotCode', `extends SceneTree

func _init():
	print("hello from Godot")
	quit()
`),  // GDScript buffer
  godotUseProject: loadLocal('godotUseProject', false),   // run inside the real game project
  gameThreeCode: loadLocal('gameThreeCode', THREE_STARTER), // Three.js editor buffer
  theme: (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) || 'dark',

  connectedProviders: {},
  outputs: [],
  isStreaming: false,
  toasts: [],

  // Chat threads: { [threadId]: { id, tab, task, provider, messages: [{role,content,ts,tokens}], createdAt, updatedAt } }
  // Active thread per tab
  chatThreads: loadLocal('chatThreads', {}),
  activeThreadId: loadLocal('activeThreadId', {}), // { code: id, strategy: id }

  // Training log entries: [{ id, category, title, body, createdAt }]
  trainingLog: loadLocal('trainingLog', [
    // ── Principles ────────────────────────────────────────────────────────
    {
      id: 'seed-p-01',
      category: 'principle',
      title: 'Task decomposition',
      body: 'Break large features into the smallest testable units before writing code. Define the next concrete action, not the whole mountain.',
      createdAt: Date.now() - 86400000 * 30,
    },
    {
      id: 'seed-p-02',
      category: 'principle',
      title: 'Iterate incrementally',
      body: 'Start with the simplest working version, then extend step by step. Complex systems usually grow from simple systems that already work.',
      createdAt: Date.now() - 86400000 * 29,
    },
    {
      id: 'seed-p-03',
      category: 'principle',
      title: 'Change one thing at a time',
      body: 'Modify one variable, one behavior, or one refactor at a time so failures stay easy to trace.',
      createdAt: Date.now() - 86400000 * 28,
    },
    {
      id: 'seed-p-04',
      category: 'principle',
      title: 'Vertical slice before systems',
      body: 'Prove the mechanic in one playable loop before building editors, progression, or meta systems.',
      createdAt: Date.now() - 86400000 * 27,
    },
    {
      id: 'seed-p-05',
      category: 'principle',
      title: 'Try a small experiment',
      body: 'When uncertain about behavior, build a tiny isolated test instead of guessing.',
      createdAt: Date.now() - 86400000 * 26,
    },
    {
      id: 'seed-p-06',
      category: 'principle',
      title: 'Prefer small modules',
      body: 'Split systems into smaller independent modules so they are easier to understand, test, and replace.',
      createdAt: Date.now() - 86400000 * 25,
    },
    {
      id: 'seed-p-07',
      category: 'principle',
      title: 'Hide complexity',
      body: 'Expose simple interfaces and keep internal complexity private whenever possible.',
      createdAt: Date.now() - 86400000 * 24,
    },
    {
      id: 'seed-p-08',
      category: 'principle',
      title: 'Design for change',
      body: 'Assume requirements will move, so structure code to absorb change instead of resisting it.',
      createdAt: Date.now() - 86400000 * 23,
    },
    {
      id: 'seed-p-09',
      category: 'principle',
      title: 'Code is liability',
      body: 'Every line of code creates future maintenance cost, so the simplest correct solution usually wins.',
      createdAt: Date.now() - 86400000 * 22,
    },
    {
      id: 'seed-p-10',
      category: 'principle',
      title: 'Optimize for readability',
      body: 'Code is read more often than it is written. Choose clarity over cleverness.',
      createdAt: Date.now() - 86400000 * 21,
    },
    {
      id: 'seed-p-11',
      category: 'principle',
      title: 'Make state visible',
      body: 'Systems should clearly communicate status, progress, and failure so users and developers are not guessing.',
      createdAt: Date.now() - 86400000 * 20,
    },
    {
      id: 'seed-p-12',
      category: 'principle',
      title: 'Prevent errors early',
      body: 'Catch invalid states and bad assumptions as close to the source as possible.',
      createdAt: Date.now() - 86400000 * 19,
    },
    {
      id: 'seed-p-13',
      category: 'principle',
      title: 'Secure by default',
      body: 'Protected behavior should be the default. Public or permissive behavior should be explicit.',
      createdAt: Date.now() - 86400000 * 18,
    },
    {
      id: 'seed-p-14',
      category: 'principle',
      title: 'Fail safely',
      body: 'When something breaks, the system should default to the safest reasonable behavior.',
      createdAt: Date.now() - 86400000 * 17,
    },
    {
      id: 'seed-p-15',
      category: 'principle',
      title: 'Shorten feedback loops',
      body: 'Anything that lets me see results faster is worth prioritizing.',
      createdAt: Date.now() - 86400000 * 16,
    },
    {
      id: 'seed-p-16',
      category: 'principle',
      title: 'Prefer working proof',
      body: 'A rough working version beats a polished plan that still has unknowns.',
      createdAt: Date.now() - 86400000 * 15,
    },
    {
      id: 'seed-p-17',
      category: 'principle',
      title: 'Use leverage first',
      body: 'Choose the task that removes the most future work, not the task that feels busiest.',
      createdAt: Date.now() - 86400000 * 14,
    },
    {
      id: 'seed-p-18',
      category: 'principle',
      title: 'Automate repeated pain',
      body: 'If I do the same annoying thing more than a few times, it should become a script, tool, or template.',
      createdAt: Date.now() - 86400000 * 13,
    },
    {
      id: 'seed-p-19',
      category: 'principle',
      title: 'Capture wins immediately',
      body: 'When I discover a faster pattern, save it before I forget it.',
      createdAt: Date.now() - 86400000 * 12,
    },
    {
      id: 'seed-p-20',
      category: 'principle',
      title: 'Measure before tuning',
      body: 'Performance work should follow profiling data, not instinct.',
      createdAt: Date.now() - 86400000 * 11,
    },

    // ── Rules ─────────────────────────────────────────────────────────────
    {
      id: 'seed-r-01',
      category: 'rule',
      title: 'Reproduce bugs first',
      body: 'Never fix a bug I cannot reliably reproduce. Prove the issue, then prove the fix.',
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: 'seed-r-02',
      category: 'rule',
      title: 'Test every new path',
      body: 'Every new line or branch should be executed at least once before I call the feature done.',
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: 'seed-r-03',
      category: 'rule',
      title: 'Read before rewrite',
      body: 'Understand the existing system before replacing it, especially in old modules that already have hidden dependencies.',
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: 'seed-r-04',
      category: 'rule',
      title: 'Log early',
      body: 'Add useful logging and error handling near the start. Debugging without visibility wastes hours.',
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: 'seed-r-05',
      category: 'rule',
      title: 'One source of truth',
      body: 'Constants, tunables, and repeated selectors should live in one place whenever possible to reduce desync bugs.',
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: 'seed-r-06',
      category: 'rule',
      title: 'Make it work, then right, then fast',
      body: 'Solve correctness first, clean it second, optimize after I can measure the bottleneck.',
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: 'seed-r-07',
      category: 'rule',
      title: 'Use short commits',
      body: 'Separate refactors from feature work so rollback and debugging stay clean.',
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: 'seed-r-08',
      category: 'rule',
      title: 'Separate data from behavior',
      body: 'Put balancing values in one config layer so tuning does not require hunting logic everywhere.',
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: 'seed-r-09',
      category: 'rule',
      title: 'Validate all input',
      body: 'Validate input from users, files, APIs, databases, and networks with restrictive rules, not loose assumptions.',
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      id: 'seed-r-10',
      category: 'rule',
      title: 'Sanitize all output',
      body: 'Encode or sanitize output for the specific context where it will be rendered.',
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      id: 'seed-r-11',
      category: 'rule',
      title: 'Never roll auth',
      body: 'Do not build custom authentication, session, or password systems when proven solutions already exist.',
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      id: 'seed-r-12',
      category: 'rule',
      title: 'Hash secrets properly',
      body: 'Passwords must be hashed with modern password-hashing algorithms, never stored in plain text.',
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      id: 'seed-r-13',
      category: 'rule',
      title: 'Check authorization server-side',
      body: 'Never rely on client-side checks to enforce permissions.',
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      id: 'seed-r-14',
      category: 'rule',
      title: 'Keep secrets out of code',
      body: 'Never hardcode secrets in source files, commits, screenshots, or logs.',
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      id: 'seed-r-15',
      category: 'rule',
      title: 'Do not leak errors',
      body: 'User-facing errors should be helpful without exposing stack traces, secrets, or internal architecture.',
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      id: 'seed-r-16',
      category: 'rule',
      title: 'Patch dependencies',
      body: 'Keep dependencies updated and review known vulnerabilities before shipping.',
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      id: 'seed-r-17',
      category: 'rule',
      title: 'Separate config from code',
      body: 'Environment-specific behavior should live in configuration, not scattered conditionals.',
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      id: 'seed-r-18',
      category: 'rule',
      title: 'Write rollback-friendly changes',
      body: 'Deploy changes in a way that can be reversed without drama.',
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      id: 'seed-r-19',
      category: 'rule',
      title: 'Debug with evidence',
      body: 'Do not guess for long. Add visibility and prove what the system is actually doing.',
      createdAt: Date.now() - 86400000 * 8,
    },
    {
      id: 'seed-r-20',
      category: 'rule',
      title: 'Save useful prompts',
      body: 'Reusable prompts, snippets, and workflows should be stored the moment they prove valuable.',
      createdAt: Date.now() - 86400000 * 8,
    },
    {
      id: 'seed-r-21',
      category: 'rule',
      title: 'Instrument first on hard bugs',
      body: 'If a bug feels slippery, add logs, counters, or overlays before trying random fixes.',
      createdAt: Date.now() - 86400000 * 8,
    },
    {
      id: 'seed-r-22',
      category: 'rule',
      title: 'Kill dead paths fast',
      body: 'If a direction is clearly not working, abandon it early instead of justifying the time already spent.',
      createdAt: Date.now() - 86400000 * 8,
    },
    {
      id: 'seed-r-23',
      category: 'rule',
      title: 'Stop overgeneralizing early',
      body: 'Build only enough abstraction to move faster right now.',
      createdAt: Date.now() - 86400000 * 8,
    },
    {
      id: 'seed-r-24',
      category: 'rule',
      title: 'Protect deep work',
      body: 'Do not interrupt high-momentum work for low-value cleanup unless it blocks progress.',
      createdAt: Date.now() - 86400000 * 8,
    },

    // ── Weaknesses ────────────────────────────────────────────────────────
    {
      id: 'seed-w-01',
      category: 'weakness',
      title: 'Duplicate code warning',
      body: 'If I copy logic twice, I probably need a shared function, config object, or reusable component before the codebase drifts.',
      createdAt: Date.now() - 86400000 * 7,
    },
    {
      id: 'seed-w-02',
      category: 'weakness',
      title: 'Overbuilding too early',
      body: 'I tend to design for the final massive version before the small playable version exists, which slows momentum.',
      createdAt: Date.now() - 86400000 * 7,
    },
    {
      id: 'seed-w-03',
      category: 'weakness',
      title: 'Debugging in my head',
      body: 'When I stay stuck too long without writing down hypotheses, I loop instead of narrowing the problem.',
      createdAt: Date.now() - 86400000 * 7,
    },
    {
      id: 'seed-w-04',
      category: 'weakness',
      title: 'Context-switch drift',
      body: 'Mid-task ideas can derail the main objective. Side quests need to be parked in notes instead of pursued immediately.',
      createdAt: Date.now() - 86400000 * 7,
    },
    {
      id: 'seed-w-05',
      category: 'weakness',
      title: 'Skipping the tiny test',
      body: 'I sometimes assume a small change is obviously fine instead of running it once and confirming behavior.',
      createdAt: Date.now() - 86400000 * 7,
    },
    {
      id: 'seed-w-06',
      category: 'weakness',
      title: 'UI polish before core fun',
      body: 'I sometimes spend time polishing menus before the underlying mechanic earns it.',
      createdAt: Date.now() - 86400000 * 7,
    },
    {
      id: 'seed-w-07',
      category: 'weakness',
      title: 'Monster-file blindness',
      body: 'In a huge single-file project, I can stop seeing structure problems until changes become risky.',
      createdAt: Date.now() - 86400000 * 7,
    },
    {
      id: 'seed-w-08',
      category: 'weakness',
      title: 'Assuming input is clean',
      body: 'I can mentally trust friendly input too quickly and forget that real systems receive malformed or hostile data.',
      createdAt: Date.now() - 86400000 * 6,
    },
    {
      id: 'seed-w-09',
      category: 'weakness',
      title: 'Confusing obscurity with security',
      body: 'Hiding a feature or route is not the same as protecting it.',
      createdAt: Date.now() - 86400000 * 6,
    },
    {
      id: 'seed-w-10',
      category: 'weakness',
      title: 'Trusting client-side state',
      body: 'I can accidentally treat browser or app state as authoritative when the server should decide.',
      createdAt: Date.now() - 86400000 * 6,
    },
    {
      id: 'seed-w-11',
      category: 'weakness',
      title: 'Ignoring dependency risk',
      body: 'I can treat external libraries as free convenience and underestimate their maintenance and security cost.',
      createdAt: Date.now() - 86400000 * 6,
    },
    {
      id: 'seed-w-12',
      category: 'weakness',
      title: 'Patching symptoms only',
      body: 'Fast bug fixes can hide the root cause if I stop at the first visible issue.',
      createdAt: Date.now() - 86400000 * 6,
    },
    {
      id: 'seed-w-13',
      category: 'weakness',
      title: 'Underestimating migration cost',
      body: 'I can focus on the new design and ignore the real pain of moving old data and workflows.',
      createdAt: Date.now() - 86400000 * 6,
    },
    {
      id: 'seed-w-14',
      category: 'weakness',
      title: 'Polishing before proof',
      body: 'I can waste momentum polishing something that is not yet validated.',
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'seed-w-15',
      category: 'weakness',
      title: 'Tool wandering',
      body: 'Looking for the perfect tool can become a delay tactic.',
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'seed-w-16',
      category: 'weakness',
      title: 'Too many open threads',
      body: 'When I leave too many partial tasks active, output drops.',
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'seed-w-17',
      category: 'weakness',
      title: 'Refactor drift',
      body: 'A helpful cleanup can quietly expand until it replaces the actual task.',
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'seed-w-18',
      category: 'weakness',
      title: 'Re-solving old problems',
      body: 'If I do not save patterns, I pay the same thinking cost again later.',
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'seed-w-19',
      category: 'weakness',
      title: 'Busywork satisfaction',
      body: 'Small easy tasks can feel productive while the real bottleneck stays untouched.',
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: 'seed-w-20',
      category: 'weakness',
      title: 'Overcommitting in one session',
      body: 'Trying to solve too many major problems at once can collapse momentum.',
      createdAt: Date.now() - 86400000 * 5,
    },

    // ── Notes ─────────────────────────────────────────────────────────────
    {
      id: 'seed-n-01',
      category: 'note',
      title: 'Write the next step before stopping',
      body: 'End sessions with one sentence describing the next concrete action so re-entry is fast next time.',
      createdAt: Date.now() - 86400000 * 4,
    },
    {
      id: 'seed-n-02',
      category: 'note',
      title: 'Record failed attempts',
      body: 'Failed experiments are useful if they explain what was ruled out and why.',
      createdAt: Date.now() - 86400000 * 4,
    },
    {
      id: 'seed-n-03',
      category: 'note',
      title: 'Questions belong in the log',
      body: 'If I hit ambiguity, write the unknown, the current hypothesis, and how I plan to verify it.',
      createdAt: Date.now() - 86400000 * 4,
    },
    {
      id: 'seed-n-04',
      category: 'note',
      title: 'Review patterns regularly',
      body: 'A dev journal becomes more valuable when I revisit it and look for recurring friction, wins, and blind spots.',
      createdAt: Date.now() - 86400000 * 4,
    },
    {
      id: 'seed-n-05',
      category: 'note',
      title: 'Every subsystem needs an owner comment',
      body: 'Mark input, render, audio, save, AI, and state boundaries clearly so future edits stay safe.',
      createdAt: Date.now() - 86400000 * 4,
    },
    {
      id: 'seed-n-06',
      category: 'note',
      title: 'Security is a design property',
      body: 'Security is not a final polish pass. It comes from architecture, defaults, and operational discipline.',
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'seed-n-07',
      category: 'note',
      title: 'Permission checks need tests',
      body: 'Authorization logic is important enough to deserve dedicated tests for allowed and denied cases.',
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'seed-n-08',
      category: 'note',
      title: 'Incident notes are training data',
      body: 'Every outage, exploit, or near miss should leave behind a lesson that changes future practice.',
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'seed-n-09',
      category: 'note',
      title: 'Defaults teach the team',
      body: 'The easiest path in a codebase becomes the most common path, so make the safe path the easy one.',
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'seed-n-10',
      category: 'note',
      title: 'Design for investigation',
      body: 'A system is healthier when logs, metrics, and traces make failure explainable.',
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'seed-n-11',
      category: 'note',
      title: 'Maintenance is part of feature cost',
      body: 'A feature is not just its build time. It includes testing, monitoring, support, and future change.',
      createdAt: Date.now() - 86400000 * 3,
    },
    {
      id: 'seed-n-12',
      category: 'note',
      title: 'Speed comes from fewer decisions',
      body: 'Templates, defaults, and known-good patterns save more time than raw effort.',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'seed-n-13',
      category: 'note',
      title: 'The bottleneck decides the task',
      body: 'The highest-value work is usually the thing blocking the next ten things.',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'seed-n-14',
      category: 'note',
      title: 'Good logs are force multipliers',
      body: 'A well-placed log can replace hours of confused debugging.',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'seed-n-15',
      category: 'note',
      title: 'AI is leverage, not autopilot',
      body: 'Use AI to compress effort, but keep human judgment on architecture and verification.',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'seed-n-16',
      category: 'note',
      title: 'Friction compounds',
      body: 'Tiny delays repeated all day become real productivity loss.',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'seed-n-17',
      category: 'note',
      title: 'Saved systems beat motivation',
      body: 'The best productivity trick is building workflows that still work when energy is uneven.',
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: 'seed-n-18',
      category: 'note',
      title: 'Working software is the metric',
      body: 'Progress is measured in usable outcomes, not effort spent.',
      createdAt: Date.now() - 86400000 * 1,
    },
  ]),

  setActiveTab: (t) => {
    const id = get().activePaneId || (firstLeaf(get().paneTree) || {}).id;
    if (id != null) { const tree = setNodeView(get().paneTree, id, t); savePaneTree(tree); set({ activeTab: t, paneTree: tree, activePaneId: id }); }
    else set({ activeTab: t });
  },

  // ---- tab-to-tab flow ----------------------------------------------------
  // Park a payload for `to` and bring that tab up. The destination consumes it on mount.
  sendHandoff: (to, payload) => {
    set({ handoff: { to, payload, at: Date.now() } });
    get().setActiveTab(to);
  },
  // Claim the pending handoff if it is addressed to `view`, else null. Claiming clears
  // it, so a tab cannot re-apply the same prefill every time it remounts.
  consumeHandoff: (view) => {
    const h = get().handoff;
    if (!h || h.to !== view) return null;
    set({ handoff: null });
    return h.payload;
  },
  // ---- split workspace ----------------------------------------------------
  // Clicking a sidebar item retargets the ACTIVE pane rather than replacing the
  // whole screen, so the sidebar keeps working the way it always did when there
  // is only one pane, and becomes "put this here" once you have split.
  splitPane: (id, dir) => {
    const t = splitNode(get().paneTree, id, dir);
    const before = new Set();
    (function walk(n){ if(!n) return; if(n.type==='leaf') before.add(n.id); else {walk(n.a); walk(n.b);} })(get().paneTree);
    let created = null;
    (function walk(n){ if(!n) return; if(n.type==='leaf'){ if(!before.has(n.id)) created = n.id; } else {walk(n.a); walk(n.b);} })(t);
    set({ paneTree: t, activePaneId: created || id });
    savePaneTree(t);
  },
  closePane: (id) => {
    const t = closeNode(get().paneTree, id) || leaf('code');
    const still = findLeaf(t, get().activePaneId);
    set({ paneTree: t, activePaneId: still ? get().activePaneId : (firstLeaf(t) || {}).id });
    savePaneTree(t);
  },
  setPaneView: (id, view) => {
    const t = setNodeView(get().paneTree, id, view);
    set({ paneTree: t, activeTab: view });
    savePaneTree(t);
  },
  setPaneRatio: (path, ratio) => {
    const t = setNodeRatio(get().paneTree, path, Math.min(0.9, Math.max(0.1, ratio)));
    set({ paneTree: t });
    savePaneTree(t);
  },
  setActiveTerminalSession: (id) => set({ activeTerminalSession: id }),
  setActivePane: (id) => {
    const l = findLeaf(get().paneTree, id);
    set({ activePaneId: id, activeTab: l ? l.view : get().activeTab });
  },
  setActiveTask: (t) => set({ activeTask: t }),
  setActiveCanvas: (c) => set({ activeCanvas: c }),
  setActiveProvider: (p) => { try { localStorage.setItem('activeProvider', p); } catch {} set({ activeProvider: p }); },
  setActiveCodeMode: (m) => set({ activeCodeMode: m }),
  setGameEngine: (e) => { saveLocal('gameEngine', e); set({ gameEngine: e }); },
  setGameCode: (code) => { saveLocal('gameCode', code); set({ gameCode: code }); },
  setGamePixiCode: (code) => { saveLocal('gamePixiCode', code); set({ gamePixiCode: code }); },
  setGodotCode: (code) => { saveLocal('godotCode', code); set({ godotCode: code }); },
  setGodotUseProject: (v) => { saveLocal('godotUseProject', v); set({ godotUseProject: v }); },
  setGameThreeCode: (code) => { saveLocal('gameThreeCode', code); set({ gameThreeCode: code }); },

  // Load a code block into the currently-selected engine's buffer and jump to the
  // Game tab, which mounts fresh and auto-runs it. Used by "Play in Game".
  loadCodeIntoGame: (code) => {
    const eng = get().gameEngine;
    const key = eng === 'pixi' ? 'gamePixiCode' : eng === 'three' ? 'gameThreeCode' : 'gameCode';
    saveLocal(key, code);
    set({ [key]: code, activeTab: 'game' });
    get().addToast('Loaded into the Game preview.');
  },
  setConnectedProviders: (p) => set({ connectedProviders: p }),
  setIsStreaming: (v) => set({ isStreaming: v }),

  addOutput: (output) => set(s => ({ outputs: [output, ...s.outputs].slice(0, 100) })),
  updateOutput: (id, patch) => set(s => ({
    outputs: s.outputs.map(o => (o.id === id ? { ...o, ...(typeof patch === 'function' ? patch(o) : patch) } : o)),
  })),
  clearOutputs: () => set({ outputs: [] }),
  removeOutput: (id) => set(s => ({ outputs: s.outputs.filter(o => o.id !== id) })),

  // ── Chat thread actions ───────────────────────────────────────────────────
  getActiveThread(tab) {
    const s = get();
    const threadId = s.activeThreadId[tab];
    return threadId ? s.chatThreads[threadId] : null;
  },

  startNewThread(tab, task, provider) {
    const id = `${tab}-${Date.now()}`;
    const thread = { id, tab, task, provider, messages: [], createdAt: Date.now(), updatedAt: Date.now() };
    set(s => {
      const threads = { ...s.chatThreads, [id]: thread };
      const activeThreadId = { ...s.activeThreadId, [tab]: id };
      saveLocal('chatThreads', threads);
      saveLocal('activeThreadId', activeThreadId);
      return { chatThreads: threads, activeThreadId };
    });
    return id;
  },

  addMessageToThread(threadId, message) {
    // message: { role: 'user'|'assistant', content, ts, tokens? }
    set(s => {
      const thread = s.chatThreads[threadId];
      if (!thread) return {};
      const updated = { ...thread, messages: [...thread.messages, message], updatedAt: Date.now() };
      const threads = { ...s.chatThreads, [threadId]: updated };
      saveLocal('chatThreads', threads);
      return { chatThreads: threads };
    });
  },

  updateLastAssistantMessage(threadId, patch) {
    set(s => {
      const thread = s.chatThreads[threadId];
      if (!thread) return {};
      const msgs = [...thread.messages];
      const lastIdx = msgs.length - 1;
      if (lastIdx < 0 || msgs[lastIdx].role !== 'assistant') return {};
      msgs[lastIdx] = { ...msgs[lastIdx], ...(typeof patch === 'function' ? patch(msgs[lastIdx]) : patch) };
      const updated = { ...thread, messages: msgs, updatedAt: Date.now() };
      const threads = { ...s.chatThreads, [threadId]: updated };
      saveLocal('chatThreads', threads);
      return { chatThreads: threads };
    });
  },

  // Keep only the first `keepCount` messages of a thread (used by Regenerate to
  // drop the last assistant reply before re-running the same user turn).
  truncateThread(threadId, keepCount) {
    set(s => {
      const thread = s.chatThreads[threadId];
      if (!thread) return {};
      const updated = { ...thread, messages: thread.messages.slice(0, keepCount), updatedAt: Date.now() };
      const threads = { ...s.chatThreads, [threadId]: updated };
      saveLocal('chatThreads', threads);
      return { chatThreads: threads };
    });
  },

  switchThread(tab, threadId) {
    set(s => {
      const activeThreadId = { ...s.activeThreadId, [tab]: threadId };
      saveLocal('activeThreadId', activeThreadId);
      return { activeThreadId };
    });
  },

  deleteThread(threadId) {
    set(s => {
      const threads = { ...s.chatThreads };
      delete threads[threadId];
      // If active, clear it
      const activeThreadId = { ...s.activeThreadId };
      for (const tab of Object.keys(activeThreadId)) {
        if (activeThreadId[tab] === threadId) delete activeThreadId[tab];
      }
      saveLocal('chatThreads', threads);
      saveLocal('activeThreadId', activeThreadId);
      return { chatThreads: threads, activeThreadId };
    });
  },

  // ── Training log actions ──────────────────────────────────────────────────
  addTrainingEntry(entry) {
    set(s => {
      const log = [entry, ...s.trainingLog];
      saveLocal('trainingLog', log);
      return { trainingLog: log };
    });
  },

  updateTrainingEntry(id, patch) {
    set(s => {
      const log = s.trainingLog.map(e => e.id === id ? { ...e, ...patch } : e);
      saveLocal('trainingLog', log);
      return { trainingLog: log };
    });
  },

  deleteTrainingEntry(id) {
    set(s => {
      const log = s.trainingLog.filter(e => e.id !== id);
      saveLocal('trainingLog', log);
      return { trainingLog: log };
    });
  },

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
    set({ theme: next });
  },

  addToast: (message, type = 'success') => {
    const id = Date.now() + Math.random();
    set(s => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })), 3000);
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
