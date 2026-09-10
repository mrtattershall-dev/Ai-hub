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
export const VIEWS = {
  code:     CodePage,
  agent:    AgentPage,
  game:     GamePage,
  godot:    GodotPage,
  assets:   AssetsPage,
  terminal: TerminalPage,
  strategy: StrategyPage,
  training: TrainingPage,
  history:  HistoryPage,
  settings: SettingsPage,
};

const META = {
  code:     { label: 'Code',         Icon: Code2 },
  agent:    { label: 'Agent',        Icon: Bot },
  game:     { label: 'Game',         Icon: Gamepad2 },
  godot:    { label: 'Godot',        Icon: Boxes },
  assets:   { label: 'Assets',       Icon: Images },
  terminal: { label: 'Terminal',     Icon: TerminalSquare },
  strategy: { label: 'Strategy',     Icon: Compass },
  training: { label: 'Training Log', Icon: BookOpen },
  history:  { label: 'History',      Icon: History },
  settings: { label: 'Settings',     Icon: Settings },
};

export const viewLabel = (v) => (META[v] || META.code).label;
export const viewIcon = (v) => {
  const { Icon } = META[v] || META.code;
  return <Icon size={12} />;
};
