// Cross-process admission for real local inference and browser-heavy maintenance.
// flock releases on crash; the pipe releases it if the owning Node process dies.
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
export function memoryAvailable(text = readFileSync('/proc/meminfo', 'utf8')) {
  const kb = name => Number(text.match(new RegExp(`^${name}:\\s+(\\d+)`, 'm'))?.[1] || 0);
  return { ramMB: kb('MemAvailable') / 1024, swapMB: kb('SwapFree') / 1024 };
}
export function admitted(m, kind) {
  return m.ramMB >= (['model', 'chat'].includes(kind) ? 512 : 768) && m.ramMB + m.swapMB >= (['model', 'chat'].includes(kind) ? 4608 : 1536);
}
export function isManagedLocal(base) {
  if (process.env.LEGASUS_RESOURCE_GUARD !== '1') return false;
  try { const u = new URL(base); return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname) && (u.port || '80') === '11434'; } catch { return false; }
}
export function resourceStatus(kind, state, detail = {}) {
  const dir = process.env.LEGASUS_STATUS_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${kind}-${process.pid}.json`);
  writeFileSync(path + '.tmp', JSON.stringify({ pid: process.pid, kind, state, at: new Date().toISOString(), ...detail }));
  renameSync(path + '.tmp', path);
}
export async function acquireLease(kind, { signal, path = process.env.LEGASUS_RESOURCE_LOCK, checkMemory = true } = {}) {
  if (!path) return () => {};
  signal?.throwIfAborted();
  mkdirSync(dirname(path), { recursive: true });
  resourceStatus(kind, 'waiting for another heavy job');
  const child = spawn('flock', ['-x', '-F', path, process.execPath, '-e', 'process.stdout.write("locked\\n");process.stdin.resume();process.stdin.on("end",()=>process.exit(0));'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let released = false;
  const release = () => { if (released) return; released = true; signal?.removeEventListener('abort', abort); child.kill(); resourceStatus(kind, 'idle'); };
  const abort = () => child.kill();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code, sig) => reject(new Error(`resource lock exited: ${code}/${sig}`)));
      child.stdout.once('data', resolve);
    });
    signal?.throwIfAborted();
    while (checkMemory && !admitted(memoryAvailable(), kind)) {
      resourceStatus(kind, 'waiting for memory', memoryAvailable());
      await delay(15000, undefined, { signal });
    }
    resourceStatus(kind, 'active');
    return release;
  } catch (e) { release(); throw e; }
}
export async function unloadLocalModel() {
  const base = 'http://127.0.0.1:11434';
  const r = await fetch(base + '/api/ps', { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`Ollama status HTTP ${r.status}`);
  for (const m of (await r.json()).models || []) {
    const u = await fetch(base + '/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m.name, keep_alive: 0 }), signal: AbortSignal.timeout(60000) });
    if (!u.ok) throw new Error(`Model unload HTTP ${u.status}`);
    await u.text();
  }
}
