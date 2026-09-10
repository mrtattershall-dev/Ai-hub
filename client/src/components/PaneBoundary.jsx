import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * PaneBoundary - stop one pane's crash from taking down the workspace.
 *
 * React unmounts the WHOLE tree on an uncaught render error. Without a boundary, a bug
 * in the Godot pane kills your terminal, your running agent and your layout at the same
 * time - and in a workspace where panes hold live state (a shell with a build running,
 * a game mid-preview) that is expensive, not just ugly.
 *
 * One boundary per pane means a failure is contained to the pane that caused it: the
 * others keep running, and you get the error plus a way to retry instead of a blank page.
 */
export default class PaneBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Keep the stack: a pane that dies silently is worse than one that dies loudly.
    this.setState({ info });
    console.error(`[pane:${this.props.view}] crashed`, error, info);
  }

  retry = () => this.setState({ error: null, info: null });

  render() {
    if (!this.state.error) return this.props.children;
    const msg = String(this.state.error && this.state.error.message || this.state.error);
    const stack = (this.state.info && this.state.info.componentStack || '').trim().split('\n').slice(0, 6).join('\n');
    return (
      <div className="pane-crash">
        <div className="pane-crash-head">
          <AlertTriangle size={14} />
          <span>This pane crashed</span>
          <span style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={this.retry}>
            <RotateCcw size={12} /> Retry
          </button>
        </div>
        <div className="pane-crash-body">
          <div className="pane-crash-msg">{msg}</div>
          <div className="pane-crash-hint">
            The other panes are unaffected. Retry remounts just this one; switching its
            view from the pane menu also clears it.
          </div>
          {stack && <pre className="pane-crash-stack">{stack}</pre>}
        </div>
      </div>
    );
  }
}
