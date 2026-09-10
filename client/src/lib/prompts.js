import { CANVAS_TYPES } from './constants.js';
import { workSectionOf } from './flow.js';

// Task instructions are the system frame for each Code-tab action. They're written
// for a local ~14B model, which follows explicit structure and firm constraints far
// better than it infers them — hence the per-task output sections and the
// preserve-behavior / no-placeholder guardrails.
const CODE_TASK_INSTRUCTIONS = {
  explain:
    'Explain what the following code does. Start with a one-sentence summary of its purpose, ' +
    'then walk through the key parts in the order they run. Call out any non-obvious behavior, ' +
    'side effects, or assumptions. Do not rewrite the code.',
  refactor:
    'Refactor the following code to improve readability, structure, and maintainability while ' +
    'preserving its exact behavior and public interface. Give the full refactored code in one ' +
    'fenced block, then list the specific changes you made and why each one helps.',
  debug:
    'Find and fix the bug(s) in the following code. Respond in three parts:\n' +
    '1. **Diagnosis** — what is wrong and why it causes the problem.\n' +
    '2. **Fix** — the corrected code in a complete fenced block.\n' +
    '3. **Verification** — how to confirm the fix works (a test, input, or trace).\n' +
    'Change only what is needed to fix the bug; leave the rest of the code intact.',
  generate:
    'Write code that satisfies the request below. First state any assumptions you are making in ' +
    'one or two lines. Then give the complete, runnable code with the necessary imports in one ' +
    'fenced block, followed by a short usage example. Write working code — no placeholders or TODOs.',
  tests:
    'Write a thorough test suite for the following code using the language\'s idiomatic testing ' +
    'framework. Cover normal cases, edge cases, boundary values, and error/exception paths. Give ' +
    'the complete test file in a fenced block, and note any case you deliberately skipped and why.',
  document:
    'Document the following code without changing its logic. Add docstrings/comments at the ' +
    'function and class level covering purpose, parameters, return values, and any side effects ' +
    'or edge cases. Return the fully documented code in a fenced block, then a short usage section.',
  optimize:
    'Analyze the following code for performance problems and rewrite it to be faster and/or use ' +
    'less memory while preserving its exact behavior. Respond in three parts:\n' +
    '1. **Bottlenecks** — what is slow and why, with time/space complexity where relevant.\n' +
    '2. **Optimized code** — the complete rewrite in a fenced block.\n' +
    '3. **Impact** — the expected improvement and any trade-offs.\n' +
    'Never trade correctness for speed.',
  review:
    'Perform a code review of the following code. Group findings by severity under these headers: ' +
    '**Bugs / Correctness**, **Security**, **Performance**, **Style / Maintainability**. For each ' +
    'finding, quote the relevant line(s), explain the issue, and give a concrete fix. If a category ' +
    'has no issues, say so in one line. End with the top 1–3 things to fix first.',
};

const MODE_INSTRUCTIONS = {
  step:   'Think through this step by step. Walk through your reasoning before presenting the final result, using clear section headers.',
  direct: 'Be direct and concise. Lead with the result/code and keep explanation to a minimum. Do not restate the request.',
};

// Rules applied to every code task. Kept short on purpose — a local model obeys a
// handful of firm rules better than a long list.
const CODE_RULES =
  'Rules:\n' +
  '- Put every code snippet in a markdown fence tagged with its language.\n' +
  '- Write out whatever code you present in full — never elide with placeholders like `// ...` or `// unchanged`.\n' +
  '- Skip preamble and do not echo the request back; lead with the substance.\n' +
  '- Only use libraries and APIs you are confident exist; if you must assume one, say so.';

// The Game task generates code for whichever engine is selected in the Game tab.
// The preview already loads the engine from a CDN and exposes its global, so the
// model must emit ONE self-contained script that uses that global — no HTML, no
// imports, no CDN tags — which "Pull from Code" can run directly.
const GAME_ENGINE_GUIDE = {
  phaser: { name: 'Phaser 3', global: 'Phaser', notes: 'Create the game with `new Phaser.Game(config)`. Phaser creates and appends its own canvas.' },
  pixi:   { name: 'PixiJS v7', global: 'PIXI', notes: 'Use the synchronous v7 API — `const app = new PIXI.Application({ ... }); document.body.appendChild(app.view);`. Do NOT use the v8 `await app.init()` API.' },
  three:  { name: 'Three.js (UMD global)', global: 'THREE', notes: 'Use the global `THREE`. Create a Scene, a PerspectiveCamera, and `const renderer = new THREE.WebGLRenderer(); document.body.appendChild(renderer.domElement);`. Animate with requestAnimationFrame, and add a light when using materials like MeshStandardMaterial.' },
};

