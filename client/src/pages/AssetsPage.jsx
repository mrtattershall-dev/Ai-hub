import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Images, Upload, RefreshCw, Trash2, Copy, Music, FileText, Type, Search, ChevronDown } from 'lucide-react';
import { useStore } from '../store/useStore.js';
import { assetsList, assetsAdd, assetsRemove, assetsReindex, assetsCanonical, ASSET_URL } from '../lib/api.js';

// The asset library: every sprite, sound, font and data file the agent may load.
//
// What matters on this page is the PATH, not the picture. The agent loads assets by exact
// path (`assets/orc_orc1_idle_with_shadow.png`), the verifier serves exactly the files
// in the manifest, and an invented name is a 404 and a blank canvas. So every card leads
// with its path and has a one-click copy - this page is a lookup table with thumbnails,
// not a gallery.

const PAGE = 120;   // cards rendered before "show more" - 13k <img> tags at once is not a page
const CHUNK_B64 = 40 * 1024 * 1024;   // per-request upload budget, under the server's 64mb body cap

const KIND_ICON = { audio: Music, data: FileText, font: Type };

function fmtBytes(n) {
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error(`could not read ${file.name}`));
    r.readAsDataURL(file);
  });
}

export default function AssetsPage() {
  const addToast = useStore(s => s.addToast);
  const [items, setItems] = useState([]);
  const [totals, setTotals] = useState(null);
  const [allowed, setAllowed] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');   // 'all' | image | audio | font | data | placeholder
  const [family, setFamily] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const [uploading, setUploading] = useState(null);   // { done, total }
  const fileInput = useRef(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await assetsList();
      setItems(d.items || []);
      setTotals(d.totals || null);
      setAllowed(d.allowed || {});
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // Pack of origin, as far as the name says: the token before the first underscore.
  const families = useMemo(() => {
    const m = new Map();
    for (const i of items) {
      const f = i.name.split('_')[0].replace(/\.[^.]+$/, '');
      m.set(f, (m.get(f) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return items.filter(i =>
      (kind === 'all' || (kind === 'placeholder' ? !!i.placeholder : i.kind === kind))
      && (family === 'all' || i.name.startsWith(family + '_') || i.name.startsWith(family + '.'))
      && words.every(w => i.name.toLowerCase().includes(w)));
  }, [items, query, kind, family]);

  useEffect(() => { setShown(PAGE); }, [query, kind, family]);

  const copyPath = async (item) => {
    try { await navigator.clipboard.writeText(item.path); addToast(`Copied ${item.path}`, 'info'); }
    catch { addToast(item.path, 'info'); }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete ${item.name} from the library?\n\nAny game that loads ${item.path} will stop rendering it.`)) return;
    try {
      const r = await assetsRemove(item.id);
      setItems(prev => prev.filter(i => i.id !== item.id));
      if (r.totals) setTotals(r.totals);
    } catch (e) { addToast(e.message, 'error'); }
  };

  // Generate any missing canonical names. Placeholders: a generated stand-in that keeps
  // `assets/player.png` resolving until real art is uploaded under that exact name.
  const generateCanonical = async () => {
    try {
      const r = await assetsCanonical(false);
      addToast(`Canonical set: ${r.generated} generated, ${r.kept} already present (${r.total} names)`, 'info');
      load();
    } catch (e) { addToast(e.message, 'error'); }
  };

  const reindex = async () => {
    try {
      const r = await assetsReindex();
      addToast(`Reindexed: ${r.added} added, ${r.missing} missing entries dropped, ${r.total} total`, 'info');
      load();
    } catch (e) { addToast(e.message, 'error'); }
  };

  // Upload in size-bounded chunks so a folder of 4,000 icons is a handful of requests
  // and one bad file cannot fail the rest - the server reports per-file outcomes.
  const onFiles = async (fileList) => {
    const files = [...(fileList || [])];
    if (!files.length) return;
    setUploading({ done: 0, total: files.length });
    let added = 0, dupes = 0;
    const failed = [];
    try {
      let chunk = [];
      let size = 0;
      const flush = async () => {
        if (!chunk.length) return;
        const r = await assetsAdd(chunk);
        added += (r.added || []).length - (r.duplicates || 0);
        dupes += r.duplicates || 0;
        for (const f of r.failed || []) failed.push(`${f.name}: ${f.error}`);
        chunk = []; size = 0;
      };
      for (const [n, f] of files.entries()) {
        const dataB64 = await readAsBase64(f);
        if (size + dataB64.length > CHUNK_B64 && chunk.length) await flush();
        chunk.push({ name: f.name, dataB64 });
        size += dataB64.length;
        setUploading({ done: n + 1, total: files.length });
      }
      await flush();
      addToast(`Added ${added}${dupes ? `, ${dupes} already in the library` : ''}${failed.length ? `, ${failed.length} refused` : ''}`, failed.length ? 'error' : 'info');
      for (const f of failed.slice(0, 3)) addToast(f, 'error');
      load();
    } catch (e) {
      addToast(e.message, 'error');
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const accept = Object.values(allowed).flat().join(',');
  const kinds = ['all', 'image', 'audio', 'font', 'data', 'placeholder'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header: what exists, and the version that pins it for the eval. */}
      <div style={{ padding: '14px 16px 10px', borderBottom: '0.5px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Images size={16} />
          <span style={{ fontWeight: 600 }}>Assets</span>
          {totals && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
              {totals.files.toLocaleString()} files · {fmtBytes(totals.bytes)}
              {' · '}{Object.entries(totals.byKind || {}).map(([k, n]) => `${n} ${k}`).join(', ')}
            </span>
          )}
          {totals && (
            <span
              title="Hash of every asset name + content. The eval pins this so a Phaser score is only compared against runs that loaded the same bytes."
              style={{ fontSize: 10, fontFamily: 'monospace', padding: '1px 6px', borderRadius: 4, background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
            >
              v {totals.version}
            </span>
          )}
          <span style={{ flex: 1 }} />
          <input ref={fileInput} type="file" multiple accept={accept} hidden onChange={e => onFiles(e.target.files)} />
          <button className="btn btn-sm" onClick={() => fileInput.current?.click()} disabled={!!uploading}>
            <Upload size={12} /> {uploading ? `Uploading ${uploading.done}/${uploading.total}…` : 'Add files'}
          </button>
          <button className="btn btn-sm" onClick={reindex} title="Pick up files dropped straight into the assets/ folder"><RefreshCw size={12} /> Reindex</button>
          <button className="btn btn-sm" onClick={generateCanonical} title="Make sure every canonical name (player.png, coin.png, jump.wav, …) exists — generated placeholders until real art replaces them">
            <Images size={12} /> Canonical set
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 220, padding: '5px 9px', borderRadius: 6, border: '0.5px solid var(--border)', background: 'var(--bg-tertiary)' }}>
            <Search size={12} style={{ color: 'var(--text-tertiary)' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter by words in the name, e.g. orc attack"
              style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 12, outline: 'none' }}
            />
          </div>
          {kinds.map(k => (
            <button key={k} className="btn btn-sm" onClick={() => setKind(k)}
              style={{ opacity: kind === k ? 1 : 0.6, fontWeight: kind === k ? 600 : 400 }}>
              {k}
            </button>
          ))}
        </div>

        {/* Pack chips. Fast narrowing when you know roughly where a sprite came from. */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-sm" onClick={() => setFamily('all')} style={{ fontSize: 11, opacity: family === 'all' ? 1 : 0.6 }}>all packs</button>
          {families.slice(0, 20).map(([f, n]) => (
            <button key={f} className="btn btn-sm" onClick={() => setFamily(f)}
              style={{ fontSize: 11, opacity: family === f ? 1 : 0.6, fontWeight: family === f ? 600 : 400 }}>
              {f} <span style={{ color: 'var(--text-tertiary)' }}>{n}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        {loading && <div style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>Loading…</div>}
        {!loading && !items.length && (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1.6 }}>
            The library is empty. Add sprites, audio, fonts or tilemaps and the agent will be able to load them by path —
            <code style={{ marginLeft: 4 }}>this.load.image('hero', 'assets/hero.png')</code>.
          </div>
        )}
        {!loading && items.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 10 }}>
            {filtered.length.toLocaleString()} match{filtered.length === 1 ? '' : 'es'}
            {filtered.length > shown ? ` · showing ${shown}` : ''}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {filtered.slice(0, shown).map(item => {
            const Icon = KIND_ICON[item.kind];
            return (
              <div key={item.id} style={{ border: '0.5px solid var(--border)', borderRadius: 8, background: 'var(--bg-secondary)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'repeating-conic-gradient(rgba(128,128,128,0.12) 0 25%, transparent 0 50%) 0 0 / 16px 16px' }}>
                  {item.kind === 'image' ? (
                    <img src={ASSET_URL(item.name)} alt={item.name} loading="lazy"
                      style={{ maxWidth: '100%', maxHeight: '100%', imageRendering: 'pixelated', objectFit: 'contain' }} />
                  ) : item.kind === 'audio' ? (
                    <audio controls preload="none" src={ASSET_URL(item.name)} style={{ width: '92%', height: 28 }} />
                  ) : (
                    Icon ? <Icon size={26} style={{ color: 'var(--text-tertiary)' }} /> : null
                  )}
                </div>
                <div style={{ padding: '6px 8px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div title={item.role ? `${item.path} — ${item.role}` : item.path} style={{ fontSize: 11, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {item.placeholder && (
                      <span title="Generated stand-in. Upload a real file with this exact name to replace it — every game keeps working."
                        style={{ fontSize: 9, padding: '0 4px', borderRadius: 3, background: 'rgba(245,158,11,0.18)', color: '#f59e0b', flexShrink: 0 }}>
                        placeholder
                      </span>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                    {item.width ? `${item.width}×${item.height} · ` : ''}{fmtBytes(item.bytes)}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-sm" onClick={() => copyPath(item)} title={`Copy ${item.path}`} style={{ flex: 1, fontSize: 10 }}>
                      <Copy size={11} /> path
                    </button>
                    <button className="btn btn-sm" onClick={() => remove(item)} title="Delete from the library" style={{ fontSize: 10 }}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filtered.length > shown && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
            <button className="btn btn-sm" onClick={() => setShown(s => s + PAGE * 2)}>
              <ChevronDown size={12} /> Show {Math.min(PAGE * 2, filtered.length - shown)} more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
