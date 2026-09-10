import React, { useEffect, useState } from 'react';
import { Save, Trash2, KeyRound } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { PROVIDERS } from '../lib/constants.js';
import { getKeys, saveKey, deleteKey, getProviders } from '../lib/api.js';
import GoogleAccount from '../components/GoogleAccount.jsx';
import UnattendedCard from '../components/UnattendedCard.jsx';

export default function SettingsPage() {
  const connectedProviders = useStore(s => s.connectedProviders);
  const setConnectedProviders = useStore(s => s.setConnectedProviders);
  const addToast = useStore(s => s.addToast);

  const [defaults, setDefaults] = useState({});
  const [forms, setForms] = useState({});
  const [busy, setBusy] = useState({});
  const [loaded, setLoaded] = useState(false);

  const refreshKeys = async () => {
    try {
      const data = await getKeys();
      setConnectedProviders(data);
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [keys, providers] = await Promise.all([getKeys(), getProviders()]);
        setConnectedProviders(keys);
        setDefaults(providers);
        const initialForms = {};
        PROVIDERS.forEach(p => {
          initialForms[p.id] = {
            key_value: '',
            model: keys[p.id]?.model || providers[p.id]?.model || '',
            base_url: keys[p.id]?.base_url || providers[p.id]?.base_url || '',
          };
        });
        setForms(initialForms);
      } catch (err) {
        addToast(err.message, 'error');
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line
  }, []);

  const updateForm = (providerId, field, value) => {
    setForms(f => ({ ...f, [providerId]: { ...f[providerId], [field]: value } }));
  };

  const handleSave = async (providerId) => {
    const form = forms[providerId] || {};
    const isOllama = providerId === 'ollama';
    const isConnected = isOllama || !!connectedProviders[providerId];
    const keyValue = form.key_value?.trim() || (isOllama ? 'ollama' : '');

    if (!keyValue && !isConnected) {
      addToast('Enter an API key to save', 'error');
      return;
    }

    setBusy(b => ({ ...b, [providerId]: true }));
    try {
      await saveKey({
        provider: providerId,
        key_value: keyValue,
        model: form.model?.trim() || undefined,
        base_url: form.base_url?.trim() || undefined,
      });
      await refreshKeys();
      updateForm(providerId, 'key_value', '');
      addToast(`${PROVIDERS.find(p => p.id === providerId)?.name || providerId} saved`);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setBusy(b => ({ ...b, [providerId]: false }));
    }
  };

  const handleRemove = async (providerId) => {
    setBusy(b => ({ ...b, [providerId]: true }));
    try {
      await deleteKey(providerId);
      await refreshKeys();
      addToast(`${PROVIDERS.find(p => p.id === providerId)?.name || providerId} removed`);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setBusy(b => ({ ...b, [providerId]: false }));
    }
  };

  return (
    <div className="output-area" style={{ paddingTop: 14, maxWidth: 720 }}>
      <div className="settings-section" style={{ padding: 0, border: 'none' }}>
        <h3>Accounts</h3>
        <p className="hint">
          Services the hub acts on your behalf in. Sign-in happens in a Google window - the hub
          never sees your password, and stores only the tokens Google issues.
        </p>
      </div>

      <GoogleAccount />

      <div className="settings-section" style={{ padding: 0, border: 'none', marginTop: 22 }}>
        <h3>Running on its own</h3>
        <p className="hint">
          Whether the agent picks up queued work without being asked, and what stops it if it goes wrong.
        </p>
      </div>

      <UnattendedCard />

      <div className="settings-section" style={{ padding: 0, border: 'none', marginTop: 22 }}>
        <h3>API providers</h3>
        <p className="hint">
          Keys are stored locally in the server's SQLite database and are never sent to the browser after saving.
          Leave model / base URL blank to use the provider's default.
        </p>
      </div>

      {PROVIDERS.map(p => {
        const conn = connectedProviders[p.id];
        const isOllama = p.id === 'ollama';
        const isConnected = isOllama || !!conn;
        const form = forms[p.id] || { key_value: '', model: '', base_url: '' };
        const def = defaults[p.id] || {};

        return (
          <div className="provider-card" key={p.id}>
            <div className="provider-card-head">
              <span className="provider-dot" style={{ background: p.color }} />
              <span className="provider-card-title">{p.name}</span>
              <span className={`pill ${isConnected ? 'success' : ''}`}>
                <span className={`key-status ${isConnected ? 'connected' : ''}`} />
                {isOllama ? 'Local - no key needed' : isConnected ? 'Connected' : 'Not connected'}
              </span>
            </div>

            {!isOllama && (
              <div className="field-group" style={{ marginBottom: 10 }}>
                <label>API key</label>
                <div className="key-row">
                  <KeyRound size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                  <input
                    type="password"
                    placeholder={isConnected ? '•••••••••••••••• (saved - enter a new key to replace)' : 'sk-...'}
                    value={form.key_value}
                    onChange={(e) => updateForm(p.id, 'key_value', e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="fields-grid">
              <div className="field-group">
                <label>Model</label>
                <input
                  type="text"
                  placeholder={def.model || ''}
                  value={form.model}
                  onChange={(e) => updateForm(p.id, 'model', e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Base URL</label>
                <input
                  type="text"
                  placeholder={def.base_url || ''}
                  value={form.base_url}
                  onChange={(e) => updateForm(p.id, 'base_url', e.target.value)}
                />
              </div>
            </div>

            <div className="provider-card-foot">
              {isConnected && !isOllama && (
                <button className="btn btn-sm btn-danger" onClick={() => handleRemove(p.id)} disabled={busy[p.id]}>
                  <Trash2 size={12} /> Remove key
                </button>
              )}
              <button className="btn btn-sm btn-primary" onClick={() => handleSave(p.id)} disabled={busy[p.id] || !loaded}>
                <Save size={12} /> Save
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
