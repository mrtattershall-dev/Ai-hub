import React from 'react';
import { useStore } from '../store/useStore.js';
import { PROVIDER_MAP, PROVIDERS } from '../lib/constants.js';

const TAB_TITLES = {
  code: 'Code',
  game: 'Game',
  strategy: 'Strategy',
  history: 'History',
  settings: 'Settings',
};

export default function Topbar() {
  const activeTab = useStore(s => s.activeTab);
  const activeProvider = useStore(s => s.activeProvider);
  const connectedProviders = useStore(s => s.connectedProviders);

  const showProvider = activeTab === 'code' || activeTab === 'strategy';
  const provider = PROVIDER_MAP[activeProvider] || PROVIDERS[0];
  const conn = connectedProviders[activeProvider];
  const isConnected = activeProvider === 'ollama' || !!conn;

  return (
    <div className="topbar">
      <span className="topbar-title">AI Coding Hub</span>
      <span className="topbar-sep">/</span>
      <span className="topbar-title">{TAB_TITLES[activeTab] || ''}</span>

      {showProvider && (
        <>
          <span style={{ flex: 1 }} />
          <span className="topbar-sub">{conn?.model || ''}</span>
          <span className={`pill ${isConnected ? 'success' : 'danger'}`}>
            <span className="provider-dot" style={{ background: provider.color }} />
            {provider.name}
          </span>
        </>
      )}
    </div>
  );
}
