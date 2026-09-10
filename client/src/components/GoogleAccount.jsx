import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link2, Link2Off, Loader2, RefreshCw, Check, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import {
  googleStatus, googleSaveConfig, googleSetServices, googleAuthorize, googleDisconnect, googleProbe,
} from '../lib/api.js';

/**
 * One Google account for Gmail, Drive, YouTube and Calendar.
 *
 * The consent itself happens in a real Google window that this component only opens - the
 * hub never sees the password, and there is no field here that would accept one. What it
 * does hold is the OAuth client id and secret, which come from your own Cloud project and
 * have to be created by you (Settings shows the six steps).
 *
 * The status shown is what the SERVER says was granted, never what was asked for. Google's
 * consent screen lets you untick individual services, so "we requested four" and "you have
 * four" are different facts, and only the second one is worth displaying.
 */
export default function GoogleAccount() {
  const addToast = useStore(s => s.addToast);

  const [status, setStatus] = useState(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [enabled, setEnabled] = useState([]);
  const [busy, setBusy] = useState('');
  const [probe, setProbe] = useState(null);
  const [showSetup, setShowSetup] = useState(false);
  const popupRef = useRef(null);

  const load = useCallback(async (quiet = false) => {
    try {
      const s = await googleStatus();
      setStatus(s);
      setClientId(prev => prev || s.clientId || '');
      setEnabled(prev => (prev.length ? prev : s.enabled));
      return s;
    } catch (err) {
      if (!quiet) addToast(`Could not read the Google connection: ${err.message}`, 'error');
      return null;
    }
  }, [addToast]);

  useEffect(() => { load(true); }, [load]);

  // The consent window is a separate browser context, so nothing tells this tab when it
  // finished. Re-reading on focus is what makes the card update the moment you come back,
  // without a poll running for the rest of the session.
  useEffect(() => {
    const onFocus = () => { if (popupRef.current) load(true); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  const saveConfig = async () => {
    if (!clientId.trim()) return addToast('Paste the OAuth client ID first', 'error');
    setBusy('config');
    try {
      const s = await googleSaveConfig({ client_id: clientId.trim(), client_secret: clientSecret.trim() });
      setStatus(s);
      setClientSecret('');
      addToast(s.clientChanged ? 'OAuth client saved - the old connection was dropped' : 'OAuth client saved');
    } catch (err) {
      addToast(err.message, 'error');
    } finally { setBusy(''); }
  };

  const toggle = async (id) => {
    const next = enabled.includes(id) ? enabled.filter(x => x !== id) : [...enabled, id];
    setEnabled(next);
    try { await googleSetServices(next); }
    catch (err) { addToast(err.message, 'error'); }
  };

  const connect = async () => {
    setBusy('connect');
    try {
      const { url } = await googleAuthorize(enabled);
      // A popup, not a redirect: a redirect would throw away whatever is half-typed in the
      // other tabs, and this app keeps all of its state in memory.
      popupRef.current = window.open(url, 'hub-google-oauth', 'width=520,height=680');
      if (!popupRef.current) addToast('Your browser blocked the sign-in window - allow popups for the hub', 'error');
    } catch (err) {
      addToast(err.message, 'error');
    } finally { setBusy(''); }
  };

  const disconnect = async () => {
    setBusy('disconnect');
    try {
      const s = await googleDisconnect();
      setStatus(s);
      setProbe(null);
      // Say plainly whether the grant is gone from the Google side too. "Disconnected"
      // that only means "we forgot the token" would be a lie about who still has access.
      addToast(s.revoked
        ? 'Disconnected, and the access was revoked at Google'
        : 'Disconnected here, but Google would not confirm the revoke - remove the hub at myaccount.google.com/permissions',
        s.revoked ? 'success' : 'error');
    } catch (err) {
      addToast(err.message, 'error');
    } finally { setBusy(''); }
  };

  const runProbe = async () => {
    setBusy('probe');
    setProbe(null);
    try {
      const { results } = await googleProbe();
      setProbe(results);
      const bad = Object.values(results).filter(r => !r.ok).length;
      addToast(bad ? `${bad} service(s) answered with an error` : 'Every connected service answered', bad ? 'error' : 'success');
    } catch (err) {
      addToast(err.message, 'error');
    } finally { setBusy(''); }
  };

  const copy = async (text, what) => {
    try { await navigator.clipboard.writeText(text); addToast(`${what} copied`); }
    catch { addToast('Could not copy', 'error'); }
  };

  if (!status) {
    return (
      <div className="provider-card">
        <div className="provider-card-head">
          <span className="provider-card-title">Google account</span>
          <Loader2 size={13} className="spin" />
        </div>
      </div>
    );
  }

  const services = status.services || [];
  const granted = new Set(status.granted || []);

  return (
    <div className="provider-card">
      <div className="provider-card-head">
        <span className="provider-dot" style={{ background: '#4285F4' }} />
        <span className="provider-card-title">Google account</span>
        <span className={`pill ${status.connected ? 'success' : ''}`}>
          <span className={`key-status ${status.connected ? 'connected' : ''}`} />
          {status.connected ? (status.email || 'Connected') : status.configured ? 'Not connected' : 'Needs an OAuth client'}
        </span>
      </div>

      {!status.configured && (
        <p className="hint" style={{ marginBottom: 10 }}>
          The hub signs in with <em>your own</em> Google OAuth client, so the tokens belong to a project you
          control rather than to this app. Creating it means signing into Google, which you should do
          yourself - the six steps are in <code>GOOGLE_SETUP.md</code>.
        </p>
      )}

      {/* Setup stays visible but collapsed once configured: it is rarely needed and the
          redirect URI is the one thing people come back for. */}
      {(!status.configured || showSetup) ? (
        <>
          <div className="field-group" style={{ marginBottom: 8 }}>
            <label>Authorised redirect URI - paste this into the OAuth client, exactly</label>
            <div className="key-row">
              <input type="text" readOnly value={status.redirectUri || ''} onFocus={(e) => e.target.select()} />
              <button className="btn btn-sm" onClick={() => copy(status.redirectUri, 'Redirect URI')}>
                <Copy size={12} />
              </button>
            </div>
          </div>
          <div className="field-group" style={{ marginBottom: 8 }}>
            <label>Client ID</label>
            <input
              type="text"
              placeholder="1234-abc.apps.googleusercontent.com"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            />
          </div>
          <div className="field-group" style={{ marginBottom: 10 }}>
            <label>Client secret</label>
            <input
              type="password"
              placeholder={status.configured ? '•••••••••• (saved - type a new one to replace)' : 'GOCSPX-...'}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
            />
          </div>
          <div className="provider-card-foot">
            {status.configured && (
              <button className="btn btn-sm" onClick={() => setShowSetup(false)}>Hide</button>
            )}
            <button className="btn btn-sm btn-primary" onClick={saveConfig} disabled={busy === 'config'}>
              {busy === 'config' ? <Loader2 size={12} className="spin" /> : null} Save OAuth client
            </button>
          </div>
        </>
      ) : null}

      <div className="field-group" style={{ marginTop: 10, marginBottom: 8 }}>
        <label>Services</label>
        <p className="hint" style={{ marginTop: 0, marginBottom: 6 }}>
          Each one adds its scopes to the consent screen. Turning one off here does not revoke it -
          disconnect and reconnect to narrow what the hub actually holds.
        </p>
        {services.map(svc => {
          const on = enabled.includes(svc.id);
          const has = granted.has(svc.id);
          const p = probe?.[svc.id];
          return (
            <div key={svc.id} className="key-row" style={{ alignItems: 'flex-start', marginBottom: 6 }}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => toggle(svc.id)}
                style={{ width: 'auto', marginTop: 3, flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 500 }}>{svc.label}</span>
                  {has && <span className="pill success"><Check size={10} /> granted</span>}
                  {svc.restricted && <span className="pill" title="Google requires app verification before anyone but your own test users can consent">restricted scope</span>}
                  {p && (p.ok
                    ? <span className="pill success"><Check size={10} /> responded</span>
                    : <span className="pill" style={{ color: 'var(--danger)' }}><AlertCircle size={10} /> {p.error}</span>)}
                </div>
                <div className="hint" style={{ marginTop: 2 }}>{svc.note}</div>
              </div>
            </div>
          );
        })}
      </div>

      {status.connected && (
        <p className="hint" style={{ marginBottom: 8 }}>
          Signed in as <strong>{status.email}</strong>. Access token refreshes automatically
          {status.accessTokenExpiresIn != null ? ` (next in ~${Math.round(status.accessTokenExpiresIn / 60)} min)` : ''}.
        </p>
      )}

      <div className="provider-card-foot">
        {status.configured && !showSetup && (
          <button className="btn btn-sm" onClick={() => setShowSetup(true)}>OAuth client…</button>
        )}
        <a className="btn btn-sm" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
          <ExternalLink size={12} /> Google permissions
        </a>
        {status.connected && (
          <>
            <button className="btn btn-sm" onClick={runProbe} disabled={busy === 'probe'}>
              {busy === 'probe' ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} Test
            </button>
            <button className="btn btn-sm btn-danger" onClick={disconnect} disabled={busy === 'disconnect'}>
              <Link2Off size={12} /> Disconnect
            </button>
          </>
        )}
        <button
          className="btn btn-sm btn-primary"
          onClick={connect}
          disabled={!status.configured || !enabled.length || busy === 'connect'}
          title={!status.configured ? 'Save your OAuth client first'
            : !enabled.length ? 'Turn on at least one service' : ''}
        >
          {busy === 'connect' ? <Loader2 size={12} className="spin" /> : <Link2 size={12} />}
          {status.connected ? 'Reconnect' : 'Connect Google'}
        </button>
      </div>
    </div>
  );
}
