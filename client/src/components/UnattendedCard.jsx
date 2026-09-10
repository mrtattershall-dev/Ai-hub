import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Moon, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { supervisorGet, supervisorSet } from '../lib/api.js';

/**
 * The switch that makes the queue mean anything.
 *
 * Everything behind it already existed - the durable queue, chained goals, the retry that
 * splices itself in when a step fails - and none of it had ever run, because the only way
 * to arm it was an environment variable that start-hub.bat never set. It is a stored
 * setting now, and this is where you turn it on.
 *
 * The brakes are shown next to the switch, not buried in a doc. "Work starts by itself
 * while you are asleep" is not something anyone should switch on without reading, in the
 * same breath, what stops it.
 */
export default function UnattendedCard() {
  const addToast = useStore(s => s.addToast);
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setState(await supervisorGet()); }
    catch { /* the card simply does not render rather than nagging on every Settings visit */ }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async () => {
    setBusy(true);
    try {
      const next = await supervisorSet(!state.supervisor);
      setState(s => ({ ...s, ...next }));
      addToast(next.supervisor
        ? `Unattended work is ON — finished runs will start the next queued goal${state.queued ? ` (${state.queued} waiting)` : ''}`
        : 'Unattended work is OFF — the queue will wait for you');
    } catch (err) {
      // The forced case is a 409 with a real explanation; showing it is more useful than
      // silently leaving the switch where it was.
      addToast(err.message, 'error');
      load();
    } finally { setBusy(false); }
  };

  if (!state) return null;

  return (
    <div className="provider-card">
      <div className="provider-card-head">
        <span className="provider-dot" style={{ background: state.supervisor ? 'var(--success)' : 'var(--text-tertiary)' }} />
        <span className="provider-card-title">Unattended work</span>
        <span className={`pill ${state.supervisor ? 'success' : ''}`}>
          <Moon size={10} /> {state.supervisor ? 'On' : 'Off'}
        </span>
        {state.forced && <span className="pill" title="AGENT_SUPERVISOR=1 is set in the environment">forced by environment</span>}
      </div>

      <p className="hint" style={{ marginBottom: 8 }}>
        When this is on, a run that finishes cleanly starts the next goal in the queue by itself —
        which is what makes a queued plan run end to end instead of waiting for you to press
        Run next each time. A run that fails is retried once, then stops and waits.
      </p>

      <div className="hint" style={{ marginBottom: 10 }}>
        <ShieldCheck size={11} style={{ verticalAlign: -1, marginRight: 4 }} />
        What bounds it: commands are still held to the <strong>{state.approvalMode}</strong> approval
        mode ({state.approvalModeDescription}); at most <strong>{state.maxAutoStartsPerHour}</strong> runs
        may start automatically per hour ({state.autoStartsLastHour} in the last hour); and work the
        agent queues for itself stops after <strong>{state.maxGenerations}</strong> hops from something
        you asked for.
      </div>

      <div className="provider-card-foot">
        <span className="hint" style={{ marginRight: 'auto' }}>
          {state.queued ? `${state.queued} goal(s) waiting in the queue` : 'The queue is empty'}
        </span>
        <button
          className={`btn btn-sm ${state.supervisor ? 'btn-danger' : 'btn-primary'}`}
          onClick={toggle}
          disabled={busy || (state.forced && state.supervisor)}
          title={state.forced && state.supervisor ? 'AGENT_SUPERVISOR=1 is set in the environment' : ''}
        >
          {busy ? <Loader2 size={12} className="spin" /> : null}
          {state.supervisor ? 'Turn off' : 'Turn on'}
        </button>
      </div>
    </div>
  );
}
