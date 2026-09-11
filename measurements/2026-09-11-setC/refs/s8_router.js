// Reference solution (final state of chain 8) - used only to prove checks-C.mjs can pass.
class Router {
  constructor() { this.routes = []; this.mw = []; }
  add(method, pattern, handler) { this.routes.push({ method: String(method).toUpperCase(), parts: pattern.split('/').filter(Boolean), handler }); return this; }
  use(fn) { this.mw.push(fn); return this; }
  static match(parts, segs) {
    const params = {};
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (p === '*' && i === parts.length - 1) { if (segs.length <= i) return null; params['*'] = segs.slice(i).join('/'); return params; }
      if (i >= segs.length) return null;
      if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(segs[i]);
      else if (p !== segs[i]) return null;
    }
    return segs.length === parts.length ? params : null;
  }
  handle(method, url) {
    const [path, qs = ''] = String(url).split('?');
    const segs = path.split('/').filter(Boolean);
    const query = {};
    for (const kv of qs.split('&').filter(Boolean)) { const [k, v = ''] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v); }
    const req = { method: String(method).toUpperCase(), path, params: {}, query };
    for (const fn of this.mw) { const r = fn(req); if (r !== undefined) return r; }
    let pathMatched = false;
    for (const r of this.routes) {
      const params = Router.match(r.parts, segs);
      if (!params) continue;
      pathMatched = true;
      if (r.method !== req.method) continue;
      req.params = params;
      return r.handler(req);
    }
    return pathMatched ? '405' : '404';
  }
}
module.exports = { Router };
