import React from 'react';
import { Sun, Moon, Sparkles } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { PROVIDERS } from '../lib/constants.js';
import { NAV_GROUPS, viewLabel, viewStep, viewIconComponent } from '../lib/views.jsx';

// Labels and icons come from lib/views.jsx rather than a second list here. The two
// copies had already drifted once - the sidebar's order and the pane menu's disagreed -
// and a nav item that exists in one and not the other is a tab you cannot reach.

function NavItem({ id, elbow = null }) {
  const activeTab = useStore(s => s.activeTab);
  const setActiveTab = useStore(s => s.setActiveTab);
  const trainingLog = useStore(s => s.trainingLog);
  const Icon = viewIconComponent(id);
  const step = elbow ? viewStep(id) : '';

  const item = (
    <div className={`nav-item ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
      <Icon className="nav-icon" />
      <span>{viewLabel(id)}</span>
      {/* The verb, not a second name for the tab: reading the branch gives
          plan -> write -> run, which is the point of drawing it as a tree. */}
      {step && <span className="nav-step">{step}</span>}
      {id === 'training' && <span className="nav-badge">{trainingLog.length}</span>}
    </div>
  );
  if (!elbow) return item;
  return <div className="nav-node">{elbow}{item}</div>;
}

/**
 * One level of FLOW_TREE. The connector shape is decided here rather than in CSS because
 * it depends on whether a node is the last of its siblings, and a `:last-child` rule
 * cannot see that - each node is followed by its own children, so the last *element* in
 * the container is usually a subtree, not the last sibling.
 */
function FlowBranch({ nodes, depth }) {
  return nodes.map((node, i) => {
    const isLast = i === nodes.length - 1;
    const elbow = <span className={`nav-elbow${depth === 0 ? ' root' : ''}${isLast ? ' last' : ''}`} />;
    return (
      <div className="nav-branch" key={node.view}>
        <NavItem id={node.view} elbow={elbow} />
        {node.children && (
          // A parent that still has siblings below it needs the trunk drawn past its own
          // children, or the branch visibly breaks and reconnects further down.
          <div className={`nav-children${isLast ? '' : ' through'}`}>
            <FlowBranch nodes={node.children} depth={depth + 1} />
          </div>
        )}
      </div>
    );
  });
}

export default function Sidebar() {
  const activeTab = useStore(s => s.activeTab);
  const activeProvider = useStore(s => s.activeProvider);
  const setActiveProvider = useStore(s => s.setActiveProvider);
  const connectedProviders = useStore(s => s.connectedProviders);
  const theme = useStore(s => s.theme);
  const toggleTheme = useStore(s => s.toggleTheme);

  const showProviders = activeTab === 'code' || activeTab === 'strategy';

  return (
    <div className="sidebar">
      <div className="app-brand">
        <span className="app-brand-icon"><Sparkles /></span>
        <span>AI Coding Hub</span>
      </div>

      {NAV_GROUPS.map(group => (
        <div className="sidebar-section" key={group.label}>
          <div className="sidebar-label">{group.label}</div>
          {group.tree
            ? <div className="nav-flow"><FlowBranch nodes={group.tree} depth={0} /></div>
            : group.views.map(id => <NavItem key={id} id={id} />)}
        </div>
      ))}

      {showProviders && (
        <>
          <div className="divider" style={{ margin: '4px 12px' }} />
          <div className="sidebar-section" style={{ flex: 1 }}>
            <div className="sidebar-label">Providers</div>
            {PROVIDERS.map(p => {
              const isConnected = p.id === 'ollama' || !!connectedProviders[p.id];
              return (
                <div
                  key={p.id}
                  className={`provider-item ${activeProvider === p.id ? 'active' : ''}`}
                  onClick={() => setActiveProvider(p.id)}
                  title={p.name}
                >
                  <span className="provider-dot" style={{ background: p.color }} />
                  <span className="provider-name">{p.name}</span>
                  <span className={`p-status ${isConnected ? 'connected' : ''}`}>
                    {p.id === 'ollama' ? 'Local' : isConnected ? 'Connected' : 'Not set'}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!showProviders && <div style={{ flex: 1 }} />}

      <div className="sidebar-section">
        <div className="nav-item" onClick={toggleTheme}>
          {theme === 'light' ? <Moon className="nav-icon" /> : <Sun className="nav-icon" />}
          <span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>
        </div>
      </div>
    </div>
  );
}
