/**
 * assetsRouter.js - HTTP surface for the asset library.
 *
 *   GET    /api/assets           list + totals + version
 *   POST   /api/assets           { name, dataB64 }   add one
 *   POST   /api/assets/batch     { files:[{name,dataB64}] }
 *   DELETE /api/assets/:id       remove one
 *   POST   /api/assets/reindex   pick up hand-dropped files
 *
 * Files themselves are served by index.js at /assets/<name>, the same path game code
 * uses, so a game built in the workspace works in the browser with no rewriting.
 */
import { Router, json } from 'express';
import * as assets from './assets.js';
import { ensureCanonical, CANON } from './canonicalAssets.mjs';

export default function assetsRouter() {
  const router = Router();

  // Audio is large and arrives base64-encoded (+33%), so this route needs a much bigger
  // body limit than the app-wide 10mb. Scoped here so nothing else inherits it.
  const bigJson = json({ limit: '64mb' });

  router.get('/', (_req, res) => {
    res.json({
      items: assets.list(),
      totals: assets.totals(),
      allowed: assets.allowedExtensions(),
      prefix: assets.PUBLIC_PREFIX,
    });
  });

  router.post('/', bigJson, (req, res) => {
    const { name, dataB64, replace } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const r = assets.add({ name, dataB64, replace: !!replace });
    if (!r.ok) return res.status(400).json(r);
    res.json(r);
  });

  // Uploading a folder of sprites one request at a time is slow and gives the UI no
  // sensible way to report partial failure, so a batch reports per-file outcomes and
  // never fails the whole request because one file was the wrong type.
  router.post('/batch', bigJson, (req, res) => {
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    if (!files.length) return res.status(400).json({ error: 'files[] required' });
    const added = [];
    const failed = [];
    let duplicates = 0;
    const replace = !!req.body?.replace;
    for (const f of files.slice(0, 500)) {
      const r = assets.add({ name: f?.name, dataB64: f?.dataB64, replace });
      if (r.ok) { added.push(r.item); if (r.duplicate) duplicates++; }
      else failed.push({ name: f?.name, error: r.error });
    }
    res.json({ ok: true, added, failed, duplicates, totals: assets.totals() });
  });

  router.delete('/:id', (req, res) => {
    const r = assets.remove(req.params.id);
    if (!r.ok) return res.status(404).json(r);
    res.json({ ...r, totals: assets.totals() });
  });

  router.post('/reindex', (_req, res) => res.json({ ok: true, ...assets.reindex() }));

  // The canonical vocabulary: names that must always resolve. Generates placeholders for
  // any that are missing; `force` regenerates existing placeholders (never real art).
  router.get('/canonical', (_req, res) => {
    const have = new Map(assets.list().map((i) => [i.name, i]));
    res.json({ names: CANON.map((c) => ({ ...c, present: have.has(c.name), placeholder: !!have.get(c.name)?.placeholder })) });
  });
  router.post('/canonical', (req, res) => {
    try { res.json({ ok: true, ...ensureCanonical({ force: !!req.body?.force }), totals: assets.totals() }); }
    catch (e) { res.status(500).json({ error: e.message }); }
  });

  return router;
}
