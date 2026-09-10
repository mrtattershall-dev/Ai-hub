import React from 'react';
import { Code2, Bot, Gamepad2, Boxes, TerminalSquare, Compass, BookOpen, History, Settings, Images } from 'lucide-react';
import CodePage from '../pages/CodePage.jsx';
import AgentPage from '../pages/AgentPage.jsx';
import GamePage from '../pages/GamePage.jsx';
import GodotPage from '../pages/GodotPage.jsx';
import TerminalPage from '../pages/TerminalPage.jsx';
import StrategyPage from '../pages/StrategyPage.jsx';
import HistoryPage from '../pages/HistoryPage.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';
import TrainingPage from '../pages/TrainingPage.jsx';
import AssetsPage from '../pages/AssetsPage.jsx';

// One registry so the sidebar, the pane menu and the workspace agree on what
// exists. Keys double as the persisted pane view id, so don't rename casually.
//
// ORDER IS THE PIPELINE, not history. Insertion order drives the pane menu and
// NAV_GROUPS below drives the sidebar, so both read top-to-bottom the way the work
// actually moves. The old order opened on Code and left Strategy seventh, which put the
// first step of the job five places below the second.
export const VIEWS = {
  strategy: StrategyPage,
  code:     CodePage,
  agent:    AgentPage,
  game:     GamePage,
  godot:    GodotPage,
  assets:   AssetsPage,
  terminal: TerminalPage,
  training: TrainingPage,
  history:  HistoryPage,
  settings: SettingsPage,
};

const META = {
  strategy: { label: 'Strategy',     Icon: Compass,         step: 'plan' },
  code:     { label: 'Code',         Icon: Code2,           step: 'write' },
  agent:    { label: 'Agent',        Icon: Bot,             step: 'unattended' },
  game:     { label: 'Game',         Icon: Gamepad2,        step: 'run' },
  godot:    { label: 'Godot',        Icon: Boxes,           step: 'run' },
  assets:   { label: 'Assets',       Icon: Images },
  terminal: { label: 'Terminal',     Icon: TerminalSquare },
  training: { label: 'Training Log', Icon: BookOpen },
  history:  { label: 'History',      Icon: History },
  settings: { label: 'Settings',     Icon: Settings },
};

/**
 * The flow, as a tree, because the flow IS a tree.
 *
 * Drawn as a straight line it would claim Code feeds Agent, and nothing does. What
 * actually exists is one plan and two ways to act on it:
 *
 *   Strategy -> Code -> Game / Godot      you drive it, turn by turn
 *   Strategy -> Agent                     it runs the queued chain without you
 *
 * Every edge here is a handoff that exists in code, not an aspiration:
 * Strategy->Code and Strategy->Agent are the two hops in lib/flow.js, and Code->Game and
 * Code->Godot are `loadCodeIntoGame`. If an edge is ever added here without the handoff
 * to back it, the sidebar starts lying about what the hub can do.
 */
export const FLOW_TREE = [
  {
    view: 'strategy',
    children: [
      { view: 'code', children: [{ view: 'game' }, { view: 'godot' }] },
      { view: 'agent' },
    ],
  },
];

/**
 * The sidebar, grouped. The Flow group renders FLOW_TREE; the others are plain lists.
 *
 * Only the flow is a chain. Assets and Terminal are reached for at any point rather than
 * passed through, and the last group is a record of what already happened - putting
 * either on the rail would draw a pipeline that does not exist.
 */
export const NAV_GROUPS = [
  { label: 'Flow',     tree: FLOW_TREE },
  { label: 'Draws on', views: ['assets', 'terminal'] },
  { label: 'Record',   views: ['training', 'history', 'settings'] },
];

export const viewLabel = (v) => (META[v] || META.code).label;
export const viewStep  = (v) => (META[v] || {}).step || '';
export const viewIcon = (v) => {
  const { Icon } = META[v] || META.code;
  return <Icon size={12} />;
};
/** The lucide component itself, for callers that need to size it themselves. */
export const viewIconComponent = (v) => (META[v] || META.code).Icon;
