import React, { useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Topbar from './components/Topbar.jsx';
import Toasts from './components/Toasts.jsx';
import Workspace from './components/Workspace.jsx';
import { useStore } from './store/useStore.js';
import { getKeys, loadHubToken } from './lib/api.js';
import { firstLeaf } from './lib/panes.js';

export default function App() {
  const theme = useStore(s => s.theme);
  const paneTree = useStore(s => s.paneTree);
  const activePaneId = useStore(s => s.activePaneId);
  const setActivePane = useStore(s => s.setActivePane);
  const setConnectedProviders = useStore(s => s.setConnectedProviders);
  const addToast = useStore(s => s.addToast);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  // Adopt a pane on first paint so the sidebar has something to retarget.
  useEffect(() => {
    if (activePaneId == null) {
      const l = firstLeaf(paneTree);
      if (l) setActivePane(l.id);
    }
  }, [activePaneId, paneTree, setActivePane]);

  useEffect(() => {
    (async () => {
      try { await loadHubToken(); setConnectedProviders(await getKeys()); }
      catch (err) { addToast(`Could not reach server: ${err.message}`, 'error'); }
    })();
  }, []);

  return (
    <div className="app">
      <Sidebar />
      <div className="main">
        <Topbar />
        <Workspace />
      </div>
      <Toasts />
    </div>
  );
}