function gameInstruction(engine) {
  const g = GAME_ENGINE_GUIDE[engine] || GAME_ENGINE_GUIDE.phaser;
  return `Write a small, complete ${g.name} program for the request below. It runs inside a live preview that ALREADY loads ${g.name} from a CDN and exposes the global \`${g.global}\`.\n` +
    `- Output exactly ONE self-contained JavaScript block in a \`\`\`js fence — no HTML, no <script> tags, no import/require, no CDN links.\n` +
    `- Use the \`${g.global}\` global directly. ${g.notes}\n` +
    `- It must run as-is with no edits — no placeholders or TODOs.
` +
    // Measured stopgap: 71% of the Phaser fine-tuning data was harvested from the
    // official examples, which load textures from an asset server. The model
    // reproduces that faithfully and the result renders a black screen. This
    // instruction alone recovered 2/6 correctness prompts (from 0/6); the real fix
    // is rebuilding the data, but this costs nothing and helps meanwhile.
    `- NEVER load external assets: no \`load.image\`/\`load.spritesheet\`/\`load.audio\`, no \`assets/\` paths, no \`setBaseURL\`. There is no asset server — anything you load will 404 and render nothing.
` +
    `- Draw everything with generated graphics (rectangles, circles, graphics, text) or inline \`data:\` URIs.`;
}

// Resolve the task instruction, special-casing the engine-aware Game task.
function taskInstructionFor(taskId, engine) {
  if (taskId === 'game') return gameInstruction(engine);
  return CODE_TASK_INSTRUCTIONS[taskId] || CODE_TASK_INSTRUCTIONS.explain;
}

export function buildCodePrompt(taskId, modeId, input, engine) {
  const taskInstruction = taskInstructionFor(taskId, engine);
  const modeInstruction = MODE_INSTRUCTIONS[modeId] || MODE_INSTRUCTIONS.step;
  return `${taskInstruction}\n\n${modeInstruction}\n\n${CODE_RULES}\n\n---\n${input}`;
}

// System framing for a MULTI-TURN code conversation. The task/mode instruction
// persists as a system message while the user and assistant turns carry the
// actual exchange, so the model can build on its own previous output instead of
// starting over each turn.
export function buildCodeSystem(taskId, modeId, engine) {
  const taskInstruction = taskInstructionFor(taskId, engine);
  const modeInstruction = MODE_INSTRUCTIONS[modeId] || MODE_INSTRUCTIONS.step;
  return `${taskInstruction}\n\n${modeInstruction}\n\n${CODE_RULES}\n\n` +
    `This is an ongoing conversation — read the previous turns and build on them. When the user points out a problem or requests a change, modify the code you already produced rather than starting from scratch; show the full updated file when the change is large, or just the changed section (in full, no placeholders) when it is small. Keep names and structure consistent with the existing code.`;
}

/**
 * The rule that makes a plan executable rather than merely readable.
 *
 * Each top-level bullet in the work section becomes one queued goal, picked up by an agent
 * hours later with no memory of the plan around it. "Then wire it up" is worthless to that
 * agent, so the bullets are asked for as self-contained units of work here, at the only
 * point where it is cheap to ask.
 */
function workSectionRules(section) {
  return `Write "## ${section}" as a flat list of top-level bullets, one unit of work per bullet, in the order they should happen. Each bullet must stand on its own - name what to build or change and what "done" looks like - because each one will be handed to someone (or something) with no other context. Put supporting detail on indented lines under its bullet. Never write this section as a paragraph.`;
}

/**
 * `context` is the project as it actually is - see lib/projectContext.js. It goes in
 * BEFORE the request, because a planner that reads the workspace first plans against
 * what exists, while one that reads it last treats it as an afterthought to a plan it
 * has already committed to. Empty string when nothing is known, which changes nothing.
 */
export function buildStrategyPrompt(canvasId, input, context = '') {
  const canvas = CANVAS_TYPES.find(c => c.id === canvasId) || CANVAS_TYPES[0];
  const sectionList = canvas.sections.map(s => `## ${s}`).join('\n');
  const work = workSectionOf(canvas);
  const parts = [
    ...(context ? [context] : []),
    `You are helping with the following request:`,
    input,
    `Respond using exactly these markdown section headers, in this order, each followed by concise content (use bullet points where helpful):`,
    sectionList,
  ];
  if (work) parts.push(workSectionRules(work));
  parts.push(`Do not add any extra top-level headers or preamble text before the first header.`);
  return parts.join('\n\n');
}

/**
 * A plan plus an instruction -> the same plan, revised.
 *
 * Planning is not one-shot: the first pass is a draft you argue with. The whole previous
 * plan is sent back rather than a summary of it, and the whole revised plan is asked for
 * rather than a diff, because everything downstream (the build brief, the chain) reads
 * complete sections - a plan that comes back as "change milestone 3 to..." cannot be
 * built from, and the sections the instruction did not touch must survive intact.
 */
export function buildStrategyRevisionPrompt(canvasId, previousPlan, instruction, context = '') {
  const canvas = CANVAS_TYPES.find(c => c.id === canvasId) || CANVAS_TYPES[0];
  const sectionList = canvas.sections.map(s => `## ${s}`).join('\n');
  const work = workSectionOf(canvas);
  const parts = [
    ...(context ? [context] : []),
    `Here is a plan you wrote:`,
    previousPlan,
    `Revise it according to this instruction:`,
    instruction,
    `Return the COMPLETE revised plan, not a diff and not a description of what you changed. Keep every part the instruction does not touch exactly as it was. Use exactly these markdown section headers, in this order:`,
    sectionList,
  ];
  if (work) parts.push(workSectionRules(work));
  parts.push(`Do not add any extra top-level headers or preamble text before the first header.`);
  return parts.join('\n\n');
}