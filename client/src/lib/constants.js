// Provider metadata for the UI. Keys must match server PROVIDER_DEFAULTS.
export const PROVIDERS = [
  { id: 'claude',   name: 'Claude',           color: '#c77f3c' },
  { id: 'openai',   name: 'OpenAI',           color: '#10a37f' },
  { id: 'deepseek', name: 'DeepSeek',         color: '#378ADD' },
  { id: 'kimi',     name: 'Kimi (Moonshot)',  color: '#3C3489' },
  { id: 'mistral',  name: 'Mistral',          color: '#e24b4a' },
  { id: 'groq',     name: 'Groq',             color: '#f0a830' },
  { id: 'perplexity', name: 'Perplexity',     color: '#20808D' },
  { id: 'ollama',   name: 'Ollama (local)',   color: '#9a9a94' },
];

export const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));

// Code tab: task chips
export const CODE_TASKS = [
  { id: 'explain',  label: 'Explain' },
  { id: 'refactor', label: 'Refactor' },
  { id: 'debug',    label: 'Debug' },
  { id: 'generate', label: 'Generate' },
  { id: 'game',     label: 'Game' },
  { id: 'tests',    label: 'Tests' },
  { id: 'document', label: 'Document' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'review',   label: 'Review' },
];

// Code tab: response style
export const CODE_MODES = [
  { id: 'step',   label: 'Step-by-step' },
  { id: 'direct', label: 'Direct' },
];

// Strategy tab: canvas types, each maps to a set of structured sections
export const CANVAS_TYPES = [
  {
    id: 'map',
    label: 'Project Map',
    description: 'Break a project or feature down into its key parts and dependencies.',
    sections: ['Overview', 'Key Components', 'Dependencies', 'Open Questions'],
  },
  {
    id: 'plan',
    label: 'Action Plan',
    description: 'Turn a goal into a concrete, ordered plan of action.',
    sections: ['Goal', 'Milestones', 'Tasks', 'Risks & Mitigations'],
  },
  {
    id: 'architecture',
    label: 'Architecture',
    description: 'Sketch a technical architecture for a system or feature.',
    sections: ['Overview', 'Components', 'Data Flow', 'Tradeoffs'],
  },
  {
    id: 'review',
    label: 'Strategy Review',
    description: 'Critique an existing plan or approach and suggest improvements.',
    sections: ['Summary', 'Strengths', 'Weaknesses', 'Recommendations'],
  },
];
